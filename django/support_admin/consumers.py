from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from django.contrib.auth.models import AnonymousUser
from .models import SupportStaff, SupportNotification
from .permissions import IsSupportStaff


class AdminNotificationConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        from urllib.parse import parse_qs
        token = parse_qs(self.scope.get("query_string", b"").decode()).get("token", [""])[0]
        staff = await self._get_staff_from_token(token)
        if not staff or not staff.is_active:
            await self.close(code=4003)
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

    async def refund_updated(self, event):
        await self.send_json({"type": "refund_updated", "data": event.get("data")})

    async def safety_report_updated(self, event):
        await self.send_json({"type": "safety_report_updated", "data": event.get("data")})

    async def sla_alert(self, event):
        await self.send_json({"type": "sla_alert", "data": event.get("data")})

    async def notification_created(self, event):
        if event.get("recipient_id") != self.staff.id:
            return
        await self.send_json({"type": "notification", "data": event.get("data")})

    @database_sync_to_async
    def _get_staff_from_token(self, token):
        from rest_framework_simplejwt.tokens import AccessToken
        from rest_framework_simplejwt.exceptions import TokenError
        try:
            user_id = AccessToken(token).get("user_id")
            return SupportStaff.objects.select_related("user").get(user_id=user_id, is_active=True)
        except (SupportStaff.DoesNotExist, TokenError, TypeError, ValueError):
            return None

    @database_sync_to_async
    def _mark_notification_read(self, notification_id):
        if not getattr(self, "staff", None):
            return
        SupportNotification.objects.filter(id=notification_id, recipient=self.staff).update(is_read=True)


class EmergencyMonitoringConsumer(AsyncJsonWebsocketConsumer):
    """Read-only live monitoring stream with server-side city authorization."""

    async def connect(self):
        from urllib.parse import parse_qs

        token = parse_qs(self.scope.get("query_string", b"").decode()).get("token", [""])[0]
        access = await self._get_access(token)
        if not access:
            await self.close(code=4003)
            return
        self.staff_id, self.allowed_city_ids = access
        self.group_name = "support_emergency_monitoring"
        await self.accept()
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.send_json({"type": "connected", "staff_id": self.staff_id})

    async def disconnect(self, close_code):
        if hasattr(self, "group_name"):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive_json(self, content, **kwargs):
        if content.get("type") == "ping":
            await self.send_json({"type": "pong"})

    async def monitoring_event(self, event):
        data = event.get("data") or {}
        city_id = data.get("city_id")
        if self.allowed_city_ids is not None and city_id not in self.allowed_city_ids:
            return
        await self.send_json({"type": event.get("event_type", "monitoring_updated"), "data": data})

    @database_sync_to_async
    def _get_access(self, token):
        from django.contrib.auth import get_user_model
        from rest_framework_simplejwt.exceptions import TokenError
        from rest_framework_simplejwt.tokens import AccessToken

        try:
            user_id = AccessToken(token).get("user_id")
            user = get_user_model().objects.get(id=user_id, is_active=True)
            staff = SupportStaff.objects.get(user=user, is_active=True)
        except (TokenError, get_user_model().DoesNotExist, SupportStaff.DoesNotExist, TypeError, ValueError):
            return None
        allowed = None
        if staff.role != SupportStaff.ROLE_ADMIN and not staff.all_cities_access:
            allowed = set(staff.cities.values_list("id", flat=True))
        return staff.id, allowed
