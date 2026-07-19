import logging
import uuid

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.utils import timezone

from ..models import AppNotification
from .notifications import send_push_notification

logger = logging.getLogger(__name__)


def _track_push_result(notification, result):
    if not isinstance(notification, AppNotification):
        return
    payload = (result or {}).get("data") if isinstance(result, dict) else None
    payload = payload if isinstance(payload, dict) else {}
    status = payload.get("status") or "retrying"
    ticket_id = payload.get("id") or ""
    error = payload.get("message") or ((payload.get("details") or {}).get("error") if isinstance(payload.get("details"), dict) else "") or ""
    notification.push_attempts += 1
    notification.push_status = "ticket_created" if status == "ok" and ticket_id else status
    notification.push_ticket_id = ticket_id
    notification.push_error = str(error)
    notification.push_last_attempt_at = timezone.now()
    notification.save(update_fields=["push_attempts", "push_status", "push_ticket_id", "push_error", "push_last_attempt_at"])
    from ..tasks import check_push_receipt_task, retry_app_notification_push_task
    try:
        if ticket_id:
            check_push_receipt_task.apply_async(args=[notification.id], countdown=30)
        elif notification.push_attempts < 3:
            retry_app_notification_push_task.apply_async(args=[notification.id], countdown=30 * notification.push_attempts)
    except Exception:
        logger.exception("Could not queue push follow-up for notification=%s", notification.id)


def serialize_app_notification(notification):
    return {
        'id': notification.id,
        'title': notification.title,
        'body': notification.body,
        'notification_type': notification.notification_type,
        'data': notification.data or {},
        'is_read': notification.is_read,
        'read_at': notification.read_at.isoformat() if notification.read_at else None,
        'created_at': notification.created_at.isoformat() if notification.created_at else None,
    }


def _recipient_kwargs(user=None, store=None):
    if store is not None:
        return {'recipient_store': store}
    if user is not None:
        return {'recipient_user': user}
    return {}


def _recipient_group(user=None, store=None):
    if store is not None:
        return f'store_{store.id}_fulfillment'
    if user is not None:
        return f'user_{user.id}_fulfillment'
    return None


def get_unread_count(user=None, store=None):
    kwargs = _recipient_kwargs(user=user, store=store)
    if not kwargs:
        return 0
    return AppNotification.objects.filter(**kwargs, is_read=False).count()


def broadcast_app_notification_count(user=None, store=None, notification=None):
    group = _recipient_group(user=user, store=store)
    if not group:
        return

    payload = {'unread_count': get_unread_count(user=user, store=store)}
    if notification is not None:
        payload['notification'] = serialize_app_notification(notification)

    try:
        async_to_sync(get_channel_layer().group_send)(
            group,
            {
                'type': 'fulfillment_update',
                'event_id': str(uuid.uuid4()),
                'seq': int(timezone.now().timestamp() * 1000),
                'action': 'app_notification',
                'data': payload,
            }
        )
    except Exception:
        logger.exception('App notification websocket broadcast failed for %s.', group)


def create_app_notification(user=None, store=None, title='', body='', data=None, notification_type=None, dedupe_key=None):
    kwargs = _recipient_kwargs(user=user, store=store)
    if not kwargs:
        return None

    payload = data or {}
    notification_type = notification_type or payload.get('type') or ''
    defaults = {
        **kwargs,
        'title': title or 'Notification',
        'body': body or '',
        'notification_type': notification_type,
        'data': payload,
    }

    try:
        if dedupe_key:
            notification, created = AppNotification.objects.get_or_create(
                dedupe_key=dedupe_key,
                defaults=defaults,
            )
        else:
            notification = AppNotification.objects.create(**defaults)
            created = True

        if created:
            broadcast_app_notification_count(user=user, store=store, notification=notification)
        return notification
    except Exception:
        logger.exception('App notification create failed. type=%s dedupe=%s', notification_type, dedupe_key)
        return None


def create_app_notification_for_user(user, title, body, data=None, notification_type=None, dedupe_key=None):
    return create_app_notification(
        user=user,
        title=title,
        body=body,
        data=data,
        notification_type=notification_type,
        dedupe_key=dedupe_key,
    )


def create_app_notification_for_store(store, title, body, data=None, notification_type=None, dedupe_key=None):
    return create_app_notification(
        store=store,
        title=title,
        body=body,
        data=data,
        notification_type=notification_type,
        dedupe_key=dedupe_key,
    )


