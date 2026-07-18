from django.conf import settings
from django.db import transaction
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from rest_framework_simplejwt.views import TokenRefreshView as BaseTokenRefreshView

from .authentication import SupportJWTAuthentication
from .models import SupportStaff, SupportSession, InternalNote
from .permissions import (
    IsSupportStaff, IsSupportAgent, IsSupportSupervisor, IsSupportAdmin,
    CanApproveRefund, CanProcessRefund, CanManageStaff, CanBulkAssign, CanViewAuditLogs
)
from .pagination import SupportPagination
from .filters import (
    SupportStaffFilter, RefundRequestFilter, SafetyReportActionFilter,
    SupportAuditLogFilter, SupportNotificationFilter, SupportAssignmentFilter
)
from .serializers import (
    SupportStaffSerializer, SupportStaffCreateSerializer,
    SupportAssignmentSerializer, InternalNoteSerializer, InternalNoteCreateSerializer,
    SafetyReportSerializer, SafetyReportActionSerializer, SafetyReportActionCreateSerializer,
    SupportAuditLogSerializer, SLAConfigurationSerializer, SupportNotificationSerializer,
    UserProfileSerializer, StoreProfileSerializer,
)
from complaints.serializers import ComplaintListSerializer, ComplaintDetailSerializer
from prescription.serializers import UserSerializer, StoreSerializer
from .services import (
    auth_service, dashboard_service, complaint_service, ticket_service,
    refund_service, safety_service, lookup_service, notification_service,
    staff_service, audit_service,
)
from .selectors import (
    complaint_selectors, ticket_selectors, refund_selectors,
    staff_selectors, audit_selectors, notification_selectors, lookup_selectors,
    safety_selectors,
)
from complaints.models import (
    Complaint, ComplaintMessage, ComplaintStatusHistory, ComplaintAttachment,
    PlatformSupportTicket, PlatformSupportMessage,
)
from prescription.models import User, Store
from emergency_services.models import EmergencyBroadcastCharge


# ---------------------------------------------------------------------------
# Response helpers
# ---------------------------------------------------------------------------

def ok(data=None, message="", status_code=status.HTTP_200_OK):
    payload = {"success": True}
    if message:
        payload["message"] = message
    if data is not None:
        payload["data"] = data
    return Response(payload, status=status_code)


def fail(message, errors=None, code="ERROR", status_code=status.HTTP_400_BAD_REQUEST):
    payload = {"success": False, "message": message, "code": code}
    if errors:
        payload["errors"] = errors
    return Response(payload, status=status_code)


def paginated(queryset, request, serializer_class, context=None):
    paginator = SupportPagination()
    page = paginator.paginate_queryset(queryset, request)
    ctx = context or {}
    ctx.setdefault("request", request)
    if page is not None:
        serializer = serializer_class(page, many=True, context=ctx)
        data = {
            "results": serializer.data,
            "pagination": {
                "page": paginator.page.number,
                "page_size": paginator.page_size,
                "total_pages": paginator.page.paginator.num_pages,
                "total_count": paginator.page.paginator.count,
            },
        }
        return ok(data)
    serializer = serializer_class(queryset, many=True, context=ctx)
    data = {
        "results": serializer.data,
        "pagination": {
            "page": 1,
            "page_size": len(serializer.data),
            "total_pages": 1,
            "total_count": len(serializer.data),
        },
    }
    return ok(data)


def _get_client_info(request):
    ip = request.META.get("REMOTE_ADDR")
    ua = request.META.get("HTTP_USER_AGENT", "")
    return ip, ua


# ---------------------------------------------------------------------------
# Auth views
# ---------------------------------------------------------------------------

class LoginView(APIView):
    permission_classes = []
    authentication_classes = []

    def post(self, request):
        email = request.data.get("email")
        password = request.data.get("password")
        if not email or not password:
            return fail("Email and password are required.", status_code=status.HTTP_400_BAD_REQUEST)

        try:
            result = auth_service.login_staff(email, password)
            ip, ua = _get_client_info(request)
            audit_service.log_audit(
                actor=SupportStaff.objects.select_related("user").get(user__email=email),
                action="login",
                entity_type="support_staff",
                entity_id=result["staff"]["id"],
                ip_address=ip,
                user_agent=ua,
            )
            return ok(result, message="Login successful.", status_code=status.HTTP_200_OK)
        except ValueError as exc:
            return fail(str(exc), status_code=status.HTTP_401_UNAUTHORIZED)


