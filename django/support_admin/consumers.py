from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from django.contrib.auth.models import AnonymousUser
from .models import SupportStaff, SupportNotification
from .permissions import IsSupportStaff


class AdminNotificationConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        self.user = self.scope.get("user")
        if not self.user or self.user.is_anonymous:
            await self.close()
            return
        staff = await self._get_staff(self.user)
        if not staff or not staff.is_active:
            await self.close()
            return
        self.staff = staff
        self.group_name = "support_admin_dashboard"
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()
        await self.send_json({"type": "connected", "staff_id": self.staff.id})

    async def disconnect(self, close_code):
        if hasattr(self, "group_name"):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive_json(self, content, **kwargs):
        message_type = content.get("type")
        if message_type == "ping":
            await self.send_json({"type": "pong"})
            return
        if message_type == "mark_read":
            notification_id = content.get("notification_id")
            if notification_id:
                await self._mark_notification_read(notification_id)
            return

    async def new_complaint(self, event):
        await self.send_json({"type": "new_complaint", "data": event.get("data")})

    async def new_ticket(self, event):
        await self.send_json({"type": "new_ticket", "data": event.get("data")})

    async def new_refund(self, event):
        await self.send_json({"type": "new_refund", "data": event.get("data")})

    async def complaint_updated(self, event):
        await self.send_json({"type": "complaint_updated", "data": event.get("data")})

    async def ticket_updated(self, event):
        await self.send_json({"type": "ticket_updated", "data": event.get("data")})

    async def sla_alert(self, event):
        await self.send_json({"type": "sla_alert", "data": event.get("data")})

    @database_sync_to_async
    def _get_staff(self, user):
        try:
            return SupportStaff.objects.select_related("user").get(user=user, is_active=True)
        except SupportStaff.DoesNotExist:
            return None

    @database_sync_to_async
    def _mark_notification_read(self, notification_id):
        if not getattr(self, "staff", None):
            return
        SupportNotification.objects.filter(id=notification_id, recipient=self.staff).update(is_read=True)