def send_user_app_notification(user, title, body, data=None, notification_type=None, dedupe_key=None):
    notification = create_app_notification_for_user(user, title, body, data, notification_type, dedupe_key)
    token = getattr(user, 'expo_push_token', None)
    if token:
        try:
            result = send_push_notification(token, title=title, body=body, data=data or {})
            _track_push_result(notification, result)
        except Exception:
            logger.exception('User push send failed. user=%s type=%s', getattr(user, 'id', None), notification_type or (data or {}).get('type'))
    return notification


def send_store_app_notification(store, title, body, data=None, notification_type=None, dedupe_key=None):
    notification = create_app_notification_for_store(store, title, body, data, notification_type, dedupe_key)
    token = getattr(store, 'expo_push_token', None)
    if token:
        try:
            result = send_push_notification(token, title=title, body=body, data=data or {})
            _track_push_result(notification, result)
        except Exception:
            logger.exception('Store push send failed. store=%s type=%s', getattr(store, 'id', None), notification_type or (data or {}).get('type'))
    return notification


def _chat_notification_payload(thread, sender_type, message_text, message_id=None):
    preview_text = (message_text or '').strip() or 'Sent you a message'
    if len(preview_text) > 80:
        preview_text = f'{preview_text[:80]}...'

    if sender_type == 'user':
        recipient = thread.store
        sender_name = getattr(thread.user, 'name', None) or 'Customer'
        recipient_kind = 'store'
    elif sender_type == 'store':
        recipient = thread.user
        sender_name = getattr(thread.store, 'name', None) or 'Pharmacy'
        recipient_kind = 'user'
    else:
        return None

    data = {'type': 'NEW_CHAT_MESSAGE', 'thread_id': thread.id}
    if message_id is not None:
        data['message_id'] = message_id

    dedupe_key = None
    if message_id is not None:
        dedupe_key = f'chat:{thread.id}:message:{message_id}:{recipient_kind}:{recipient.id}'

    return {
        'recipient': recipient,
        'recipient_kind': recipient_kind,
        'title': f'New message from {sender_name}',
        'body': preview_text,
        'data': data,
        'dedupe_key': dedupe_key,
    }


def create_chat_message_app_notification(thread, sender_type, message_text, message_id=None):
    payload = _chat_notification_payload(thread, sender_type, message_text, message_id)
    if not payload:
        return None

    if payload['recipient_kind'] == 'store':
        return create_app_notification_for_store(
            payload['recipient'], payload['title'], payload['body'], payload['data'],
            notification_type='NEW_CHAT_MESSAGE', dedupe_key=payload['dedupe_key'],
        )

    return create_app_notification_for_user(
        payload['recipient'], payload['title'], payload['body'], payload['data'],
        notification_type='NEW_CHAT_MESSAGE', dedupe_key=payload['dedupe_key'],
    )


def send_chat_message_push_notification(thread, sender_type, message_text):
    payload = _chat_notification_payload(thread, sender_type, message_text)
    if not payload:
        return None

    token = getattr(payload['recipient'], 'expo_push_token', None)
    if not token:
        return None

    try:
        return send_push_notification(
            token,
            title=payload['title'],
            body=payload['body'],
            data=payload['data'],
        )
    except Exception:
        logger.exception(
            'Chat push send failed. thread=%s recipient=%s',
            getattr(thread, 'id', None),
            getattr(payload['recipient'], 'id', None),
        )
        return None


def get_app_notifications_for_actor(actor, limit=50):
    if getattr(actor, 'is_store', False):
        kwargs = {'recipient_store': actor}
        store = actor
        user = None
    else:
        kwargs = {'recipient_user': actor}
        user = actor
        store = None

    qs = AppNotification.objects.filter(**kwargs).order_by('-created_at')
    unread_count = get_unread_count(user=user, store=store)
    return list(qs[:limit]), unread_count


def mark_app_notifications_read(actor, notification_id=None):
    if getattr(actor, 'is_store', False):
        kwargs = {'recipient_store': actor}
        store = actor
        user = None
    else:
        kwargs = {'recipient_user': actor}
        user = actor
        store = None

    qs = AppNotification.objects.filter(**kwargs, is_read=False)
    if notification_id:
        qs = qs.filter(id=notification_id)

    updated = qs.update(is_read=True, read_at=timezone.now())
    if updated:
        broadcast_app_notification_count(user=user, store=store)
    return get_unread_count(user=user, store=store)