class RefreshTokenView(BaseTokenRefreshView):
    permission_classes = []
    authentication_classes = []

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        try:
            serializer.is_valid(raise_exception=True)
        except TokenError as exc:
            return fail("Invalid or expired refresh token.", status_code=status.HTTP_401_UNAUTHORIZED)

        try:
            result = auth_service.refresh_staff_token(request.data.get("refresh"))
            return ok(result, message="Token refreshed.", status_code=status.HTTP_200_OK)
        except ValueError as exc:
            return fail(str(exc), status_code=status.HTTP_401_UNAUTHORIZED)


class LogoutView(APIView):
    authentication_classes = [SupportJWTAuthentication]
    permission_classes = [IsSupportStaff]

    def post(self, request):
        staff = request.support_staff
        refresh_token = request.data.get("refresh")
        auth_service.logout_staff(staff, refresh_token)
        ip, ua = _get_client_info(request)
        audit_service.log_audit(
            actor=staff,
            action="logout",
            entity_type="support_staff",
            entity_id=staff.id,
            ip_address=ip,
            user_agent=ua,
        )
        return ok(message="Logged out successfully.", status_code=status.HTTP_200_OK)


class MeView(APIView):
    authentication_classes = [SupportJWTAuthentication]
    permission_classes = [IsSupportStaff]

    def get(self, request):
        staff = request.support_staff
        data = auth_service.get_staff_profile(staff)
        return ok(data, status_code=status.HTTP_200_OK)

    def patch(self, request):
        staff = request.support_staff
        allowed_fields = {"department", "phone", "timezone"}
        data = {k: v for k, v in request.data.items() if k in allowed_fields}
        if not data:
            return fail("No valid fields to update.", status_code=status.HTTP_400_BAD_REQUEST)
        for key, value in data.items():
            setattr(staff, key, value)
        staff.save(update_fields=list(data.keys()))
        return ok(SupportStaffSerializer(staff).data, message="Profile updated.", status_code=status.HTTP_200_OK)


class ChangePasswordView(APIView):
    authentication_classes = [SupportJWTAuthentication]
    permission_classes = [IsSupportStaff]

    def post(self, request):
        staff = request.support_staff
        old_password = request.data.get("old_password")
        new_password = request.data.get("new_password")
        if not old_password or not new_password:
            return fail("old_password and new_password are required.", status_code=status.HTTP_400_BAD_REQUEST)
        try:
            auth_service.change_staff_password(staff, old_password, new_password)
            return ok(message="Password changed successfully.", status_code=status.HTTP_200_OK)
        except ValueError as exc:
            return fail(str(exc), status_code=status.HTTP_400_BAD_REQUEST)


# ---------------------------------------------------------------------------
# Dashboard view
# ---------------------------------------------------------------------------

class DashboardSummaryView(APIView):
    authentication_classes = [SupportJWTAuthentication]
    permission_classes = [IsSupportStaff]

    def get(self, request):
        summary = dashboard_service.get_dashboard_summary()
        return ok(summary, status_code=status.HTTP_200_OK)


# ---------------------------------------------------------------------------
# Staff views
# ---------------------------------------------------------------------------

class StaffListCreateView(APIView):
    authentication_classes = [SupportJWTAuthentication]
    permission_classes = [CanManageStaff]

    def get(self, request):
        filters = request.query_params.dict()
        qs = staff_service.list_staff(filters)
        return paginated(qs, request, SupportStaffSerializer)

    def post(self, request):
        serializer = SupportStaffCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return fail("Validation failed.", errors=serializer.errors, status_code=status.HTTP_400_BAD_REQUEST)
        staff = staff_service.create_staff(serializer.validated_data, created_by=request.support_staff)
        ip, ua = _get_client_info(request)
        audit_service.log_audit(
            actor=request.support_staff,
            action="create_staff",
            entity_type="support_staff",
            entity_id=staff.id,
            ip_address=ip,
            user_agent=ua,
        )
        return ok(SupportStaffSerializer(staff).data, message="Staff created successfully.", status_code=status.HTTP_201_CREATED)


