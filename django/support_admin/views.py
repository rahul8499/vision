from django.conf import settings
from django.db import transaction
from django.db.models import Case, IntegerField, Q, Value, When
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
from emergency_services.models import (
    City, CityEmergencyPolicy, EmergencyBroadcastCharge, EmergencyFeePolicy, ServiceZone,
)
from subscription.models import PaymentHistory
from prescription.models import PrescriptionTargetStore


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
        try:
            qs = _scope_queryset(qs, request.support_staff, _requested_city(request, request.support_staff))
        except ValueError as exc:
            return fail(str(exc), status_code=status.HTTP_400_BAD_REQUEST)
        except PermissionError as exc:
            return fail(str(exc), status_code=status.HTTP_403_FORBIDDEN)
        return paginated(qs, request, ComplaintListSerializer, context={"viewer": None})


class ComplaintDetailView(APIView):
    authentication_classes = [SupportJWTAuthentication]
    permission_classes = [IsSupportStaff]

    def get(self, request, complaint_id):
        complaint = complaint_selectors.get_complaint_by_id(complaint_id)
        if not complaint:
            return fail("Complaint not found.", status_code=status.HTTP_404_NOT_FOUND)
        if not _can_access_scope(complaint, request.support_staff):
            return fail("You do not have access to this complaint.", status_code=status.HTTP_403_FORBIDDEN)
        serializer = ComplaintDetailSerializer(complaint, context={"request": request, "viewer": None})
        return ok(serializer.data, status_code=status.HTTP_200_OK)


