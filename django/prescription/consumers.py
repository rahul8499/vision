import asyncio
import json
import logging
import uuid
from datetime import timedelta
from django.utils import timezone
from asgiref.sync import sync_to_async
from django.core.cache import cache
from channels.generic.websocket import AsyncWebsocketConsumer
from redis.exceptions import RedisError
from channels.db import database_sync_to_async
from .models import ChatThread, ChatMessage
from django.contrib.auth.models import AnonymousUser
from .tasks import notify_chat_message_task
from .utils.app_notifications import create_chat_message_app_notification
from core.services.capability_service import Permission
from core.services.action_validator import CapabilityBlocked, validate_action_capability
logger = logging.getLogger(__name__)


class RedisSafeAsyncWebsocketConsumer(AsyncWebsocketConsumer):
    async def __call__(self, scope, receive, send):
        try:
            return await super().__call__(scope, receive, send)
        except (RedisError, asyncio.TimeoutError):
            logger.warning(
                "%s Redis channel layer failed; closing websocket.",
                self.__class__.__name__,
                exc_info=True,
            )
            release_conn_slot = getattr(self, "_release_conn_slot", None)
            if release_conn_slot:
                await release_conn_slot()
            try:
                await self.close(code=1011)
            except Exception:
                pass


class ChatConsumer(RedisSafeAsyncWebsocketConsumer):
    async def connect(self):
        self.thread_id = self.scope['url_route']['kwargs']['thread_id']
        self.user = self.scope['user']
        self.room_group_name = f'chat_{self.thread_id}'

        if isinstance(self.user, AnonymousUser):
            await self.close()
            return
            
        # Verify user or store is part of this exact thread
        has_access = await self.verify_access()
        if not has_access:
            await self.close()
            return

        # Join chat room group
        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )

        await self.accept()
        
        # Mark online and notify group
        await self.update_user_status(True)
        await self.broadcast_user_status(True)

    async def disconnect(self, close_code):
        # Mark offline and notify group
        await self.update_user_status(False)
        await self.broadcast_user_status(False)

        await self.channel_layer.group_discard(
            self.room_group_name,
            self.channel_name
        )

    # Receive message from WebSocket client
    async def receive(self, text_data):
        text_data_json = json.loads(text_data)
        action = text_data_json.get('action')

        sender_type = 'user' if getattr(self.user, 'is_user', False) else 'store'

        if action == 'mark_read':
            other_type = 'store' if sender_type == 'user' else 'user'
            await self.mark_messages_read(other_type)
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'messages_read',
                    'reader_type': sender_type
                }
            )
            return

        if action == 'edit_message':
            msg_id = text_data_json.get('message_id')
            new_text = text_data_json.get('text')
            result = await self.edit_message_logic(msg_id, new_text, sender_type)
            if result:
                await self.channel_layer.group_send(
                    self.room_group_name,
                    {
                        'type': 'message_update',
                        'data': result
                    }
                )
            return

        if action == 'delete_message':
            msg_id = text_data_json.get('message_id')
            delete_type = text_data_json.get('delete_type') # 'everyone' or 'me'
            result = await self.delete_message_logic(msg_id, delete_type, sender_type)
            if result:
                await self.channel_layer.group_send(
                    self.room_group_name,
                    {
                        'type': 'message_update',
                        'data': result
                    }
                )
            return

        if action == 'typing':
            is_typing = text_data_json.get('is_typing', False)
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'user_typing',
                    'user_type': sender_type,
                    'is_typing': is_typing
                }
            )
            return

        # 🔒 Lock Check: Block messages on completed/cancelled orders
        is_locked = await self.check_thread_locked()
        if is_locked:
            await self.send(text_data=json.dumps({
                "error": "chat_locked",
                "message": "This chat is no longer active."
            }))
            return

        capability_error = await self.check_chat_capability()
        if capability_error:
            await self.send(text_data=json.dumps(capability_error))
            return

        message = text_data_json.get('message')
        audio_name = text_data_json.get('audio_name')  # just in case front-end sends audio name
        reply_to_id = text_data_json.get('reply_to_id')
        
        if not message and not audio_name:
            return
        
        # Save message to DB asynchronously
        saved_msg = await self.save_message(message, sender_type, reply_to_id=reply_to_id)

        # Broadcast message to room group across all connections
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'chat_message',
                'id': saved_msg.id,
                'message': message,
                'sender_type': sender_type,
                'sender_id': self.user.id,
                'created_at': saved_msg.created_at.isoformat(),
                'is_read': False,
                'reply_to': saved_msg.reply_to_id,
                'reply_to_text': await self.get_reply_text(saved_msg)
            }
        )

        # 🚀 Global Cross-Channel Ping: Tell the global fulfillment socket to show an In-App Toast
        try:
            thread_details = await self.get_thread_participants()
            if thread_details:
                target_group = f"store_{thread_details['store_id']}_fulfillment" if sender_type == 'user' else f"user_{thread_details['user_id']}_fulfillment"
                preview_text = message[:40] + "..." if len(message) > 40 else message
                
                print(f"[DEBUG] Sending new_chat_message to target_group: {target_group} | sender_type={sender_type}")
                
                await self.channel_layer.group_send(
                    target_group,
                    {
                        'type': 'fulfillment_update',
                        'event_id': str(uuid.uuid4()),
                        'action': 'new_chat_message',
                        'data': {
                            'thread_id': self.thread_id,
                            'text': preview_text,
                            'sender_name': thread_details['user_name'] if sender_type == 'user' else thread_details['store_name']
                        }
                    }
                )
        except Exception as e:
            print(f"Failed to send global chat ping: {e}")

    # Broadcast handler to push message back to WebSockets
    async def chat_message(self, event):
        await self.send(text_data=json.dumps({
            'id': event.get('id'),
            'text': event['message'],
            'sender_type': event['sender_type'],
            'sender_id': event['sender_id'],
            'created_at': event['created_at'],
            'audio': event.get('audio'),
            'image': event.get('image'),
            'video': event.get('video'),
            'is_read': event.get('is_read', False),
            'reply_to': event.get('reply_to'),
            'reply_to_text': event.get('reply_to_text')
        }))

    async def messages_read(self, event):
        await self.send(text_data=json.dumps({
            'action': 'messages_read',
            'reader_type': event['reader_type']
        }))

    async def user_status(self, event):
        await self.send(text_data=json.dumps({
            'action': 'user_status',
            'user_type': event['user_type'],
            'is_online': event['is_online'],
            'last_seen': event['last_seen']
        }))

    async def message_update(self, event):
        await self.send(text_data=json.dumps({
            'action': 'message_update',
            'message': event['data']
        }))

    async def user_typing(self, event):
        await self.send(text_data=json.dumps({
            'action': 'typing',
            'user_type': event['user_type'],
            'is_typing': event['is_typing']
        }))

    @database_sync_to_async
    def verify_access(self):
        if getattr(self.user, 'is_user', False):
            return ChatThread.objects.filter(id=self.thread_id, user_id=self.user.id).exists()
        if getattr(self.user, 'is_store', False):
            return ChatThread.objects.filter(id=self.thread_id, store_id=self.user.id).exists()
        return False

    @database_sync_to_async
    def check_thread_locked(self):
        try:
            thread = ChatThread.objects.select_related('prescription', 'store', 'user').get(id=self.thread_id)
            return thread.is_chat_locked()
        except ChatThread.DoesNotExist:
            return False

    @database_sync_to_async
    def check_chat_capability(self):
        try:
            thread = ChatThread.objects.select_related('store', 'user', 'prescription').get(id=self.thread_id)
            validate_action_capability(Permission.CHAT, actor=self.user, resource=thread)
            return None
        except CapabilityBlocked as exc:
            return exc.detail
        except ChatThread.DoesNotExist:
            return {"error": "thread_not_found", "message": "Thread not found."}

    @database_sync_to_async
    def mark_messages_read(self, sender_type_to_mark):
        ChatMessage.objects.filter(
            thread_id=self.thread_id,
            sender_type=sender_type_to_mark,
            is_read=False
        ).update(is_read=True)

    @database_sync_to_async
    def save_message(self, text, sender_type, reply_to_id=None):
        msg = ChatMessage.objects.create(
            thread_id=self.thread_id,
            sender_type=sender_type,
            text=text,
            is_read=False,
            reply_to_id=reply_to_id
        )
        # ✅ High-performance shortcut to update thread timestamp without triggering full save() signals
        ChatThread.objects.filter(id=self.thread_id).update(updated_at=timezone.now())
        
        # Persist the bell item immediately; Expo delivery remains asynchronous.
        try:
            create_chat_message_app_notification(
                msg.thread, sender_type, text, message_id=msg.id,
            )
        except Exception:
            logging.getLogger(__name__).exception(
                'Could not create chat bell item for message %s.', msg.id
            )

        try:
            notify_chat_message_task.delay(self.thread_id, sender_type, text)
        except Exception:
            logging.getLogger(__name__).exception(
                'Could not enqueue chat push for message %s.', msg.id
            )

        return msg

    @database_sync_to_async
    def get_reply_text(self, msg):
        if msg.reply_to:
            return msg.reply_to.text[:50] + "..." if msg.reply_to.text and len(msg.reply_to.text) > 50 else msg.reply_to.text
        return None

    @database_sync_to_async
    def get_thread_participants(self):
        try:
            thread = ChatThread.objects.select_related('user', 'store').get(id=self.thread_id)
            return {
                'user_id': thread.user.id if thread.user else None,
                'store_id': thread.store.id if thread.store else None,
                'user_name': thread.user.name if hasattr(thread.user, 'name') else 'Patient',
                'store_name': thread.store.name if hasattr(thread.store, 'name') else 'Store'
            }
        except ChatThread.DoesNotExist:
            return None

    @database_sync_to_async
    def update_user_status(self, is_online):
        from django.utils import timezone
        user = self.scope['user']
        if getattr(user, 'is_user', False):
            from .models import User
            User.objects.filter(id=user.id).update(is_online=is_online, last_seen=timezone.now())
        elif getattr(user, 'is_store', False):
            from .models import Store
            Store.objects.filter(id=user.id).update(is_online=is_online, last_seen=timezone.now())

    async def broadcast_user_status(self, is_online):
        user_type = 'user' if getattr(self.user, 'is_user', False) else 'store'
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'user_status',
                'user_type': user_type,
                'is_online': is_online,
                'last_seen': timezone.now().isoformat()
            }
        )

    @database_sync_to_async
    def edit_message_logic(self, msg_id, new_text, sender_type):
        try:
            msg = ChatMessage.objects.get(id=msg_id, thread_id=self.thread_id, sender_type=sender_type)
            # Only allow if < 30m
            if timezone.now() - msg.created_at < timedelta(minutes=30):
                msg.text = new_text
                msg.is_edited = True
                msg.save()
                from .serializers import ChatMessageSerializer
                return ChatMessageSerializer(msg).data
        except ChatMessage.DoesNotExist:
            pass
        return None

    @database_sync_to_async
    def delete_message_logic(self, msg_id, delete_type, sender_type):
        try:
            msg = ChatMessage.objects.get(id=msg_id, thread_id=self.thread_id)
            
            if delete_type == 'everyone':
                # Check 30m window
                if msg.sender_type == sender_type and (timezone.now() - msg.created_at < timedelta(minutes=30)):
                    msg.is_deleted_for_everyone = True
                    msg.text = "" # Clear text
                    msg.audio = None # Clear audio
                    msg.save()
                else:
                    return None # Not allowed or not sender
            else:
                # Delete for me
                if sender_type == 'user':
                    msg.deleted_by_user = True
                else:
                    msg.deleted_by_store = True
                msg.save()

            from .serializers import ChatMessageSerializer
            return ChatMessageSerializer(msg).data
        except ChatMessage.DoesNotExist:
            pass
        return None