class StaffDetailView(APIView):
    authentication_classes = [SupportJWTAuthentication]
    permission_classes = [CanManageStaff]

    def get(self, request, pk):
        staff = staff_selectors.get_staff_by_id(pk)
        if not staff:
            return fail("Staff not found.", status_code=status.HTTP_404_NOT_FOUND)
        return ok(SupportStaffSerializer(staff).data, status_code=status.HTTP_200_OK)

    def patch(self, request, pk):
        staff = staff_selectors.get_staff_by_id(pk)
        if not staff:
            return fail("Staff not found.", status_code=status.HTTP_404_NOT_FOUND)
        serializer = SupportStaffSerializer(staff, data=request.data, partial=True)
        if not serializer.is_valid():
            return fail("Validation failed.", errors=serializer.errors, status_code=status.HTTP_400_BAD_REQUEST)
        staff = staff_service.update_staff(staff, serializer.validated_data)
        ip, ua = _get_client_info(request)
        audit_service.log_audit(
            actor=request.support_staff,
            action="update_staff",
            entity_type="support_staff",
            entity_id=staff.id,
            ip_address=ip,
            user_agent=ua,
        )
        return ok(SupportStaffSerializer(staff).data, message="Staff updated.", status_code=status.HTTP_200_OK)

    def delete(self, request, pk):
        staff = staff_selectors.get_staff_by_id(pk)
        if not staff:
            return fail("Staff not found.", status_code=status.HTTP_404_NOT_FOUND)
        staff.is_active = False
        staff.save(update_fields=["is_active"])
        ip, ua = _get_client_info(request)
        audit_service.log_audit(
            actor=request.support_staff,
            action="deactivate_staff",
            entity_type="support_staff",
            entity_id=staff.id,
            ip_address=ip,
            user_agent=ua,
        )
        return ok(message="Staff deactivated.", status_code=status.HTTP_200_OK)


class StaffActivateView(APIView):
    authentication_classes = [SupportJWTAuthentication]
    permission_classes = [CanManageStaff]

    def post(self, request, pk):
        try:
            staff = staff_service.activate_staff(pk)
            ip, ua = _get_client_info(request)
            audit_service.log_audit(
                actor=request.support_staff,
                action="activate_staff",
                entity_type="support_staff",
                entity_id=staff.id,
                ip_address=ip,
                user_agent=ua,
            )
            return ok(SupportStaffSerializer(staff).data, message="Staff activated.", status_code=status.HTTP_200_OK)
        except ValueError as exc:
            return fail(str(exc), status_code=status.HTTP_404_NOT_FOUND)


class StaffResetPasswordView(APIView):
    authentication_classes = [SupportJWTAuthentication]
    permission_classes = [CanManageStaff]

    def post(self, request, pk):
        staff = staff_selectors.get_staff_by_id(pk)
        if not staff:
            return fail("Staff not found.", status_code=status.HTTP_404_NOT_FOUND)
        new_password = request.data.get("new_password")
        if not new_password or len(new_password) < 8:
            return fail("new_password must be at least 8 characters.", status_code=status.HTTP_400_BAD_REQUEST)
        staff_service.reset_staff_password(staff, new_password)
        ip, ua = _get_client_info(request)
        audit_service.log_audit(
            actor=request.support_staff,
            action="reset_staff_password",
            entity_type="support_staff",
            entity_id=staff.id,
            ip_address=ip,
            user_agent=ua,
        )
        return ok(message="Password reset successfully.", status_code=status.HTTP_200_OK)


# ---------------------------------------------------------------------------
# Complaint views
# ---------------------------------------------------------------------------

class ComplaintListView(APIView):
    authentication_classes = [SupportJWTAuthentication]
    permission_classes = [IsSupportStaff]

    def get(self, request):
        status_filter = request.query_params.get("status")
        category_filter = request.query_params.get("category")
        priority_filter = request.query_params.get("priority")
        query = request.query_params.get("q")

        qs, total = complaint_selectors.search_complaints(
            query=query,
            status=status_filter,
            category=category_filter,
            priority=priority_filter,
        )
        return paginated(qs, request, ComplaintListSerializer, context={"viewer": None})


class ComplaintDetailView(APIView):
    authentication_classes = [SupportJWTAuthentication]
    permission_classes = [IsSupportStaff]

    def get(self, request, complaint_id):
        complaint = complaint_selectors.get_complaint_by_id(complaint_id)
        if not complaint:
            return fail("Complaint not found.", status_code=status.HTTP_404_NOT_FOUND)
        serializer = ComplaintDetailSerializer(complaint, context={"request": request, "viewer": None})
        return ok(serializer.data, status_code=status.HTTP_200_OK)


class ComplaintAssignView(APIView):
    authentication_classes = [SupportJWTAuthentication]
    permission_classes = [IsSupportAgent]

    def post(self, request, complaint_id):
        assigned_to_id = request.data.get("assigned_to")
        if not assigned_to_id:
            return fail("assigned_to is required.", status_code=status.HTTP_400_BAD_REQUEST)
        try:
            complaint, assignment = complaint_service.assign_complaint(
                complaint_id, assigned_to_id, request.support_staff
            )
            ip, ua = _get_client_info(request)
            audit_service.log_audit(
                actor=request.support_staff,
                action="assign_complaint",
                entity_type="complaint",
                entity_id=complaint.id,
                ip_address=ip,
                user_agent=ua,
            )
            return ok({"complaint_id": complaint.id, "assigned_to_id": assigned_to_id}, message="Complaint assigned.", status_code=status.HTTP_200_OK)
        except ValueError as exc:
            return fail(str(exc), status_code=status.HTTP_400_BAD_REQUEST)