class ComplaintAssignView(APIView):
    authentication_classes = [SupportJWTAuthentication]
    permission_classes = [IsSupportAgent]

    def post(self, request, complaint_id):
        complaint = complaint_selectors.get_complaint_by_id(complaint_id)
        if not complaint or not _can_access_scope(complaint, request.support_staff):
            return fail("Complaint not found.", status_code=status.HTTP_404_NOT_FOUND)
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
        complaint = complaint_selectors.get_complaint_by_id(complaint_id)
        if not complaint or not _can_access_scope(complaint, request.support_staff):
            return fail("Complaint not found.", status_code=status.HTTP_404_NOT_FOUND)
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
        complaint = complaint_selectors.get_complaint_by_id(complaint_id)
        if not complaint or not _can_access_scope(complaint, request.support_staff):
            return fail("Complaint not found.", status_code=status.HTTP_404_NOT_FOUND)
        from django.contrib.contenttypes.models import ContentType
        ct = ContentType.objects.get_for_model(Complaint)
        notes = InternalNote.objects.filter(content_type=ct, object_id=complaint_id, is_deleted=False).select_related("created_by__user")
        from .serializers import InternalNoteSerializer
        serializer = InternalNoteSerializer(notes, many=True)
        return ok({"results": serializer.data}, status_code=status.HTTP_200_OK)

    def post(self, request, complaint_id):
        complaint = complaint_selectors.get_complaint_by_id(complaint_id)
        if not complaint or not _can_access_scope(complaint, request.support_staff):
            return fail("Complaint not found.", status_code=status.HTTP_404_NOT_FOUND)
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
        existing = complaint_selectors.get_complaint_by_id(complaint_id)
        if not existing or not _can_access_scope(existing, request.support_staff):
            return fail("Complaint not found.", status_code=status.HTTP_404_NOT_FOUND)
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
        permitted_ids = list(_scope_queryset(
            Complaint.objects.filter(id__in=complaint_ids), request.support_staff
        ).values_list("id", flat=True))
        if len(set(map(int, complaint_ids))) != len(set(permitted_ids)):
            return fail("One or more complaints are outside your city access.", status_code=status.HTTP_403_FORBIDDEN)
        results = complaint_service.bulk_assign_complaints(permitted_ids, assigned_to_id, request.support_staff)
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
        permitted_ids = list(_scope_queryset(
            Complaint.objects.filter(id__in=complaint_ids), request.support_staff
        ).values_list("id", flat=True))
        if len(set(map(int, complaint_ids))) != len(set(permitted_ids)):
            return fail("One or more complaints are outside your city access.", status_code=status.HTTP_403_FORBIDDEN)
        results = complaint_service.bulk_close_complaints(permitted_ids, "platform")
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
        try:
            qs = _scope_queryset(
                qs, request.support_staff,
                _requested_city(request, request.support_staff),
                include_global=True,
            )
        except ValueError as exc:
            return fail(str(exc), status_code=status.HTTP_400_BAD_REQUEST)
        except PermissionError as exc:
            return fail(str(exc), status_code=status.HTTP_403_FORBIDDEN)
        tickets = qs.select_related("requester_user", "requester_store").prefetch_related("messages")
        data = []
        for ticket in tickets:
            data.append({
                "id": ticket.id,
                "scope": ticket.scope,
                "city": ticket.city_id,
                "city_name": ticket.city.name if ticket.city else None,
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
        if not _can_access_scope(ticket, request.support_staff):
            return fail("Support ticket not found.", status_code=status.HTTP_404_NOT_FOUND)
        ticket.messages.filter(is_read=False).exclude(sender_type="platform").update(is_read=True)
        messages = ticket.messages.select_related("sender_user", "sender_store").order_by("created_at")
        data = {
            "id": ticket.id,
            "scope": ticket.scope,
            "city": ticket.city_id,
            "city_name": ticket.city.name if ticket.city else None,
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
        ticket_access = ticket_selectors.get_ticket_by_id(ticket_id)
        if not ticket_access or not _can_access_scope(ticket_access, request.support_staff):
            return fail("Support ticket not found.", status_code=status.HTTP_404_NOT_FOUND)
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
        ticket_access = ticket_selectors.get_ticket_by_id(ticket_id)
        if not ticket_access or not _can_access_scope(ticket_access, request.support_staff):
            return fail("Support ticket not found.", status_code=status.HTTP_404_NOT_FOUND)
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
# Emergency monitoring
# ---------------------------------------------------------------------------

def _staff_city_ids(staff):
    if staff.role == SupportStaff.ROLE_ADMIN or staff.all_cities_access:
        return None
    return list(staff.cities.values_list("id", flat=True))


def _requested_city(request, staff):
    value = request.query_params.get("city")
    if not value:
        return None
    try:
        city_id = int(value)
    except (TypeError, ValueError):
        raise ValueError("Invalid city filter.")
    allowed = _staff_city_ids(staff)
    if allowed is not None and city_id not in allowed:
        raise PermissionError("You do not have access to this city.")
    return city_id


def _scope_queryset(qs, staff, city_id=None, include_global=False):
    allowed = _staff_city_ids(staff)
    if city_id:
        scoped = Q(city_id=city_id)
        return qs.filter(scoped | Q(scope="GLOBAL") if include_global else scoped)
    if allowed is None:
        return qs
    scoped = Q(city_id__in=allowed)
    return qs.filter(scoped | Q(scope="GLOBAL") if include_global else scoped)


def _can_access_scope(obj, staff):
    if getattr(obj, "scope", "CITY") == "GLOBAL":
        return True
    allowed = _staff_city_ids(staff)
    return allowed is None or obj.city_id in allowed


def _can_access_city_id(city_id, staff):
    allowed = _staff_city_ids(staff)
    return allowed is None or city_id in allowed


class EmergencyMonitoringView(APIView):
    authentication_classes = [SupportJWTAuthentication]
    permission_classes = [IsSupportStaff]

    def get(self, request):
        city_ids = _staff_city_ids(request.support_staff)
        city_filter = request.query_params.get("city")
        request_type = request.query_params.get("request_type")
        mode = request.query_params.get("mode", "active")
        status_filter = request.query_params.get("status", "awaiting")
        qs = PrescriptionTargetStore.objects.filter(
            prescription__status__in=("emergency", "normal"),
        ).select_related("prescription", "store", "city", "service_zone")
        if mode == "active":
            qs = qs.filter(prescription__dispatch_status="active")
        elif mode == "history":
            qs = qs.exclude(prescription__dispatch_status="active")
        if request_type in ("emergency", "normal"):
            qs = qs.filter(prescription__status=request_type)
        if city_ids is not None:
            qs = qs.filter(city_id__in=city_ids)
        if city_filter:
            if city_ids is not None and int(city_filter) not in city_ids:
                return fail("You do not have access to this city.", status_code=status.HTTP_403_FORBIDDEN)
            qs = qs.filter(city_id=city_filter)
        zone_filter = request.query_params.get("service_zone")
        if zone_filter:
            qs = qs.filter(service_zone_id=zone_filter)
        search = (request.query_params.get("search") or "").strip()
        if search:
            search_filter = Q(store__name__icontains=search) | Q(store__mobile__icontains=search)
            if search.isdigit():
                search_filter |= Q(prescription_id=int(search))
            qs = qs.filter(search_filter)
        date_from = request.query_params.get("date_from")
        date_to = request.query_params.get("date_to")
        if date_from:
            qs = qs.filter(notified_at__date__gte=date_from)
        if date_to:
            qs = qs.filter(notified_at__date__lte=date_to)
        push_filter = request.query_params.get("push")
        if push_filter == "available":
            qs = qs.exclude(store__expo_push_token__isnull=True).exclude(store__expo_push_token="")
        elif push_filter == "unavailable":
            qs = qs.filter(Q(store__expo_push_token__isnull=True) | Q(store__expo_push_token=""))
        waiting_minutes = request.query_params.get("waiting_minutes")
        if waiting_minutes:
            qs = qs.filter(notified_at__lte=timezone.now() - timezone.timedelta(minutes=int(waiting_minutes)))
        if request.query_params.get("reminder_due") == "true":
            qs = qs.filter(status="notified", responded_at__isnull=True, reminder_count__lt=2)
        if status_filter == "awaiting":
            qs = qs.filter(status="notified", responded_at__isnull=True)
        elif status_filter == "escalated":
            qs = qs.filter(escalated_at__isnull=False, responded_at__isnull=True)
        elif status_filter == "responded":
            qs = qs.filter(status="responded")

        now = timezone.now()
        qs = qs.annotate(
            request_priority=Case(
                When(prescription__status="emergency", then=Value(0)),
                default=Value(1), output_field=IntegerField(),
            ),
            escalation_priority=Case(
                When(escalated_at__isnull=False, then=Value(0)),
                default=Value(1), output_field=IntegerField(),
            ),
        ).order_by("escalation_priority", "request_priority", "notified_at")
        paginator = SupportPagination()
        page = paginator.paginate_queryset(qs, request)
        rows = [{
            "id": target.id,
            "prescription_id": target.prescription_id,
            "request_type": target.prescription.status,
            "store_id": target.store_id,
            "store_name": target.store.name,
            "store_mobile": target.store.mobile,
            "city_id": target.city_id,
            "city_name": target.city.name if target.city else "Unassigned",
            "service_zone_id": target.service_zone_id,
            "service_zone_name": target.service_zone.name if target.service_zone else "",
            "distance_km": target.distance_km,
            "batch_number": target.batch_number,
            "status": target.status,
            "notified_at": target.notified_at,
            "opened_at": target.opened_at,
            "responded_at": target.responded_at,
            "first_reminder_at": target.first_reminder_at,
            "second_reminder_at": target.second_reminder_at,
            "reminder_count": target.reminder_count,
            "manual_reminder_count": target.manual_reminder_count,
            "last_manual_reminder_at": target.last_manual_reminder_at,
            "reminders_suppressed_at": target.reminders_suppressed_at,
            "support_contacted_at": target.support_contacted_at,
            "escalated_at": target.escalated_at,
            "waiting_seconds": max(0, int((now - target.notified_at).total_seconds())),
            "push_available": bool(target.store.expo_push_token),
            "last_notification_error": target.last_notification_error,
            "manual_cooldown_seconds": int((target.policy_snapshot or {}).get("manual_reminder_cooldown_seconds", 120)),
        } for target in page]
        base = PrescriptionTargetStore.objects.filter(
            prescription__status__in=("emergency", "normal"),
        )
        if mode == "active":
            base = base.filter(prescription__dispatch_status="active")
        elif mode == "history":
            base = base.exclude(prescription__dispatch_status="active")
        if request_type in ("emergency", "normal"):
            base = base.filter(prescription__status=request_type)
        if city_ids is not None:
            base = base.filter(city_id__in=city_ids)
        if city_filter:
            base = base.filter(city_id=city_filter)
        return ok({
            "results": rows,
            "pagination": {
                "page": paginator.page.number,
                "page_size": paginator.get_page_size(request),
                "total_pages": paginator.page.paginator.num_pages,
                "total_count": paginator.page.paginator.count,
            },
            "summary": {
                "awaiting": base.filter(status="notified", responded_at__isnull=True).count(),
                "responded": base.filter(status="responded").count(),
                "escalated": base.filter(escalated_at__isnull=False, responded_at__isnull=True).count(),
                "push_unavailable": base.filter(store__expo_push_token__isnull=True, status="notified").count(),
            },
        })


class EmergencyMonitoringReminderView(APIView):
    authentication_classes = [SupportJWTAuthentication]
    permission_classes = [IsSupportStaff]

    def post(self, request, target_id):
        target = PrescriptionTargetStore.objects.filter(
            id=target_id, prescription__status__in=("emergency", "normal")
        ).first()
        if not target:
            return fail("Emergency dispatch not found.", status_code=status.HTTP_404_NOT_FOUND)
        city_ids = _staff_city_ids(request.support_staff)
        if city_ids is not None and target.city_id not in city_ids:
            return fail("You do not have access to this city.", status_code=status.HTTP_403_FORBIDDEN)
        if target.reminders_suppressed_at:
            return fail("Reminders are suppressed for this store dispatch.")
        policy = target.policy_snapshot or {}
        cooldown = int(policy.get("manual_reminder_cooldown_seconds", 120))
        if target.last_manual_reminder_at:
            remaining = cooldown - int((timezone.now() - target.last_manual_reminder_at).total_seconds())
            if remaining > 0:
                return fail(f"Reminder cooldown active. Try again in {remaining} seconds.", code="REMINDER_COOLDOWN", status_code=status.HTTP_429_TOO_MANY_REQUESTS)
        from prescription.models import AppNotification
        sent_today = AppNotification.objects.filter(
            recipient_store=target.store,
            notification_type="MANUAL_QUOTE_REMINDER",
            created_at__date=timezone.localdate(),
        ).count()
        if sent_today >= int(policy.get("manual_reminder_daily_limit", 10)):
            return fail("This store has reached its daily manual reminder limit.", code="REMINDER_DAILY_LIMIT", status_code=status.HTTP_429_TOO_MANY_REQUESTS)
        from prescription.tasks import monitor_emergency_store_response_task
        monitor_emergency_store_response_task.delay(target.id, "manual")
        ip, ua = _get_client_info(request)
        audit_service.log_audit(
            actor=request.support_staff, action="manual_store_reminder",
            entity_type="prescription_dispatch", entity_id=target.id,
            ip_address=ip, user_agent=ua,
        )
        return ok({"queued": True}, message="Store reminder queued.")


class EmergencyMonitoringActionView(APIView):
    authentication_classes = [SupportJWTAuthentication]
    permission_classes = [IsSupportStaff]

    def post(self, request, target_id):
        target = PrescriptionTargetStore.objects.filter(id=target_id).first()
        if not target:
            return fail("Dispatch not found.", status_code=status.HTTP_404_NOT_FOUND)
        city_ids = _staff_city_ids(request.support_staff)
        if city_ids is not None and target.city_id not in city_ids:
            return fail("You do not have access to this city.", status_code=status.HTTP_403_FORBIDDEN)
        action = request.data.get("action")
        now = timezone.now()
        if action == "mark_contacted":
            target.support_contacted_at = now
            target.support_contacted_by_id = request.support_staff.id
            fields = ["support_contacted_at", "support_contacted_by_id"]
        elif action == "suppress_reminders":
            target.reminders_suppressed_at = now
            target.reminders_suppressed_by_id = request.support_staff.id
            fields = ["reminders_suppressed_at", "reminders_suppressed_by_id"]
        elif action == "resume_reminders":
            target.reminders_suppressed_at = None
            target.reminders_suppressed_by_id = None
            fields = ["reminders_suppressed_at", "reminders_suppressed_by_id"]
        else:
            return fail("Invalid monitoring action.")
        target.save(update_fields=fields)
        from .realtime import broadcast_monitoring_event
        broadcast_monitoring_event(
            action,
            target_id=target.id,
            prescription_id=target.prescription_id,
            city_id=target.city_id,
        )
        ip, ua = _get_client_info(request)
        audit_service.log_audit(
            actor=request.support_staff, action=action,
            entity_type="prescription_dispatch", entity_id=target.id,
            ip_address=ip, user_agent=ua,
        )
        return ok({"updated": True}, message="Monitoring action saved.")


class EmergencyCityListView(APIView):
    authentication_classes = [SupportJWTAuthentication]
    permission_classes = [IsSupportStaff]

    def get(self, request):
        qs = City.objects.filter(is_active=True).prefetch_related("service_zones")
        city_ids = _staff_city_ids(request.support_staff)
        if city_ids is not None:
            qs = qs.filter(id__in=city_ids)
        return ok([{
            "id": city.id, "name": city.name, "state": city.state,
            "zones": [{"id": zone.id, "name": zone.name} for zone in city.service_zones.filter(is_active=True)],
        } for city in qs])


class EmergencyPolicyView(APIView):
    authentication_classes = [SupportJWTAuthentication]
    permission_classes = [IsSupportStaff]
    policy_fields = (
        "first_store_reminder_seconds", "second_store_reminder_seconds",
        "support_escalation_seconds", "max_store_reminders",
        "reminders_enabled", "support_escalation_enabled",
        "manual_reminder_cooldown_seconds", "manual_reminder_daily_limit",
    )

    def get(self, request):
        from emergency_services.services import get_effective_dispatch_policy
        city = City.objects.filter(id=request.query_params.get("city")).first() if request.query_params.get("city") else None
        zone = ServiceZone.objects.filter(id=request.query_params.get("service_zone"), city=city).first() if request.query_params.get("service_zone") else None
        request_type = request.query_params.get("request_type", "emergency")
        return ok(get_effective_dispatch_policy(city, zone, request_type))

    def patch(self, request):
        if request.support_staff.role != SupportStaff.ROLE_ADMIN:
            return fail("Only support admins can change emergency policies.", status_code=status.HTTP_403_FORBIDDEN)
        city_id = request.data.get("city")
        zone_id = request.data.get("service_zone")
        updates = {field: request.data[field] for field in self.policy_fields if field in request.data}
        request_type = request.data.get("request_type", "emergency")
        for field in (
            "first_store_reminder_seconds", "second_store_reminder_seconds",
            "support_escalation_seconds", "manual_reminder_cooldown_seconds",
        ):
            if field in updates and int(updates[field]) < 30:
                return fail(f"{field} must be at least 30 seconds.")
        if "manual_reminder_daily_limit" in updates and int(updates["manual_reminder_daily_limit"]) < 1:
            return fail("manual_reminder_daily_limit must be at least 1.")
        if not city_id:
            policy = EmergencyFeePolicy.objects.filter(enabled=True).order_by("pk").first() or EmergencyFeePolicy.objects.create()
        else:
            city = City.objects.filter(id=city_id, is_active=True).first()
            if not city:
                return fail("City not found.")
            zone = ServiceZone.objects.filter(id=zone_id, city=city).first() if zone_id else None
            policy, _ = CityEmergencyPolicy.objects.get_or_create(city=city, service_zone=zone)
        if request_type == "normal":
            updates = {
                f"normal_{field}" if field in {
                    "first_store_reminder_seconds", "second_store_reminder_seconds", "support_escalation_seconds"
                } else field: value
                for field, value in updates.items()
            }
        for field, value in updates.items():
            setattr(policy, field, value)
        prefix = "normal_" if request_type == "normal" else ""
        first = getattr(policy, f"{prefix}first_store_reminder_seconds")
        second = getattr(policy, f"{prefix}second_store_reminder_seconds")
        escalation = getattr(policy, f"{prefix}support_escalation_seconds")
        if first is not None and second is not None and first >= second:
            return fail("Second reminder must be later than the first reminder.")
        if second is not None and escalation is not None and second > escalation:
            return fail("Support escalation cannot occur before the second reminder.")
        policy.save(update_fields=[*updates.keys(), "updated_at"])
        return ok({"updated": True}, message="Emergency response policy updated.")


# ---------------------------------------------------------------------------
# Payment and refund views
# ---------------------------------------------------------------------------

class PaymentListView(APIView):
    """Read-only unified ledger for payment records owned by this application."""

    authentication_classes = [SupportJWTAuthentication]
    permission_classes = [IsSupportStaff]

    def get(self, request):
        try:
            city_id = _requested_city(request, request.support_staff)
        except ValueError as exc:
            return fail(str(exc), status_code=status.HTTP_400_BAD_REQUEST)
        except PermissionError as exc:
            return fail(str(exc), status_code=status.HTTP_403_FORBIDDEN)
        allowed_city_ids = _staff_city_ids(request.support_staff)
        source_filter = request.query_params.get("source")
        status_filter = request.query_params.get("status")
        search = (request.query_params.get("search") or "").strip().lower()
        date_from = request.query_params.get("date_from")
        date_to = request.query_params.get("date_to")

        records = []
        if source_filter in (None, "", "emergency_broadcast"):
            charges = EmergencyBroadcastCharge.objects.filter(
                kind=EmergencyBroadcastCharge.Kind.PAID,
                razorpay_payment_id__isnull=False,
            ).select_related("user", "prescription")
            if allowed_city_ids is not None:
                charges = charges.filter(city_id__in=allowed_city_ids)
            if city_id:
                charges = charges.filter(city_id=city_id)
            if date_from:
                charges = charges.filter(created_at__date__gte=date_from)
            if date_to:
                charges = charges.filter(created_at__date__lte=date_to)
            for charge in charges:
                payment_status = (
                    "refunded" if charge.status == EmergencyBroadcastCharge.Status.REFUNDED
                    else "refund_pending" if charge.status == EmergencyBroadcastCharge.Status.REFUND_PENDING
                    else "refund_failed" if charge.status == EmergencyBroadcastCharge.Status.REFUND_FAILED
                    else "paid" if charge.razorpay_payment_id
                    else "pending"
                )
                record = {
                    "id": f"emergency:{charge.id}",
                    "source": "emergency_broadcast",
                    "source_display": "Emergency broadcast",
                    "customer_type": "user",
                    "customer_id": charge.user_id,
                    "customer_name": getattr(charge.user, "name", "") or getattr(charge.user, "mobile", ""),
                    "payment_id": charge.razorpay_payment_id or "",
                    "order_id": charge.razorpay_order_id or "",
                    "amount": str(charge.amount_paise / 100),
                    "currency": charge.currency,
                    "status": payment_status,
                    "operational_status": charge.status,
                    "operational_status_display": charge.get_status_display(),
                    "reference_id": str(charge.id),
                    "refund_id": charge.razorpay_refund_id or "",
                    "city_id": charge.city_id,
                    "city_name": charge.city.name if charge.city else "Unassigned",
                    "created_at": charge.created_at,
                    "updated_at": charge.updated_at,
                }
                haystack = " ".join(str(value).lower() for value in record.values())
                if (not status_filter or payment_status == status_filter) and (not search or search in haystack):
                    records.append(record)

        if source_filter in (None, "", "store_subscription"):
            payments = PaymentHistory.objects.select_related("store__city", "subscription", "subscription__plan")
            if allowed_city_ids is not None:
                payments = payments.filter(store__city_id__in=allowed_city_ids)
            if city_id:
                payments = payments.filter(store__city_id=city_id)
            if date_from:
                payments = payments.filter(created_at__date__gte=date_from)
            if date_to:
                payments = payments.filter(created_at__date__lte=date_to)
            for payment in payments:
                normalized_status = (payment.status or "unknown").lower()
                record = {
                    "id": f"subscription:{payment.id}",
                    "source": "store_subscription",
                    "source_display": "Store subscription",
                    "customer_type": "store",
                    "customer_id": payment.store_id,
                    "customer_name": payment.store.name,
                    "payment_id": payment.razorpay_payment_id,
                    "order_id": "",
                    "amount": str(payment.amount),
                    "currency": "INR",
                    "status": normalized_status,
                    "operational_status": payment.subscription.status if payment.subscription else "",
                    "operational_status_display": payment.subscription.get_status_display() if payment.subscription else "Subscription unavailable",
                    "reference_id": payment.subscription.razorpay_subscription_id if payment.subscription else "",
                    "refund_id": "",
                    "city_id": payment.store.city_id,
                    "city_name": payment.store.city.name if payment.store.city else "Unassigned",
                    "created_at": payment.created_at,
                    "updated_at": payment.created_at,
                }
                haystack = " ".join(str(value).lower() for value in record.values())
                if (not status_filter or normalized_status == status_filter) and (not search or search in haystack):
                    records.append(record)

        records.sort(key=lambda item: item["created_at"], reverse=True)
        paginator = SupportPagination()
        page = paginator.paginate_queryset(records, request)
        emergency = EmergencyBroadcastCharge.objects.all()
        if allowed_city_ids is not None:
            emergency = emergency.filter(city_id__in=allowed_city_ids)
        if city_id:
            emergency = emergency.filter(city_id=city_id)
        summary = {
            "total_payments": len(records),
            "broadcasting": emergency.filter(status=EmergencyBroadcastCharge.Status.BROADCASTING).count(),
            "service_delivered": emergency.filter(status=EmergencyBroadcastCharge.Status.SERVICE_DELIVERED).count(),
            "refund_pending": emergency.filter(status=EmergencyBroadcastCharge.Status.REFUND_PENDING).count(),
            "refund_failed": emergency.filter(status=EmergencyBroadcastCharge.Status.REFUND_FAILED).count(),
        }
        return ok({
            "results": page,
            "pagination": {
                "page": paginator.page.number,
                "page_size": paginator.get_page_size(request),
                "total_pages": paginator.page.paginator.num_pages,
                "total_count": paginator.page.paginator.count,
            },
            "summary": summary,
        })


class RefundListCreateView(APIView):
    authentication_classes = [SupportJWTAuthentication]
    permission_classes = [IsSupportStaff]

    def get(self, request):
        try:
            city_id = _requested_city(request, request.support_staff)
        except ValueError as exc:
            return fail(str(exc), status_code=status.HTTP_400_BAD_REQUEST)
        except PermissionError as exc:
            return fail(str(exc), status_code=status.HTTP_403_FORBIDDEN)
        allowed_city_ids = _staff_city_ids(request.support_staff)
        status_filter = request.query_params.get("status")
        assigned_to_filter = request.query_params.get("assigned_to")
        date_from = request.query_params.get("date_from")
        date_to = request.query_params.get("date_to")
        search = (request.query_params.get("search") or "").strip()
        qs, total = refund_selectors.search_refunds(
            query=search,
            status=status_filter,
            assigned_to=assigned_to_filter,
        )
        if allowed_city_ids is not None:
            qs = qs.filter(charge__city_id__in=allowed_city_ids)
        if city_id:
            qs = qs.filter(charge__city_id=city_id)
        if date_from:
            qs = qs.filter(created_at__date__gte=date_from)
        if date_to:
            qs = qs.filter(created_at__date__lte=date_to)
        from .serializers import RefundRequestSerializer
        manual_models = list(qs.select_related("charge__city"))
        manual_refunds = list(RefundRequestSerializer(manual_models, many=True).data)
        manual_by_id = {item.id: item for item in manual_models}

        emergency_statuses = {
            EmergencyBroadcastCharge.Status.REFUND_PENDING,
            EmergencyBroadcastCharge.Status.REFUND_FAILED,
            EmergencyBroadcastCharge.Status.REFUNDED,
        }
        emergency_qs = EmergencyBroadcastCharge.objects.filter(
            status__in=emergency_statuses
        ).select_related("user", "prescription", "city")
        if allowed_city_ids is not None:
            emergency_qs = emergency_qs.filter(city_id__in=allowed_city_ids)
        if city_id:
            emergency_qs = emergency_qs.filter(city_id=city_id)
        if date_from:
            emergency_qs = emergency_qs.filter(created_at__date__gte=date_from)
        if date_to:
            emergency_qs = emergency_qs.filter(created_at__date__lte=date_to)
        if search:
            emergency_qs = emergency_qs.filter(
                Q(razorpay_payment_id__icontains=search)
                | Q(razorpay_refund_id__icontains=search)
                | Q(user__name__icontains=search)
                | Q(user__mobile__icontains=search)
            )
        emergency_status_map = {
            EmergencyBroadcastCharge.Status.REFUND_PENDING: "pending",
            EmergencyBroadcastCharge.Status.REFUND_FAILED: "failed",
            EmergencyBroadcastCharge.Status.REFUNDED: "processed",
        }
        if status_filter:
            matching_statuses = [
                source_status for source_status, support_status in emergency_status_map.items()
                if support_status == status_filter
            ]
            emergency_qs = emergency_qs.filter(status__in=matching_statuses)

        emergency_refunds = [
            {
                "id": str(charge.id),
                "charge": str(charge.id),
                "source": "emergency_broadcast",
                "source_display": "Emergency broadcast",
                "status": emergency_status_map[charge.status],
                "amount": str(charge.amount_paise / 100),
                "currency": charge.currency,
                "city_id": charge.city_id,
                "city_name": charge.city.name if charge.city else "Unassigned",
                "reason": charge.refund_reason or charge.failure_reason or "Automatic emergency broadcast refund",
                "requested_by": None,
                "requested_by_name": getattr(charge.user, "name", "") or getattr(charge.user, "mobile", ""),
                "assigned_to": None,
                "assigned_to_name": "",
                "reviewed_by": None,
                "reviewed_by_name": "",
                "payment_gateway": "Razorpay",
                "payment_reference": charge.razorpay_refund_id or "",
                "processed_at": charge.refunded_at,
                "approved_at": charge.refund_requested_at,
                "metadata": {
                    "prescription_id": charge.prescription_id,
                    "provider_status": charge.provider_refund_status,
                    "refund_attempts": charge.refund_attempts,
                },
                "created_at": charge.created_at,
                "updated_at": charge.updated_at,
                "is_actionable": False,
            }
            for charge in emergency_qs
        ]
        for refund in manual_refunds:
            refund["source"] = "support_request"
            refund["source_display"] = "Support request"
            refund["currency"] = "INR"
            refund["is_actionable"] = True
            source = manual_by_id.get(refund["id"])
            refund["city_id"] = source.charge.city_id if source else None
            refund["city_name"] = source.charge.city.name if source and source.charge.city else "Unassigned"

        records = sorted(
            [*manual_refunds, *emergency_refunds],
            key=lambda item: str(item.get("created_at") or ""),
            reverse=True,
        )
        paginator = SupportPagination()
        page = paginator.paginate_queryset(records, request)
        return ok({
            "results": page,
            "pagination": {
                "page": paginator.page.number,
                "page_size": paginator.get_page_size(request),
                "total_pages": paginator.page.paginator.num_pages,
                "total_count": paginator.page.paginator.count,
            },
        })

    def post(self, request):
        serializer = RefundRequestCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return fail("Validation failed.", errors=serializer.errors, status_code=status.HTTP_400_BAD_REQUEST)
        charge = EmergencyBroadcastCharge.objects.filter(id=serializer.validated_data["charge_id"]).first()
        if not charge or not _can_access_city_id(charge.city_id, request.support_staff):
            return fail("Charge not found.", status_code=status.HTTP_404_NOT_FOUND)
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
        if not _can_access_city_id(refund.charge.city_id, request.support_staff):
            return fail("Refund not found.", status_code=status.HTTP_404_NOT_FOUND)
        from .serializers import RefundRequestSerializer
        return ok(RefundRequestSerializer(refund).data, status_code=status.HTTP_200_OK)


class RefundReviewView(APIView):
    authentication_classes = [SupportJWTAuthentication]
    permission_classes = [CanApproveRefund]

    def post(self, request, pk):
        existing = refund_selectors.get_refund_by_id(pk)
        if not existing or not _can_access_city_id(existing.charge.city_id, request.support_staff):
            return fail("Refund not found.", status_code=status.HTTP_404_NOT_FOUND)
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
