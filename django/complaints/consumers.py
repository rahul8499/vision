from urllib.parse import parse_qs

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer


class ComplaintConsumer(AsyncJsonWebsocketConsumer):
    """Read-only realtime stream shared by complaint participants and support."""

    async def connect(self):
        self.complaint_id = int(self.scope["url_route"]["kwargs"]["complaint_id"])
        token = parse_qs(self.scope.get("query_string", b"").decode()).get("token", [""])[0]
        self.audience = await self._complaint_audience(self.scope.get("user"), token)
        if not self.audience:
            await self.close(code=4003)
            return

        self.group_name = f"complaint_{self.complaint_id}_{self.audience}"
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()
        await self.send_json({"type": "connected", "complaint_id": self.complaint_id})

    async def disconnect(self, close_code):
        if hasattr(self, "group_name"):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive_json(self, content, **kwargs):
        if content.get("type") == "ping":
            await self.send_json({"type": "pong"})

    async def complaint_event(self, event):
        await self.send_json({
            "type": event["event_type"],
            "data": event.get("data"),
        })

    @database_sync_to_async
    def _complaint_audience(self, actor, token):
        from rest_framework_simplejwt.tokens import AccessToken
        from rest_framework_simplejwt.exceptions import TokenError
        from django.contrib.auth import get_user_model
        from prescription.models import User, Store
        from support_admin.models import SupportStaff
        from .models import Complaint

        complaint = Complaint.objects.filter(id=self.complaint_id).first()
        if not complaint:
            return None

        if isinstance(actor, User):
            return 'user' if actor.id in (complaint.complainant_user_id, complaint.respondent_user_id) else None
        if isinstance(actor, Store):
            return 'store' if actor.id in (complaint.complainant_store_id, complaint.respondent_store_id) else None

        try:
            user_id = AccessToken(token).get("user_id")
            auth_user = get_user_model().objects.get(id=user_id, is_active=True)
            staff = SupportStaff.objects.filter(user=auth_user, is_active=True).first()
            if not staff:
                return None
            allowed = staff.role == SupportStaff.ROLE_ADMIN or staff.all_cities_access
            allowed = allowed or complaint.scope == Complaint.SCOPE_GLOBAL
            allowed = allowed or staff.cities.filter(id=complaint.city_id).exists()
            return 'support' if allowed else None
        except (TokenError, get_user_model().DoesNotExist, TypeError, ValueError):
            return None


class SupportTicketConsumer(AsyncJsonWebsocketConsumer):
    """Realtime stream for one requester and active AARX support staff."""

    async def connect(self):
        # Some ASGI server/version combinations can redeliver websocket.connect
        # while async JWT authorization is in flight. Accept this socket once.
        if getattr(self, "_connection_started", False):
            return
        self._connection_started = True

        self.ticket_id = int(self.scope["url_route"]["kwargs"]["ticket_id"])
        token = parse_qs(self.scope.get("query_string", b"").decode()).get("token", [""])[0]
        if not await self._can_view_ticket(self.scope.get("user"), token):
            await self.close(code=4003)
            return
        self.group_name = f"support_ticket_{self.ticket_id}"
        try:
            await self.accept()
        except RuntimeError as exc:
            # Uvicorn's SansIO protocol can report the handshake as complete
            # before Channels sends its explicit accept. The socket is already
            # open in this exact case, so continue instead of killing the
            # consumer. Never suppress any other handshake/runtime failure.
            already_accepted = (
                "Expected ASGI message 'websocket.send' or 'websocket.close'" in str(exc)
                and "websocket.accept" in str(exc)
            )
            if not already_accepted:
                raise
        # Join only after the handshake. Otherwise a group event can call
        # send_json between group_add and accept, implicitly opening the socket
        # and turning the following accept into an invalid second handshake.
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.send_json({"type": "connected", "ticket_id": self.ticket_id})

    async def disconnect(self, close_code):
        if hasattr(self, "group_name"):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive_json(self, content, **kwargs):
        if content.get("type") == "ping":
            await self.send_json({"type": "pong"})

    async def support_ticket_event(self, event):
        await self.send_json({"type": event["event_type"], "data": event.get("data")})

    @database_sync_to_async
    def _can_view_ticket(self, actor, token):
        from rest_framework_simplejwt.tokens import AccessToken
        from rest_framework_simplejwt.exceptions import TokenError
        from django.contrib.auth import get_user_model
        from prescription.models import User, Store
        from support_admin.models import SupportStaff
        from .models import PlatformSupportTicket

        ticket = PlatformSupportTicket.objects.filter(id=self.ticket_id).first()
        if not ticket:
            return False
        if isinstance(actor, User):
            return actor.id == ticket.requester_user_id
        if isinstance(actor, Store):
            return actor.id == ticket.requester_store_id
        try:
            user_id = AccessToken(token).get("user_id")
            auth_user = get_user_model().objects.get(id=user_id, is_active=True)
            staff = SupportStaff.objects.filter(user=auth_user, is_active=True).first()
            if not staff:
                return False
            if ticket.scope == PlatformSupportTicket.SCOPE_GLOBAL:
                return True
            return (
                staff.role == SupportStaff.ROLE_ADMIN
                or staff.all_cities_access
                or staff.cities.filter(id=ticket.city_id).exists()
            )
        except (TokenError, get_user_model().DoesNotExist, TypeError, ValueError):
            return False