class ComplaintReplyView(APIView):
    authentication_classes = [SupportJWTAuthentication]
    permission_classes = [IsSupportStaff]

    def post(self, request, complaint_id):
        text = request.data.get("text")
        visibility = request.data.get("visibility", ComplaintMessage.VISIBILITY_SHARED)
        if not text:
            return fail("text is required.", status_code=status.HTTP_400_BAD_REQUEST)
        try:
            message = complaint_service.reply_to_complaint(
                complaint_id, text, request.support_staff, visibility=visibility
            )
            ip, ua = _get_client_info(request)
            audit_service.log_audit(
                actor=request.support_staff,
                action="reply_complaint",
                entity_type="complaint",
                entity_id=complaint_id,
                ip_address=ip,
                user_agent=ua,
            )
            from complaints.serializers import ComplaintMessageSerializer
            message_data = ComplaintMessageSerializer(message, context={"request": request}).data
            from complaints.realtime import broadcast_complaint_event
            broadcast_complaint_event(
                complaint_id, "complaint_message", message_data, visibility=message.visibility
            )
            return ok(message_data, message="Reply sent.", status_code=status.HTTP_201_CREATED)
        except ValueError as exc:
            return fail(str(exc), status_code=status.HTTP_400_BAD_REQUEST)


class ComplaintInternalNoteView(APIView):
    authentication_classes = [SupportJWTAuthentication]
    permission_classes = [IsSupportStaff]

    def get(self, request, complaint_id):
        from django.contrib.contenttypes.models import ContentType
        ct = ContentType.objects.get_for_model(Complaint)
        notes = InternalNote.objects.filter(content_type=ct, object_id=complaint_id, is_deleted=False).select_related("created_by__user")
        from .serializers import InternalNoteSerializer
        serializer = InternalNoteSerializer(notes, many=True)
        return ok({"results": serializer.data}, status_code=status.HTTP_200_OK)

    def post(self, request, complaint_id):
        serializer = InternalNoteCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return fail("Validation failed.", errors=serializer.errors, status_code=status.HTTP_400_BAD_REQUEST)
        try:
            note = complaint_service.add_internal_note(
                complaint_id, serializer.validated_data["body"], request.support_staff, serializer.validated_data.get("is_pinned", False)
            )
            ip, ua = _get_client_info(request)
            audit_service.log_audit(
                actor=request.support_staff,
                action="add_internal_note",
                entity_type="complaint",
                entity_id=complaint_id,
                ip_address=ip,
                user_agent=ua,
            )
            from .serializers import InternalNoteSerializer
            return ok(InternalNoteSerializer(note).data, message="Internal note added.", status_code=status.HTTP_201_CREATED)
        except ValueError as exc:
            return fail(str(exc), status_code=status.HTTP_400_BAD_REQUEST)


class ComplaintStatusUpdateView(APIView):
    authentication_classes = [SupportJWTAuthentication]
    permission_classes = [IsSupportAgent]

    def post(self, request, complaint_id):
        new_status = request.data.get("status")
        note = request.data.get("note")
        if not new_status:
            return fail("status is required.", status_code=status.HTTP_400_BAD_REQUEST)
        try:
            complaint = complaint_service.update_complaint_status(complaint_id, new_status, "platform", note=note)
            ip, ua = _get_client_info(request)
            audit_service.log_audit(
                actor=request.support_staff,
                action="update_complaint_status",
                entity_type="complaint",
                entity_id=complaint.id,
                ip_address=ip,
                user_agent=ua,
            )
            serializer = ComplaintDetailSerializer(complaint, context={"request": request, "viewer": None})
            return ok(serializer.data, message="Complaint status updated.", status_code=status.HTTP_200_OK)
        except ValueError as exc:
            return fail(str(exc), status_code=status.HTTP_400_BAD_REQUEST)