class FulfillmentConsumer(RedisSafeAsyncWebsocketConsumer):
    # 🛡️ Max concurrent WebSocket connections per user
    MAX_WS_CONNECTIONS = 8
    CONN_COUNTER_TTL_SECONDS = 300

    async def connect(self):
        self.user = self.scope.get('user')

        if not self.user or isinstance(self.user, AnonymousUser) or not getattr(self.user, 'is_user', False):
            user_debug = type(self.user).__name__ if self.user else 'None'
            is_user_val = getattr(self.user, 'is_user', 'ATTR_MISSING')
            print(f"Fulfillment WS Reject: type={user_debug}, is_user={is_user_val}")
            await self.close()
            return

        # 🛡️ Rate Limit: Cap connections per user to prevent abuse / socket storms
        self.conn_key = f"ws_conn:user_{self.user.id}"
        self.conn_slot_acquired = False
        try:
            conn_count = await sync_to_async(self._incr_conn)(self.conn_key)
            self.conn_slot_acquired = True
        except Exception:
            logger.exception("Fulfillment WS Redis counter unavailable for user %s.", self.user.id)
            await self.close(code=1011)
            return

        if conn_count > self.MAX_WS_CONNECTIONS:
            await self._release_conn_slot()
            print(f"Fulfillment WS Rate Limit: User {self.user.id} exceeded {self.MAX_WS_CONNECTIONS} connections. Rejecting.")
            await self.close(code=4029)  # Custom close code: too many connections
            return

        self.group_name = f'user_{self.user.id}_fulfillment'

        # Join user fulfillment group
        try:
            await self.channel_layer.group_add(
                self.group_name,
                self.channel_name
            )
            await self.accept()
        except (RedisError, asyncio.TimeoutError):
            await self._release_conn_slot()
            logger.warning("Fulfillment WS Redis group join failed for user %s.", self.user.id, exc_info=True)
            await self.close(code=1011)
            return
        except Exception:
            await self._release_conn_slot()
            raise

        print(f"Fulfillment WS Connected: User {self.user.id} joined group {self.group_name} [conn #{conn_count}/{self.MAX_WS_CONNECTIONS}]")

    async def disconnect(self, close_code):
        # 🛡️ Rate Limit: Release connection slot on disconnect
        await self._release_conn_slot()

        if hasattr(self, 'group_name'):
            try:
                await self.channel_layer.group_discard(
                    self.group_name,
                    self.channel_name
                )
            except (RedisError, asyncio.TimeoutError):
                logger.warning("Fulfillment WS Redis group discard failed for user %s.", self.user.id, exc_info=True)
            else:
                print(f"Fulfillment WS Disconnected: User {self.user.id} left group {self.group_name}")

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # 🛡️ Connection Rate Limit Helpers
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    async def _release_conn_slot(self):
        if not getattr(self, 'conn_slot_acquired', False) or not hasattr(self, 'conn_key'):
            return

        self.conn_slot_acquired = False
        try:
            await sync_to_async(self._decr_conn)(self.conn_key)
        except Exception:
            logger.warning("Fulfillment WS Redis counter release failed for user %s.", self.user.id, exc_info=True)

    @staticmethod
    def _incr_conn(key: str) -> int:
        """Atomically increment connection counter with a short stale-key recovery TTL."""
        cache.add(key, 0, timeout=FulfillmentConsumer.CONN_COUNTER_TTL_SECONDS)
        value = cache.incr(key)
        try:
            cache.touch(key, timeout=FulfillmentConsumer.CONN_COUNTER_TTL_SECONDS)
        except Exception:
            pass
        return value

    @staticmethod
    def _decr_conn(key: str) -> None:
        """Safely decrement connection counter (never below 0)."""
        try:
            val = cache.get(key, 0)
            if val and val > 1:
                cache.decr(key)
            else:
                cache.delete(key)
        except Exception:
            pass

    # Receive message from room group (broadcast → WebSocket client)
    async def fulfillment_update(self, event):
        # 🛡️ Quality Control: Ensure 'updated_at' is always present for race-condition handling on frontend
        data = event['data']
        if 'updated_at' not in data:
            data['updated_at'] = timezone.now().isoformat()

        # Send update to WebSocket
        # Pass through idempotency key + sequence number so frontend can deduplicate
        await self.send(text_data=json.dumps({
            'type': 'fulfillment_update',
            'event_id': event.get('event_id'),   # 🛡️ Idempotency: unique per broadcast
            'seq':      event.get('seq'),         # 🔢 Ordering: response_version at send time
            'action':   event.get('action', 'status_change'),
            'data':     data
        }))