class ComplaintBulkAssignView(APIView):
    authentication_classes = [SupportJWTAuthentication]
    permission_classes = [CanBulkAssign]

    def post(self, request):
        complaint_ids = request.data.get("complaint_ids", [])
        assigned_to_id = request.data.get("assigned_to")
        if not complaint_ids or not assigned_to_id:
            return fail("complaint_ids and assigned_to are required.", status_code=status.HTTP_400_BAD_REQUEST)
        results = complaint_service.bulk_assign_complaints(complaint_ids, assigned_to_id, request.support_staff)
        ip, ua = _get_client_info(request)
        audit_service.log_audit(
            actor=request.support_staff,
            action="bulk_assign_complaints",
            entity_type="complaint",
            entity_id=",".join(map(str, complaint_ids)),
            ip_address=ip,
            user_agent=ua,
        )
        return ok({"results": results}, message="Bulk assign completed.", status_code=status.HTTP_200_OK)


class ComplaintBulkCloseView(APIView):
    authentication_classes = [SupportJWTAuthentication]
    permission_classes = [CanBulkAssign]

    def post(self, request):
        complaint_ids = request.data.get("complaint_ids", [])
        if not complaint_ids:
            return fail("complaint_ids is required.", status_code=status.HTTP_400_BAD_REQUEST)
        results = complaint_service.bulk_close_complaints(complaint_ids, "platform")
        ip, ua = _get_client_info(request)
        audit_service.log_audit(
            actor=request.support_staff,
            action="bulk_close_complaints",
            entity_type="complaint",
            entity_id=",".join(map(str, complaint_ids)),
            ip_address=ip,
            user_agent=ua,
        )
        return ok({"results": results}, message="Bulk close completed.", status_code=status.HTTP_200_OK)


# ---------------------------------------------------------------------------
# Ticket views
# ---------------------------------------------------------------------------

class TicketListView(APIView):
    authentication_classes = [SupportJWTAuthentication]
    permission_classes = [IsSupportStaff]

    def get(self, request):
        status_filter = request.query_params.get("status")
        category_filter = request.query_params.get("category")
        priority_filter = request.query_params.get("priority")
        query = request.query_params.get("q")

        qs, total = ticket_selectors.search_tickets(
            query=query,
            status=status_filter,
            category=category_filter,
            priority=priority_filter,
        )
        tickets = qs.select_related("requester_user", "requester_store").prefetch_related("messages")
        data = []
        for ticket in tickets:
            data.append({
                "id": ticket.id,
                "category": ticket.category,
                "category_display": ticket.get_category_display(),
                "subject": ticket.subject,
                "priority": ticket.priority,
                "priority_display": ticket.get_priority_display(),
                "status": ticket.status,
                "status_display": ticket.get_status_display(),
                "requester_type": ticket.requester_type,
                "requester_name": (
                    ticket.requester_store.name if ticket.requester_store else
                    ticket.requester_user.name if ticket.requester_user else "Unknown requester"
                ),
                "assigned_to": ticket.assigned_to or None,
                "resolution_note": ticket.resolution_note or None,
                "resolved_at": ticket.resolved_at,
                "created_at": ticket.created_at,
                "updated_at": ticket.updated_at,
                "message_count": ticket.messages.count(),
                "unread_count": ticket.messages.filter(is_read=False).exclude(sender_type="platform").count(),
            })
        paginator = SupportPagination()
        page = paginator.paginate_queryset(data, request)
        if page is not None:
            response_data = {
                "results": page,
                "pagination": {
                    "page": paginator.page.number,
                    "page_size": paginator.page_size,
                    "total_pages": paginator.page.paginator.num_pages,
                    "total_count": paginator.page.paginator.count,
                },
            }
            return ok(response_data, status_code=status.HTTP_200_OK)
        response_data = {
            "results": data,
            "pagination": {
                "page": 1,
                "page_size": len(data),
                "total_pages": 1,
                "total_count": len(data),
            },
        }
        return ok(response_data, status_code=status.HTTP_200_OK)


class TicketDetailView(APIView):
    authentication_classes = [SupportJWTAuthentication]
    permission_classes = [IsSupportStaff]

    def get(self, request, ticket_id):
        ticket = ticket_selectors.get_ticket_by_id(ticket_id)
        if not ticket:
            return fail("Support ticket not found.", status_code=status.HTTP_404_NOT_FOUND)
        ticket.messages.filter(is_read=False).exclude(sender_type="platform").update(is_read=True)
        messages = ticket.messages.select_related("sender_user", "sender_store").order_by("created_at")
        data = {
            "id": ticket.id,
            "category": ticket.category,
            "category_display": ticket.get_category_display(),
            "subject": ticket.subject,
            "description": ticket.description,
            "priority": ticket.priority,
            "priority_display": ticket.get_priority_display(),
            "status": ticket.status,
            "status_display": ticket.get_status_display(),
            "requester_type": ticket.requester_type,
            "requester_name": (
                ticket.requester_store.name if ticket.requester_store else
                ticket.requester_user.name if ticket.requester_user else "Unknown requester"
            ),
            "assigned_to": ticket.assigned_to or None,
            "resolution_note": ticket.resolution_note or None,
            "resolved_at": ticket.resolved_at,
            "created_at": ticket.created_at,
            "updated_at": ticket.updated_at,
            "message_count": ticket.messages.count(),
            "unread_count": ticket.messages.filter(is_read=False).exclude(sender_type="platform").count(),
            "messages": [{
                "id": m.id,
                "sender_type": m.sender_type,
                "sender_name": (
                    m.sender_store.name if m.sender_store else
                    m.sender_user.name if m.sender_user else "AARX Support"
                ),
                "text": m.text,
                "attachment": m.attachment.url if m.attachment else None,
                "is_read": m.is_read,
                "created_at": m.created_at,
            } for m in messages],
        }
        return ok(data, status_code=status.HTTP_200_OK)


class TicketReplyView(APIView):
    authentication_classes = [SupportJWTAuthentication]
    permission_classes = [IsSupportStaff]

    def post(self, request, ticket_id):
        text = request.data.get("text")
        if not text:
            return fail("text is required.", status_code=status.HTTP_400_BAD_REQUEST)
        try:
            message, ticket = ticket_service.reply_to_ticket(ticket_id, text, request.support_staff)
            ip, ua = _get_client_info(request)
            audit_service.log_audit(
                actor=request.support_staff,
                action="reply_ticket",
                entity_type="support_ticket",
                entity_id=ticket.id,
                ip_address=ip,
                user_agent=ua,
            )
            data = {
                "id": message.id,
                "sender_type": message.sender_type,
                "sender_name": "AARX Support",
                "text": message.text,
                "attachment": message.attachment.url if message.attachment else None,
                "is_read": message.is_read,
                "created_at": message.created_at.isoformat(),
            }
            from complaints.realtime import broadcast_support_ticket_event
            broadcast_support_ticket_event(ticket.id, "support_ticket_message", data)
            return ok(data, message="Reply sent.", status_code=status.HTTP_201_CREATED)
        except ValueError as exc:
            return fail(str(exc), status_code=status.HTTP_400_BAD_REQUEST)


class TicketStatusUpdateView(APIView):
    authentication_classes = [SupportJWTAuthentication]
    permission_classes = [IsSupportAgent]

    def post(self, request, ticket_id):
        new_status = request.data.get("status")
        resolution_note = request.data.get("resolution_note")
        if not new_status:
            return fail("status is required.", status_code=status.HTTP_400_BAD_REQUEST)
        try:
            ticket = ticket_service.update_ticket_status(ticket_id, new_status, request.support_staff, resolution_note=resolution_note)
            ip, ua = _get_client_info(request)
            audit_service.log_audit(
                actor=request.support_staff,
                action="update_ticket_status",
                entity_type="support_ticket",
                entity_id=ticket.id,
                ip_address=ip,
                user_agent=ua,
            )
            data = {
                "id": ticket.id,
                "status": ticket.status,
                "status_display": ticket.get_status_display(),
                "resolution_note": ticket.resolution_note,
                "resolved_at": ticket.resolved_at.isoformat() if ticket.resolved_at else None,
                "updated_at": ticket.updated_at.isoformat(),
            }
            from complaints.realtime import broadcast_support_ticket_event
            broadcast_support_ticket_event(ticket.id, "support_ticket_updated", data)
            return ok(data, message="Ticket status updated.", status_code=status.HTTP_200_OK)
        except ValueError as exc:
            return fail(str(exc), status_code=status.HTTP_400_BAD_REQUEST)


# ---------------------------------------------------------------------------
# Refund views
# ---------------------------------------------------------------------------

class RefundListCreateView(APIView):
    authentication_classes = [SupportJWTAuthentication]
    permission_classes = [IsSupportStaff]

    def get(self, request):
        status_filter = request.query_params.get("status")
        assigned_to_filter = request.query_params.get("assigned_to")
        qs, total = refund_selectors.search_refunds(
            status=status_filter,
            assigned_to=assigned_to_filter,
        )
        from .serializers import RefundRequestSerializer
        return paginated(qs, request, RefundRequestSerializer)

    def post(self, request):
        serializer = RefundRequestCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return fail("Validation failed.", errors=serializer.errors, status_code=status.HTTP_400_BAD_REQUEST)
        try:
            refund = refund_service.create_refund_request(
                charge_id=serializer.validated_data["charge_id"],
                amount=serializer.validated_data["amount"],
                reason=serializer.validated_data["reason"],
                requested_by=request.support_staff,
                prescription_response_id=serializer.validated_data.get("prescription_response_id"),
            )
            ip, ua = _get_client_info(request)
            audit_service.log_audit(
                actor=request.support_staff,
                action="create_refund",
                entity_type="refund_request",
                entity_id=refund.id,
                ip_address=ip,
                user_agent=ua,
            )
            from .serializers import RefundRequestSerializer
            return ok(RefundRequestSerializer(refund).data, message="Refund request created.", status_code=status.HTTP_201_CREATED)
        except ValueError as exc:
            return fail(str(exc), status_code=status.HTTP_400_BAD_REQUEST)