class StoreFulfillmentConsumer(RedisSafeAsyncWebsocketConsumer):
    # 🛡️ Max concurrent WebSocket connections per store
    MAX_WS_CONNECTIONS = 8

    async def connect(self):
        self.user = self.scope.get('user')

        if not self.user or isinstance(self.user, AnonymousUser) or not getattr(self.user, 'is_store', False):
            print(f"Store WS Reject: Anonymous or non-store attempted connection.")
            await self.close()
            return

        # 🛡️ Rate Limit: Cap connections per store
        self.conn_key = f"ws_conn:store_{self.user.id}"
        self.conn_slot_acquired = False
        try:
            conn_count = await sync_to_async(FulfillmentConsumer._incr_conn)(self.conn_key)
            self.conn_slot_acquired = True
        except Exception:
            logger.exception("Store WS Redis counter unavailable for store %s.", self.user.id)
            await self.close(code=1011)
            return

        if conn_count > self.MAX_WS_CONNECTIONS:
            await self._release_conn_slot()
            print(f"Store WS Rate Limit: Store {self.user.id} exceeded {self.MAX_WS_CONNECTIONS} connections. Rejecting.")
            await self.close(code=4029)
            return

        self.group_name = f'store_{self.user.id}_fulfillment'

        # Join store fulfillment group
        try:
            await self.channel_layer.group_add(
                self.group_name,
                self.channel_name
            )
            await self.accept()
        except (RedisError, asyncio.TimeoutError):
            await self._release_conn_slot()
            logger.warning("Store WS Redis group join failed for store %s.", self.user.id, exc_info=True)
            await self.close(code=1011)
            return
        except Exception:
            await self._release_conn_slot()
            raise

        print(f"Store WS Connected: Store {self.user.id} joined group {self.group_name} [conn #{conn_count}/{self.MAX_WS_CONNECTIONS}]")

    async def disconnect(self, close_code):
        await self._release_conn_slot()

        if hasattr(self, 'group_name'):
            try:
                await self.channel_layer.group_discard(
                    self.group_name,
                    self.channel_name
                )
            except (RedisError, asyncio.TimeoutError):
                logger.warning("Store WS Redis group discard failed for store %s.", self.user.id, exc_info=True)
            else:
                print(f"Store WS Disconnected: Store {self.user.id} left group {self.group_name}")

    async def _release_conn_slot(self):
        if not getattr(self, 'conn_slot_acquired', False) or not hasattr(self, 'conn_key'):
            return

        self.conn_slot_acquired = False
        try:
            await sync_to_async(FulfillmentConsumer._decr_conn)(self.conn_key)
        except Exception:
            logger.warning("Store WS Redis counter release failed for store %s.", self.user.id, exc_info=True)

    async def fulfillment_update(self, event):
        data = event['data']
        if 'updated_at' not in data:
            data['updated_at'] = timezone.now().isoformat()

        await self.send(text_data=json.dumps({
            'type': 'fulfillment_update',
            'event_id': event.get('event_id'),
            'seq': event.get('seq'),
            'action': event.get('action', 'status_change'),
            'data': data
        }))