class RefundDetailView(APIView):
    authentication_classes = [SupportJWTAuthentication]
    permission_classes = [IsSupportStaff]

    def get(self, request, pk):
        refund = refund_selectors.get_refund_by_id(pk)
        if not refund:
            return fail("Refund not found.", status_code=status.HTTP_404_NOT_FOUND)
        from .serializers import RefundRequestSerializer
        return ok(RefundRequestSerializer(refund).data, status_code=status.HTTP_200_OK)


class RefundReviewView(APIView):
    authentication_classes = [SupportJWTAuthentication]
    permission_classes = [CanApproveRefund]

    def post(self, request, pk):
        serializer = RefundReviewSerializer(data=request.data)
        if not serializer.is_valid():
            return fail("Validation failed.", errors=serializer.errors, status_code=status.HTTP_400_BAD_REQUEST)
        try:
            refund = refund_service.review_refund(
                refund_id=pk,
                action=serializer.validated_data["action"],
                admin=request.support_staff,
                admin_note=serializer.validated_data.get("admin_note"),
                payment_reference=serializer.validated_data.get("payment_reference"),
            )
            ip, ua = _get_client_info(request)
            audit_service.log_audit(
                actor=request.support_staff,
                action=f"refund_{refund.status}",
                entity_type="refund_request",
                entity_id=refund.id,
                ip_address=ip,
                user_agent=ua,
            )
            from .serializers import RefundRequestSerializer
            return ok(RefundRequestSerializer(refund).data, message=f"Refund {refund.status}.", status_code=status.HTTP_200_OK)
        except ValueError as exc:
            return fail(str(exc), status_code=status.HTTP_400_BAD_REQUEST)


# ---------------------------------------------------------------------------
# Safety report views
# ---------------------------------------------------------------------------

class SafetyReportActionView(APIView):
    authentication_classes = [SupportJWTAuthentication]
    permission_classes = [IsSupportAdmin]

    def post(self, request, report_id):
        serializer = SafetyReportActionCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return fail("Validation failed.", errors=serializer.errors, status_code=status.HTTP_400_BAD_REQUEST)
        try:
            action_obj = safety_service.create_safety_report_action(
                report_id=report_id,
                action=serializer.validated_data["action"],
                admin=request.support_staff,
                note=serializer.validated_data["note"],
                target_user_id=serializer.validated_data.get("target_user_id"),
                target_store_id=serializer.validated_data.get("target_store_id"),
            )
            ip, ua = _get_client_info(request)
            audit_service.log_audit(
                actor=request.support_staff,
                action="safety_report_action",
                entity_type="safety_report",
                entity_id=report_id,
                ip_address=ip,
                user_agent=ua,
            )
            from .serializers import SafetyReportActionSerializer
            return ok(SafetyReportActionSerializer(action_obj).data, message="Action recorded.", status_code=status.HTTP_201_CREATED)
        except ValueError as exc:
            return fail(str(exc), status_code=status.HTTP_400_BAD_REQUEST)


class SafetyReportListView(APIView):
    authentication_classes = [SupportJWTAuthentication]
    permission_classes = [IsSupportStaff]

    def get(self, request):
        status_filter = request.query_params.get("status")
        category_filter = request.query_params.get("category")
        query = request.query_params.get("q")
        page = int(request.query_params.get("page", 1))
        page_size = int(request.query_params.get("page_size", 20))

        results, total = safety_selectors.search_safety_reports(
            query=query,
            status=status_filter,
            category=category_filter,
            page=page,
            page_size=page_size,
        )
        serializer = SafetyReportSerializer(results, many=True)
        data = {
            "results": serializer.data,
            "pagination": {
                "page": page,
                "page_size": page_size,
                "total_pages": (total + page_size - 1) // page_size,
                "total_count": total,
            },
        }
        return ok(data, status_code=status.HTTP_200_OK)


class SafetyReportDetailView(APIView):
    authentication_classes = [SupportJWTAuthentication]
    permission_classes = [IsSupportStaff]

    def get(self, request, pk):
        report = safety_selectors.get_safety_report_by_id(pk)
        if not report:
            return fail("Safety report not found.", status_code=status.HTTP_404_NOT_FOUND)
        serializer = SafetyReportSerializer(report)
        return ok(serializer.data, status_code=status.HTTP_200_OK)


# ---------------------------------------------------------------------------
# User lookup views
# ---------------------------------------------------------------------------

class UserLookupView(APIView):
    authentication_classes = [SupportJWTAuthentication]
    permission_classes = [IsSupportStaff]

    def get(self, request):
        query = request.query_params.get("q")
        user_id = request.query_params.get("user_id")
        users = lookup_service.lookup_users(query=query, user_id=user_id)
        if not users:
            return ok({"results": []}, status_code=status.HTTP_200_OK)
        serializer = UserSerializer(users, many=True)
        return ok({"results": serializer.data}, status_code=status.HTTP_200_OK)


class UserDetailView(APIView):
    authentication_classes = [SupportJWTAuthentication]
    permission_classes = [IsSupportStaff]

    def get(self, request, user_id):
        user = lookup_selectors.get_user_by_id(user_id)
        if not user:
            return fail("User not found.", status_code=status.HTTP_404_NOT_FOUND)
        serializer = UserProfileSerializer(user)
        return ok(serializer.data, status_code=status.HTTP_200_OK)


# ---------------------------------------------------------------------------
# Store lookup views
# ---------------------------------------------------------------------------

class StoreLookupView(APIView):
    authentication_classes = [SupportJWTAuthentication]
    permission_classes = [IsSupportStaff]

    def get(self, request):
        query = request.query_params.get("q")
        store_id = request.query_params.get("store_id")
        stores = lookup_service.lookup_stores(query=query, store_id=store_id)
        if not stores:
            return ok({"results": []}, status_code=status.HTTP_200_OK)
        serializer = StoreSerializer(stores, many=True)
        return ok({"results": serializer.data}, status_code=status.HTTP_200_OK)


class StoreDetailView(APIView):
    authentication_classes = [SupportJWTAuthentication]
    permission_classes = [IsSupportStaff]

    def get(self, request, store_id):
        store = lookup_selectors.get_store_by_id(store_id)
        if not store:
            return fail("Store not found.", status_code=status.HTTP_404_NOT_FOUND)
        serializer = StoreProfileSerializer(store)
        return ok(serializer.data, status_code=status.HTTP_200_OK)


# ---------------------------------------------------------------------------
# Notification views
# ---------------------------------------------------------------------------

class NotificationListView(APIView):
    authentication_classes = [SupportJWTAuthentication]
    permission_classes = [IsSupportStaff]

    def get(self, request):
        staff = request.support_staff
        filters = {
            "is_read": request.query_params.get("is_read"),
            "notification_type": request.query_params.get("notification_type"),
        }
        qs, total = notification_selectors.search_notifications(staff, is_read=filters.get("is_read"), notification_type=filters.get("notification_type"))
        return paginated(qs, request, SupportNotificationSerializer)


class NotificationMarkReadView(APIView):
    authentication_classes = [SupportJWTAuthentication]
    permission_classes = [IsSupportStaff]

    def post(self, request, notification_id):
        try:
            notification = notification_service.mark_notification_read(request.support_staff, notification_id)
            return ok(SupportNotificationSerializer(notification).data, message="Marked as read.", status_code=status.HTTP_200_OK)
        except ValueError as exc:
            return fail(str(exc), status_code=status.HTTP_404_NOT_FOUND)


class NotificationUnreadCountView(APIView):
    authentication_classes = [SupportJWTAuthentication]
    permission_classes = [IsSupportStaff]

    def get(self, request):
        count = notification_service.get_unread_count(request.support_staff)
        return ok({"unread_count": count}, status_code=status.HTTP_200_OK)


# ---------------------------------------------------------------------------
# Audit log views
# ---------------------------------------------------------------------------

class AuditLogListView(APIView):
    authentication_classes = [SupportJWTAuthentication]
    permission_classes = [CanViewAuditLogs]

    def get(self, request):
        filters = {
            "actor": request.query_params.get("actor"),
            "action": request.query_params.get("action"),
            "entity_type": request.query_params.get("entity_type"),
            "entity_id": request.query_params.get("entity_id"),
            "created_from": request.query_params.get("created_from"),
            "created_to": request.query_params.get("created_to"),
        }
        qs, total = audit_selectors.search_audit_logs(**{k: v for k, v in filters.items() if v})
        return paginated(qs, request, SupportAuditLogSerializer)
