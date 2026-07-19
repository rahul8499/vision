from django.conf import settings
import os
import shutil
import subprocess
import tempfile
from datetime import datetime, timedelta
from django.contrib.contenttypes.models import ContentType
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
from .models import SupportStaff, SupportSession, InternalNote, SafetyReportAction, SupportAssignment, SLAConfiguration, SupportHoliday, SupportNotification, ContactLog, SavedReplyTemplate, RefundRequest, CaseEscalation, CaseRelation, EngineeringIssue, SensitiveActionRequest
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
    SupportAuditLogSerializer, SLAConfigurationSerializer, SupportHolidaySerializer, SupportNotificationSerializer, ContactLogSerializer, SavedReplyTemplateSerializer,
    UserProfileSerializer, StoreProfileSerializer,
)
from complaints.serializers import ComplaintListSerializer, ComplaintDetailSerializer
from prescription.serializers import UserSerializer, StoreSerializer
from .services import (
    auth_service, dashboard_service, complaint_service, ticket_service,
    refund_service, safety_service, lookup_service, notification_service,
    staff_service, audit_service, sla_service,
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
from prescription.models import User, Store, SafetyReport, AppNotification
from emergency_services.models import (
    City, CityEmergencyPolicy, EmergencyBroadcastCharge, EmergencyFeePolicy, ServiceZone,
)
from subscription.models import PaymentHistory
from prescription.models import PrescriptionTargetStore
from prescription.utils.app_notifications import send_store_app_notification, send_user_app_notification


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


def _support_attachment(request):
    attachment = request.FILES.get("attachment")
    if not attachment:
        return None
    if attachment.size > 10 * 1024 * 1024:
        raise ValueError("Attachment must be 10 MB or smaller.")
    allowed = {"image/jpeg", "image/png", "image/webp", "application/pdf", "text/plain"}
    if getattr(attachment, "content_type", "") not in allowed:
        raise ValueError("Only JPG, PNG, WebP, PDF or text files are allowed.")
    header = attachment.read(16)
    attachment.seek(0)
    signatures = {
        "image/jpeg": (b"\xff\xd8\xff",), "image/png": (b"\x89PNG\r\n\x1a\n",),
        "image/webp": (b"RIFF",), "application/pdf": (b"%PDF-",),
    }
    expected = signatures.get(getattr(attachment, "content_type", ""))
    if expected and not any(header.startswith(value) for value in expected):
        raise ValueError("Attachment content does not match its declared file type.")
    if getattr(attachment, "content_type", "") == "image/webp" and header[8:12] != b"WEBP":
        raise ValueError("Attachment content does not match its declared file type.")
    scanner = shutil.which("clamdscan") or shutil.which("clamscan")
    if scanner:
        temporary_path = None
        try:
            with tempfile.NamedTemporaryFile(prefix="support-upload-", delete=False) as temporary:
                temporary_path = temporary.name
                for chunk in attachment.chunks():
                    temporary.write(chunk)
            result = subprocess.run([scanner, "--no-summary", temporary_path], capture_output=True, text=True, timeout=30, check=False)
            if result.returncode == 1:
                raise ValueError("Attachment was rejected by malware scanning.")
            if result.returncode != 0:
                raise ValueError("Attachment could not be safely scanned. Please try again.")
        except subprocess.TimeoutExpired as exc:
            raise ValueError("Attachment malware scan timed out. Please try again.") from exc
        finally:
            if temporary_path:
                try:
                    os.unlink(temporary_path)
                except FileNotFoundError:
                    pass
            attachment.seek(0)
    elif getattr(settings, "SUPPORT_ATTACHMENT_MALWARE_SCAN_REQUIRED", False):
        raise ValueError("Attachment scanning is temporarily unavailable; upload was blocked for safety.")
    return attachment


def _send_csat_request(case_type, case):
    if case_type == "complaint":
        actor_type = case.complainant_type
        actor = case.complainant_store or case.complainant_user
        path = f"complaints/{case.id}/rating"
    else:
        actor_type = case.requester_type
        actor = case.requester_store or case.requester_user
        path = f"platform-support/{case.id}/rating"
    if not actor:
        return
    send = send_store_app_notification if actor_type == "store" else send_user_app_notification
    send(actor, "How was your support experience?", "Your case is complete. Please rate the support you received.", {"type": "SUPPORT_RATING", "case_type": case_type, "case_id": case.id, "path": path}, notification_type="SUPPORT", dedupe_key=f"support-rating-{case_type}-{case.id}")


def _send_support_reply_notification(case_type, case, message):
    body = (message.text or "Support sent an attachment.").strip()[:160]
    data = {"type": "SUPPORT_REPLY", "case_type": case_type, "case_id": case.id, "message_id": message.id}
    if case_type == "ticket":
        actor_type, actor = case.requester_type, case.requester_store or case.requester_user
        if actor:
            send = send_store_app_notification if actor_type == "store" else send_user_app_notification
            return [send(actor, "New reply from AARX Support", body, data, notification_type="SUPPORT_REPLY", dedupe_key=f"support-reply-ticket-{message.id}")]
        return []
    recipients = []
    user = case.complainant_user or case.respondent_user
    if message.visibility in {ComplaintMessage.VISIBILITY_USER_SUPPORT, ComplaintMessage.VISIBILITY_SHARED} and user:
        recipients.append(send_user_app_notification(user, "New reply on your complaint", body, data, notification_type="SUPPORT_REPLY", dedupe_key=f"support-reply-complaint-{message.id}-user"))
    if message.visibility in {ComplaintMessage.VISIBILITY_STORE_SUPPORT, ComplaintMessage.VISIBILITY_SHARED}:
        store = case.complainant_store or case.respondent_store
        if store:
            recipients.append(send_store_app_notification(store, "New reply on a complaint", body, data, notification_type="SUPPORT_REPLY", dedupe_key=f"support-reply-complaint-{message.id}-store"))
    return [item for item in recipients if item]


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
        user_data = {k: v.strip() for k, v in request.data.items() if k in {"name", "email"} and isinstance(v, str)}
        if not data and not user_data:
            return fail("No valid fields to update.", status_code=status.HTTP_400_BAD_REQUEST)
        if "email" in user_data:
            if not user_data["email"]:
                return fail("Email is required.", status_code=status.HTTP_400_BAD_REQUEST)
            if User.objects.filter(email__iexact=user_data["email"]).exclude(pk=staff.user_id).exists():
                return fail("This email is already in use.", status_code=status.HTTP_400_BAD_REQUEST)
            if User.objects.filter(username__iexact=user_data["email"]).exclude(pk=staff.user_id).exists():
                return fail("This email cannot be used for this account.", status_code=status.HTTP_400_BAD_REQUEST)
            staff.user.email = user_data["email"]
            staff.user.username = user_data["email"]
        if "name" in user_data:
            if not user_data["name"]:
                return fail("Name is required.", status_code=status.HTTP_400_BAD_REQUEST)
            first_name, _, last_name = user_data["name"].partition(" ")
            staff.user.first_name = first_name
            staff.user.last_name = last_name
        if user_data:
            staff.user.save()
        for key, value in data.items():
            setattr(staff, key, value)
        if data:
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
        summary = dashboard_service.get_dashboard_summary(request.support_staff)
        return ok(summary, status_code=status.HTTP_200_OK)


class SupportRuntimeHealthView(APIView):
    authentication_classes = [SupportJWTAuthentication]
    permission_classes = [IsSupportStaff]

    def get(self, request):
        from django.core.cache import cache
        try:
            cache.set("support_health_probe", "ok", timeout=15)
            redis_ok = cache.get("support_health_probe") == "ok"
            heartbeat = cache.get("support_runtime_heartbeat")
        except Exception:
            redis_ok, heartbeat = False, None
        heartbeat_time = None
        if heartbeat:
            try:
                heartbeat_time = datetime.fromisoformat(heartbeat)
                if timezone.is_naive(heartbeat_time):
                    heartbeat_time = timezone.make_aware(heartbeat_time)
            except (TypeError, ValueError):
                heartbeat_time = None
        automation_ok = bool(heartbeat_time and timezone.now() - heartbeat_time <= timedelta(seconds=120))
        return ok({"redis": {"ok": redis_ok}, "automation": {"ok": automation_ok, "last_heartbeat": heartbeat_time}, "healthy": redis_ok and automation_ok})


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


class AssigneeListView(APIView):
    authentication_classes = [SupportJWTAuthentication]
    permission_classes = [IsSupportSupervisor]

    def get(self, request):
        scope = request.query_params.get("scope", "GLOBAL").upper()
        city_id = request.query_params.get("city")
        city_ids_param = request.query_params.get("cities", "")
        if scope not in ("CITY", "GLOBAL"):
            return fail("Invalid scope.", status_code=status.HTTP_400_BAD_REQUEST)
        try:
            city_id = int(city_id) if city_id else None
        except (TypeError, ValueError):
            return fail("Invalid city.", status_code=status.HTTP_400_BAD_REQUEST)
        try:
            city_ids = {int(value) for value in city_ids_param.split(",") if value.strip()}
        except (TypeError, ValueError):
            return fail("Invalid cities.", status_code=status.HTTP_400_BAD_REQUEST)
        staff = notification_service.eligible_staff_for_case(scope, city_id)
        for required_city_id in city_ids:
            staff = staff.filter(
                Q(role=SupportStaff.ROLE_ADMIN)
                | Q(all_cities_access=True)
                | Q(cities__id=required_city_id)
            )
        staff = staff.distinct().select_related("user").order_by(
            "user__first_name", "user__last_name", "user__email"
        )
        results = []
        for item in staff:
            active_cases = notification_service.active_case_count(item)
            results.append({
                "id": str(item.id),
                "name": item.user.get_full_name() or item.user.username or item.user.email,
                "role": item.role,
                "active_cases": active_cases,
            })
        results.sort(key=lambda item: (item["active_cases"], item["name"]))
        return ok(results)


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
        if staff.id == request.support_staff.id:
            return fail("You cannot deactivate your own account.", status_code=status.HTTP_400_BAD_REQUEST)
        if staff.role == SupportStaff.ROLE_ADMIN and SupportStaff.objects.filter(role=SupportStaff.ROLE_ADMIN, is_active=True).count() <= 1:
            return fail("The last active admin cannot be deactivated.", status_code=status.HTTP_400_BAD_REQUEST)
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
    permission_classes = [IsSupportSupervisor]

    def post(self, request, complaint_id):
        complaint = complaint_selectors.get_complaint_by_id(complaint_id)
        if not complaint or not _can_access_scope(complaint, request.support_staff):
            return fail("Complaint not found.", status_code=status.HTTP_404_NOT_FOUND)
        assigned_to_id = request.data.get("assigned_to")
        previous_assignee = complaint.assigned_to
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
                old_data={"assigned_to": previous_assignee},
                new_data={"assigned_to": str(assigned_to_id), "reason": request.data.get("reason", "Assigned by supervisor")},
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
        try:
            attachment = _support_attachment(request)
        except ValueError as exc:
            return fail(str(exc), status_code=status.HTTP_400_BAD_REQUEST)
        if not text and not attachment:
            return fail("A message or attachment is required.", status_code=status.HTTP_400_BAD_REQUEST)
        try:
            message = complaint_service.reply_to_complaint(
                complaint_id, text, request.support_staff, visibility=visibility, attachment=attachment
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
            transaction.on_commit(lambda: _send_support_reply_notification("complaint", complaint, message))
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
            complaint = complaint_service.update_complaint_status(complaint_id, new_status, "platform", note=note, changed_by_staff=request.support_staff)
            if new_status in {"resolved", "closed", "rejected"}:
                transaction.on_commit(lambda: _send_csat_request("complaint", complaint))
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
        assignee_ids = {int(ticket.assigned_to) for ticket in tickets if str(ticket.assigned_to or "").isdigit()}
        assignee_names = {
            str(staff.id): staff.user.get_full_name() or staff.user.username or staff.user.email
            for staff in SupportStaff.objects.select_related("user").filter(id__in=assignee_ids)
        }
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
                "requester_id": ticket.requester_store_id or ticket.requester_user_id,
                "requester_name": (
                    ticket.requester_store.name if ticket.requester_store else
                    ticket.requester_user.name if ticket.requester_user else "Unknown requester"
                ),
                "assigned_to": ticket.assigned_to or None,
                "assigned_to_name": assignee_names.get(str(ticket.assigned_to)),
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
        messages = ticket.messages.select_related("sender_user", "sender_store", "support_staff__user").order_by("created_at")
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
            "requester_id": ticket.requester_store_id or ticket.requester_user_id,
            "requester_name": (
                ticket.requester_store.name if ticket.requester_store else
                ticket.requester_user.name if ticket.requester_user else "Unknown requester"
            ),
            "assigned_to": ticket.assigned_to or None,
            "assigned_to_name": None,
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
                    (m.support_staff.user.get_full_name() or m.support_staff.user.username or m.support_staff.user.email) if m.support_staff else
                    m.sender_store.name if m.sender_store else
                    m.sender_user.name if m.sender_user else "AARX Support"
                ),
                "text": m.text,
                "attachment": m.attachment.url if m.attachment else None,
                "is_read": m.is_read,
                "created_at": m.created_at,
            } for m in messages],
        }
        if ticket.assigned_to and str(ticket.assigned_to).isdigit():
            assignee = SupportStaff.objects.select_related("user").filter(id=ticket.assigned_to).first()
            if assignee:
                data["assigned_to_name"] = assignee.user.get_full_name() or assignee.user.username or assignee.user.email
        return ok(data, status_code=status.HTTP_200_OK)


class TicketAssignView(APIView):
    authentication_classes = [SupportJWTAuthentication]
    permission_classes = [IsSupportSupervisor]

    def post(self, request, ticket_id):
        ticket = ticket_selectors.get_ticket_by_id(ticket_id)
        if not ticket or not _can_access_scope(ticket, request.support_staff):
            return fail("Support ticket not found.", status_code=status.HTTP_404_NOT_FOUND)
        assigned_to_id = request.data.get("assigned_to")
        if not assigned_to_id:
            return fail("assigned_to is required.", status_code=status.HTTP_400_BAD_REQUEST)
        previous_assignee = ticket.assigned_to
        try:
            ticket, _ = ticket_service.assign_ticket(ticket_id, assigned_to_id, request.support_staff)
            ip, ua = _get_client_info(request)
            audit_service.log_audit(actor=request.support_staff, action="assign_ticket", entity_type="ticket", entity_id=ticket.id, old_data={"assigned_to": previous_assignee}, new_data={"assigned_to": str(assigned_to_id), "reason": request.data.get("reason", "Assigned by supervisor")}, ip_address=ip, user_agent=ua)
            return ok({"ticket_id": ticket.id, "assigned_to_id": assigned_to_id}, message="Ticket assigned.")
        except ValueError as exc:
            return fail(str(exc), status_code=status.HTTP_400_BAD_REQUEST)


class TicketReplyView(APIView):
    authentication_classes = [SupportJWTAuthentication]
    permission_classes = [IsSupportStaff]

    def post(self, request, ticket_id):
        ticket_access = ticket_selectors.get_ticket_by_id(ticket_id)
        if not ticket_access or not _can_access_scope(ticket_access, request.support_staff):
            return fail("Support ticket not found.", status_code=status.HTTP_404_NOT_FOUND)
        text = request.data.get("text")
        try:
            attachment = _support_attachment(request)
        except ValueError as exc:
            return fail(str(exc), status_code=status.HTTP_400_BAD_REQUEST)
        if not text and not attachment:
            return fail("A message or attachment is required.", status_code=status.HTTP_400_BAD_REQUEST)
        try:
            message, ticket = ticket_service.reply_to_ticket(ticket_id, text, request.support_staff, attachment=attachment)
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
            transaction.on_commit(lambda: _send_support_reply_notification("ticket", ticket, message))
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
            if new_status in {"resolved", "closed"}:
                transaction.on_commit(lambda: _send_csat_request("ticket", ticket))
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
            from .realtime import broadcast_support_case_event
            broadcast_support_case_event("refund_updated", object_id=refund.id, message="Refund request created")
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


class RefundAssignView(APIView):
    authentication_classes = [SupportJWTAuthentication]
    permission_classes = [IsSupportSupervisor]

    def post(self, request, pk):
        refund = refund_selectors.get_refund_by_id(pk)
        if not refund or not _can_access_city_id(refund.charge.city_id, request.support_staff):
            return fail("Refund not found.", status_code=status.HTTP_404_NOT_FOUND)
        assigned_to_id = request.data.get("assigned_to")
        previous_assignee = refund.assigned_to_id
        if not assigned_to_id:
            return fail("assigned_to is required.", status_code=status.HTTP_400_BAD_REQUEST)
        try:
            refund = refund_service.assign_refund(pk, assigned_to_id)
            ip, ua = _get_client_info(request)
            audit_service.log_audit(actor=request.support_staff, action="assign_refund", entity_type="refund_request", entity_id=refund.id, old_data={"assigned_to": previous_assignee}, new_data={"assigned_to": str(assigned_to_id), "reason": request.data.get("reason", "Assigned by supervisor")}, ip_address=ip, user_agent=ua)
            from .realtime import broadcast_support_case_event
            broadcast_support_case_event("refund_updated", object_id=refund.id, message="Refund assignment updated")
            from .serializers import RefundRequestSerializer
            return ok(RefundRequestSerializer(refund).data, message="Refund assigned.")
        except ValueError as exc:
            return fail(str(exc), status_code=status.HTTP_400_BAD_REQUEST)


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
            from .realtime import broadcast_support_case_event
            broadcast_support_case_event("refund_updated", object_id=refund.id, message="Refund status updated")
            from .serializers import RefundRequestSerializer
            return ok(RefundRequestSerializer(refund).data, message=f"Refund {refund.status}.", status_code=status.HTTP_200_OK)
        except ValueError as exc:
            return fail(str(exc), status_code=status.HTTP_400_BAD_REQUEST)


# ---------------------------------------------------------------------------
# Safety report views
# ---------------------------------------------------------------------------

class SafetyReportActionView(APIView):
    authentication_classes = [SupportJWTAuthentication]
    permission_classes = [IsSupportStaff]

    def post(self, request, report_id):
        report = safety_selectors.get_safety_report_by_id(report_id)
        if not report or not _can_access_scope(report, request.support_staff):
            return fail("Safety report not found.", status_code=status.HTTP_404_NOT_FOUND)
        serializer = SafetyReportActionCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return fail("Validation failed.", errors=serializer.errors, status_code=status.HTTP_400_BAD_REQUEST)
        requested_action = serializer.validated_data["action"]
        if requested_action in {"account_suspended", "account_restored"} and request.support_staff.role != SupportStaff.ROLE_ADMIN:
            return fail("Only support admins can change account access.", status_code=status.HTTP_403_FORBIDDEN)
        if request.support_staff.role == SupportStaff.ROLE_AGENT and requested_action != "reviewed":
            return fail("Agents can mark reports under review; a supervisor/admin must take further action.", status_code=status.HTTP_403_FORBIDDEN)
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
            from .realtime import broadcast_support_case_event
            broadcast_support_case_event("safety_report_updated", object_id=report_id, message="Safety report updated")
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
        severity_filter = request.query_params.get("severity")
        assigned_to_filter = request.query_params.get("assigned_to")
        reporter_type = request.query_params.get("reporter_type")
        target_type = request.query_params.get("target_type")
        scope_filter = request.query_params.get("scope")
        query = request.query_params.get("q")
        try:
            city_id = _requested_city(request, request.support_staff)
        except ValueError as exc:
            return fail(str(exc), status_code=status.HTTP_400_BAD_REQUEST)
        except PermissionError as exc:
            return fail(str(exc), status_code=status.HTTP_403_FORBIDDEN)
        page = int(request.query_params.get("page", 1))
        page_size = int(request.query_params.get("page_size", 20))

        results, total = safety_selectors.search_safety_reports(
            query=query,
            status=status_filter,
            category=category_filter,
            severity=severity_filter,
            assigned_to=assigned_to_filter,
            reporter_type=reporter_type,
            target_type=target_type,
            scope=scope_filter,
            city_id=city_id,
            allowed_city_ids=_staff_city_ids(request.support_staff),
            date_from=request.query_params.get("date_from"),
            date_to=request.query_params.get("date_to"),
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
        if not _can_access_scope(report, request.support_staff):
            return fail("Safety report not found.", status_code=status.HTTP_404_NOT_FOUND)
        serializer = SafetyReportSerializer(report)
        return ok(serializer.data, status_code=status.HTTP_200_OK)


class SafetyReportAssignView(APIView):
    authentication_classes = [SupportJWTAuthentication]
    permission_classes = [IsSupportStaff]

    def post(self, request, report_id):
        report = safety_selectors.get_safety_report_by_id(report_id)
        if not report or not _can_access_scope(report, request.support_staff):
            return fail("Safety report not found.", status_code=status.HTTP_404_NOT_FOUND)
        requested_id = request.data.get("assigned_to_id") or request.support_staff.id
        try:
            requested_id = int(requested_id)
        except (TypeError, ValueError):
            return fail("Invalid assignee.")
        if request.support_staff.role == SupportStaff.ROLE_AGENT and requested_id != request.support_staff.id:
            return fail("Agents can only assign safety reports to themselves.", status_code=status.HTTP_403_FORBIDDEN)
        assignee = SupportStaff.objects.filter(id=requested_id, is_active=True).first()
        if not assignee:
            return fail("Support staff member not found.", status_code=status.HTTP_404_NOT_FOUND)
        if report.scope == SafetyReport.SCOPE_CITY and not _can_access_city_id(report.city_id, assignee):
            return fail("Assignee does not have access to this report city.")
        report.assigned_to_id = assignee.id
        if report.status == "submitted":
            report.status = "under_review"
        report.save(update_fields=["assigned_to_id", "status", "updated_at"])
        SafetyReportAction.objects.create(
            report=report, action="assigned", admin=request.support_staff,
            note=f"Assigned to {assignee.user.get_full_name() or assignee.user.username}.",
        )
        notification_service.create_assignment_notification(
            recipient=assignee,
            title="Safety report assigned to you",
            message=f"Safety report #{report.id}: {report.get_category_display()}",
            entity_type="safety_report",
            entity_id=report.id,
        )
        from .realtime import broadcast_support_case_event
        broadcast_support_case_event("safety_report_updated", object_id=report.id, message="Safety report assignment updated")
        return ok(SafetyReportSerializer(report).data, message="Safety report assigned.")


class SafetyReportInternalNoteView(APIView):
    authentication_classes = [SupportJWTAuthentication]
    permission_classes = [IsSupportStaff]

    def post(self, request, report_id):
        report = safety_selectors.get_safety_report_by_id(report_id)
        if not report or not _can_access_scope(report, request.support_staff):
            return fail("Safety report not found.", status_code=status.HTTP_404_NOT_FOUND)
        serializer = InternalNoteCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return fail("Validation failed.", errors=serializer.errors, status_code=status.HTTP_400_BAD_REQUEST)
        from django.contrib.contenttypes.models import ContentType
        note = InternalNote.objects.create(
            content_type=ContentType.objects.get_for_model(SafetyReport),
            object_id=report.id,
            body=serializer.validated_data["body"],
            is_pinned=serializer.validated_data.get("is_pinned", False),
            created_by=request.support_staff,
        )
        from .realtime import broadcast_support_case_event
        broadcast_support_case_event("safety_report_updated", object_id=report.id, message="Safety report note added")
        return ok(InternalNoteSerializer(note).data, message="Internal note added.", status_code=status.HTTP_201_CREATED)


# ---------------------------------------------------------------------------
# User lookup views
# ---------------------------------------------------------------------------

class UserLookupView(APIView):
    authentication_classes = [SupportJWTAuthentication]
    permission_classes = [IsSupportSupervisor]

    def get(self, request):
        query = request.query_params.get("q")
        user_id = request.query_params.get("user_id")
        users = lookup_service.lookup_users(query=query, user_id=user_id)
        city_ids = _staff_city_ids(request.support_staff)
        if city_ids is not None and hasattr(users, "filter"):
            users = users.filter(
                Q(prescriptions__city_id__in=city_ids) |
                Q(complaints_filed__city_id__in=city_ids) |
                Q(complaints_against__city_id__in=city_ids) |
                Q(platform_support_tickets__scope="GLOBAL") |
                Q(platform_support_tickets__city_id__in=city_ids) |
                Q(safety_reports_filed__scope="GLOBAL") |
                Q(safety_reports_filed__city_id__in=city_ids) |
                Q(safety_reports_received__scope="GLOBAL") |
                Q(safety_reports_received__city_id__in=city_ids)
            ).distinct()
        if not users:
            return ok({"results": [], "pagination": {"page": 1, "page_size": 20, "total_pages": 1, "total_count": 0}}, status_code=status.HTTP_200_OK)
        return paginated(users, request, UserSerializer)


class UserDetailView(APIView):
    authentication_classes = [SupportJWTAuthentication]
    permission_classes = [IsSupportSupervisor]

    def get(self, request, user_id):
        user = lookup_selectors.get_user_by_id(user_id)
        if not user:
            return fail("User not found.", status_code=status.HTTP_404_NOT_FOUND)
        city_ids = _staff_city_ids(request.support_staff)
        if city_ids is not None:
            has_access = (
                user.prescriptions.filter(city_id__in=city_ids).exists() or
                user.complaints_filed.filter(city_id__in=city_ids).exists() or
                user.complaints_against.filter(city_id__in=city_ids).exists() or
                user.platform_support_tickets.filter(Q(scope="GLOBAL") | Q(city_id__in=city_ids)).exists() or
                user.safety_reports_filed.filter(Q(scope="GLOBAL") | Q(city_id__in=city_ids)).exists() or
                user.safety_reports_received.filter(Q(scope="GLOBAL") | Q(city_id__in=city_ids)).exists()
            )
            if not has_access:
                return fail("User not found.", status_code=status.HTTP_404_NOT_FOUND)
        serializer = UserProfileSerializer(user, context={"allowed_city_ids": city_ids})
        return ok(serializer.data, status_code=status.HTTP_200_OK)


# ---------------------------------------------------------------------------
# Store lookup views
# ---------------------------------------------------------------------------

class StoreLookupView(APIView):
    authentication_classes = [SupportJWTAuthentication]
    permission_classes = [IsSupportSupervisor]

    def get(self, request):
        query = request.query_params.get("q")
        store_id = request.query_params.get("store_id")
        stores = lookup_service.lookup_stores(query=query, store_id=store_id)
        city_ids = _staff_city_ids(request.support_staff)
        if city_ids is not None:
            if hasattr(stores, "filter"):
                stores = stores.filter(city_id__in=city_ids)
            else:
                stores = [store for store in stores if store.city_id in city_ids]
        if not stores:
            return ok({"results": [], "pagination": {"page": 1, "page_size": 20, "total_pages": 1, "total_count": 0}}, status_code=status.HTTP_200_OK)
        return paginated(stores, request, StoreSerializer)


class StoreDetailView(APIView):
    authentication_classes = [SupportJWTAuthentication]
    permission_classes = [IsSupportSupervisor]

    def get(self, request, store_id):
        store = lookup_selectors.get_store_by_id(store_id)
        if not store:
            return fail("Store not found.", status_code=status.HTTP_404_NOT_FOUND)
        if not _can_access_city_id(store.city_id, request.support_staff):
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


class NotificationMarkAllReadView(APIView):
    authentication_classes = [SupportJWTAuthentication]
    permission_classes = [IsSupportStaff]

    def post(self, request):
        updated = SupportNotification.objects.filter(recipient=request.support_staff, is_read=False).update(is_read=True)
        return ok({"updated": updated}, message="All notifications marked as read.")


class CaseSelfAssignView(APIView):
    authentication_classes = [SupportJWTAuthentication]
    permission_classes = [IsSupportAgent]

    def post(self, request, entity_type, object_id):
        staff = request.support_staff
        try:
            if entity_type == "complaint":
                obj = complaint_selectors.get_complaint_by_id(object_id)
                if not obj or not _can_access_scope(obj, staff):
                    return fail("Complaint not found.", status_code=status.HTTP_404_NOT_FOUND)
                if obj.assigned_to:
                    return fail("This complaint is already assigned.", status_code=status.HTTP_409_CONFLICT)
                complaint_service.claim_unassigned_complaint(object_id, staff)
            elif entity_type == "ticket":
                obj = ticket_selectors.get_ticket_by_id(object_id)
                if not obj or not _can_access_scope(obj, staff):
                    return fail("Help request not found.", status_code=status.HTTP_404_NOT_FOUND)
                if obj.assigned_to:
                    return fail("This help request is already assigned.", status_code=status.HTTP_409_CONFLICT)
                ticket_service.claim_unassigned_ticket(object_id, staff)
            elif entity_type == "refund":
                obj = refund_selectors.get_refund_by_id(object_id)
                if not obj or not _can_access_city_id(obj.charge.city_id, staff):
                    return fail("Refund not found.", status_code=status.HTTP_404_NOT_FOUND)
                if obj.assigned_to_id:
                    return fail("This refund is already assigned.", status_code=status.HTTP_409_CONFLICT)
                refund_service.claim_unassigned_refund(object_id, staff)
            elif entity_type == "safety_report":
                obj = safety_selectors.get_safety_report_by_id(object_id)
                if not obj or not _can_access_scope(obj, staff):
                    return fail("Safety issue not found.", status_code=status.HTTP_404_NOT_FOUND)
                if obj.assigned_to_id:
                    return fail("This safety issue is already assigned.", status_code=status.HTTP_409_CONFLICT)
                updated = SafetyReport.objects.filter(pk=obj.pk, assigned_to_id__isnull=True).update(assigned_to_id=staff.id)
                if not updated:
                    return fail("This safety issue is already assigned.", status_code=status.HTTP_409_CONFLICT)
                if obj.status == "submitted":
                    SafetyReport.objects.filter(pk=obj.pk).update(status="under_review")
                notification_service.create_assignment_notification(recipient=staff, title="Safety issue assigned to you", message=f"Safety issue #{obj.id}", entity_type="safety_report", entity_id=obj.id)
            else:
                return fail("Invalid case type.", status_code=status.HTTP_400_BAD_REQUEST)
            ip, ua = _get_client_info(request)
            audit_service.log_audit(actor=staff, action="self_assign_case", entity_type=entity_type, entity_id=object_id, new_data={"assigned_to": str(staff.id)}, ip_address=ip, user_agent=ua)
            return ok({"entity_type": entity_type, "id": object_id, "assigned_to": str(staff.id)}, message="Case assigned to you.")
        except ValueError as exc:
            return fail(str(exc), status_code=status.HTTP_400_BAD_REQUEST)


CASE_MODELS = {
    "complaint": Complaint, "ticket": PlatformSupportTicket,
    "refund": RefundRequest, "safety_report": SafetyReport,
}


def _managed_case(entity_type, object_id, staff):
    model = CASE_MODELS.get(entity_type)
    if not model:
        return None
    obj = model.objects.filter(pk=object_id).first()
    if not obj:
        return None
    if entity_type == "refund":
        return obj if _can_access_city_id(obj.charge.city_id, staff) else None
    return obj if _can_access_scope(obj, staff) else None


class CaseManagementSearchView(APIView):
    authentication_classes = [SupportJWTAuthentication]
    permission_classes = [IsSupportStaff]

    def get(self, request):
        query = str(request.query_params.get("q", "")).strip()
        if len(query) < 3:
            return ok({"results": []})
        numeric_id = int(query) if query.isdigit() else None
        escalation_filter = Q(reason__icontains=query) | Q(handover_note__icontains=query) | Q(destination__icontains=query)
        issue_filter = Q(title__icontains=query) | Q(description__icontains=query) | Q(owner__icontains=query) | Q(external_reference__icontains=query)
        if numeric_id is not None:
            escalation_filter |= Q(entity_id=numeric_id)
            issue_filter |= Q(entity_id=numeric_id)
        results = []
        for item in CaseEscalation.objects.filter(escalation_filter).order_by("-created_at")[:20]:
            case = _managed_case(item.entity_type, item.entity_id, request.support_staff)
            if not case:
                continue
            subject = getattr(case, "subject", None) or getattr(case, "category", None) or f"Case #{item.entity_id}"
            results.append({"id": f"escalation-{item.id}", "result_type": "escalation", "entity_type": item.entity_type, "entity_id": item.entity_id, "title": subject, "subtitle": f"Sent to {item.get_destination_display()} · {item.reason[:100]}"})
        for item in EngineeringIssue.objects.filter(issue_filter).order_by("-updated_at")[:20]:
            if not _managed_case(item.entity_type, item.entity_id, request.support_staff):
                continue
            results.append({"id": f"engineering-{item.id}", "result_type": "engineering", "entity_type": item.entity_type, "entity_id": item.entity_id, "title": item.title, "subtitle": f"Technical work · {item.get_status_display()} · {item.owner or 'No owner yet'}"})
        return ok({"results": results[:10]})


class CaseManagementView(APIView):
    """Durable cross-team workflow for escalation, links, handoff and approvals."""
    authentication_classes = [SupportJWTAuthentication]
    permission_classes = [IsSupportStaff]

    def get(self, request, entity_type, object_id):
        if not _managed_case(entity_type, object_id, request.support_staff):
            return fail("Case not found.", status_code=status.HTTP_404_NOT_FOUND)
        escalations = CaseEscalation.objects.filter(entity_type=entity_type, entity_id=object_id).select_related("escalated_by__user", "resolved_by__user")
        relations = CaseRelation.objects.filter(Q(source_type=entity_type, source_id=object_id) | Q(target_type=entity_type, target_id=object_id)).select_related("created_by__user")
        issues = EngineeringIssue.objects.filter(entity_type=entity_type, entity_id=object_id).select_related("created_by__user")
        actions = SensitiveActionRequest.objects.filter(entity_type=entity_type, entity_id=object_id).select_related("requested_by__user", "reviewed_by__user")
        deliveries = AppNotification.objects.filter(Q(data__case_type=entity_type, data__case_id=object_id) | Q(data__type__icontains=entity_type, data__id=object_id)).order_by("-created_at")[:30]
        name = lambda staff: (staff.user.get_full_name() or staff.user.username or staff.user.email) if staff else None
        return ok({
            "escalations": [{"id": item.id, "destination": item.destination, "reason": item.reason, "handover_note": item.handover_note, "status": item.status, "created_by": name(item.escalated_by), "created_at": item.created_at} for item in escalations],
            "relations": [{"id": item.id, "source_type": item.source_type, "source_id": item.source_id, "target_type": item.target_type, "target_id": item.target_id, "relation": item.relation, "reason": item.reason, "is_merged": bool(item.merged_at), "merged_at": item.merged_at, "created_by": name(item.created_by), "created_at": item.created_at} for item in relations],
            "engineering_issues": [{"id": item.id, "title": item.title, "description": item.description, "priority": item.priority, "status": item.status, "owner": item.owner, "external_reference": item.external_reference, "created_at": item.created_at} for item in issues],
            "sensitive_actions": [{"id": item.id, "action_type": item.action_type, "reason": item.reason, "verification_method": item.verification_method, "verification_reference": item.verification_reference if request.support_staff.role in {"supervisor", "admin"} or item.requested_by_id == request.support_staff.id else "Verified", "status": item.status, "requested_by": name(item.requested_by), "reviewed_by": name(item.reviewed_by), "review_note": item.review_note, "created_at": item.created_at} for item in actions],
            "deliveries": [{"id": item.id, "title": item.title, "status": item.push_status or "in_app", "attempts": item.push_attempts, "error": item.push_error, "last_attempt_at": item.push_last_attempt_at, "created_at": item.created_at} for item in deliveries],
        })

    @transaction.atomic
    def post(self, request, entity_type, object_id):
        case = _managed_case(entity_type, object_id, request.support_staff)
        if not case:
            return fail("Case not found.", status_code=status.HTTP_404_NOT_FOUND)
        action = request.data.get("action")
        staff = request.support_staff
        data = request.data
        created = None
        if action == "escalate":
            if not str(data.get("reason", "")).strip() or not str(data.get("handover_note", "")).strip():
                return fail("Reason and handover note are required.")
            if data.get("destination") not in dict(CaseEscalation.DESTINATION_CHOICES):
                return fail("Invalid escalation destination.")
            created = CaseEscalation.objects.create(entity_type=entity_type, entity_id=object_id, destination=data.get("destination"), reason=data["reason"].strip(), handover_note=data["handover_note"].strip(), escalated_by=staff)
            recipients = notification_service.eligible_staff_for_case(getattr(case, "scope", "CITY"), getattr(case, "city_id", None)).filter(role__in=["supervisor", "admin"])
            for recipient in recipients:
                SupportNotification.objects.create(recipient=recipient, notification_type="case_escalation", title=f"Case escalated to {created.get_destination_display()}", message=f"{entity_type.replace('_', ' ').title()} #{object_id}: {created.reason}", entity_type=entity_type, entity_id=str(object_id))
        elif action == "link":
            target_type, target_id = data.get("target_type"), data.get("target_id")
            if not target_id or not _managed_case(target_type, target_id, staff):
                return fail("Related case was not found or is outside your access.")
            if target_type == entity_type and int(target_id) == int(object_id):
                return fail("A case cannot be linked to itself.")
            created, _ = CaseRelation.objects.get_or_create(source_type=entity_type, source_id=object_id, target_type=target_type, target_id=target_id, defaults={"relation": data.get("relation", "related"), "reason": data.get("reason", ""), "created_by": staff})
        elif action == "merge_duplicate":
            if staff.role not in {"supervisor", "admin"}:
                return fail("Supervisor access is required to merge duplicate cases.", status_code=status.HTTP_403_FORBIDDEN)
            if entity_type not in {"complaint", "ticket"}:
                return fail("Only complaints and help requests can be merged.")
            try:
                duplicate_id = int(data.get("duplicate_id"))
            except (TypeError, ValueError):
                return fail("Choose a valid duplicate case number.")
            if duplicate_id == object_id:
                return fail("A case cannot be merged into itself.")
            reason = str(data.get("reason", "")).strip()
            if not reason:
                return fail("A merge reason is required.")
            model = CASE_MODELS[entity_type]
            canonical = model.objects.select_for_update().filter(pk=object_id).first()
            duplicate = model.objects.select_for_update().filter(pk=duplicate_id).first()
            if not canonical or not duplicate or not _managed_case(entity_type, duplicate_id, staff):
                return fail("Duplicate case was not found or is outside your access.", status_code=status.HTTP_404_NOT_FOUND)
            terminal = {"resolved", "closed", "rejected", "withdrawn"}
            if canonical.status in terminal:
                return fail("Choose an active case as the main case before merging.")
            if duplicate.status in terminal:
                return fail("The duplicate case is already completed. Connect it instead of merging it.")
            already_merged = CaseRelation.objects.filter(
                Q(source_type=entity_type, source_id=duplicate_id, merged_at__isnull=False) |
                Q(target_type=entity_type, target_id=duplicate_id, merged_at__isnull=False)
            ).exists()
            if already_merged:
                return fail("This duplicate case has already been merged.")
            created, _ = CaseRelation.objects.get_or_create(
                source_type=entity_type, source_id=object_id, target_type=entity_type, target_id=duplicate_id,
                defaults={"relation": "duplicate", "reason": reason, "created_by": staff},
            )
            if created.merged_at:
                return fail("These cases have already been merged.")
            created.relation, created.reason, created.merged_by, created.merged_at = "duplicate", reason, staff, timezone.now()
            created.save(update_fields=["relation", "reason", "merged_by", "merged_at"])
            old_status = duplicate.status
            merge_note = f"Merged into {entity_type.replace('_', ' ')} #{object_id}. {reason}"
            duplicate.status, duplicate.resolved_at = "closed", timezone.now()
            if entity_type == "complaint":
                duplicate.resolution_notes = merge_note
                duplicate.save(update_fields=["status", "resolved_at", "resolution_notes", "updated_at"])
                ComplaintStatusHistory.objects.create(complaint=duplicate, from_status=old_status, to_status="closed", changed_by="platform", changed_by_staff=staff, note=merge_note)
            else:
                duplicate.resolution_note = merge_note
                duplicate.save(update_fields=["status", "resolved_at", "resolution_note", "updated_at"])
                from complaints.models import PlatformSupportTicketStatusHistory
                PlatformSupportTicketStatusHistory.objects.create(ticket=duplicate, from_status=old_status, to_status="closed", changed_by_staff=staff, note=merge_note)
            content_type = ContentType.objects.get_for_model(model)
            SupportAssignment.objects.filter(content_type=content_type, object_id=duplicate_id, is_active=True).update(is_active=False, unassigned_at=timezone.now())
        elif action == "engineering_handoff":
            if not str(data.get("title", "")).strip() or not str(data.get("description", "")).strip():
                return fail("Title and technical description are required.")
            if data.get("priority", "medium") not in dict(EngineeringIssue.PRIORITY_CHOICES):
                return fail("Invalid engineering priority.")
            created = EngineeringIssue.objects.create(entity_type=entity_type, entity_id=object_id, title=data["title"].strip(), description=data["description"].strip(), priority=data.get("priority", "medium"), owner=data.get("owner", ""), external_reference=data.get("external_reference", ""), created_by=staff)
        elif action == "update_engineering":
            created = EngineeringIssue.objects.select_for_update().filter(pk=data.get("issue_id"), entity_type=entity_type, entity_id=object_id).first()
            if not created:
                return fail("Engineering issue not found.", status_code=status.HTTP_404_NOT_FOUND)
            if data.get("status") not in dict(EngineeringIssue.STATUS_CHOICES):
                return fail("Invalid engineering status.")
            created.status = data["status"]
            if "owner" in data:
                created.owner = str(data.get("owner", ""))[:120]
            if "external_reference" in data:
                created.external_reference = str(data.get("external_reference", ""))[:200]
            created.save(update_fields=["status", "owner", "external_reference", "updated_at"])
        elif action == "update_escalation":
            if staff.role not in {"supervisor", "admin"}:
                return fail("Supervisor access is required.", status_code=status.HTTP_403_FORBIDDEN)
            created = CaseEscalation.objects.select_for_update().filter(pk=data.get("escalation_id"), entity_type=entity_type, entity_id=object_id).first()
            if not created or data.get("status") not in dict(CaseEscalation.STATUS_CHOICES):
                return fail("Escalation or status is invalid.")
            created.status = data["status"]
            if created.status in {"resolved", "cancelled"}:
                created.resolved_by, created.resolved_at = staff, timezone.now()
            created.save(update_fields=["status", "resolved_by", "resolved_at", "updated_at"])
        elif action == "sensitive_action":
            required = ["action_type", "reason", "verification_method", "verification_reference"]
            if any(not str(data.get(key, "")).strip() for key in required):
                return fail("Action, reason and customer verification evidence are required.")
            created = SensitiveActionRequest.objects.create(entity_type=entity_type, entity_id=object_id, action_type=data["action_type"], reason=data["reason"].strip(), verification_method=data["verification_method"].strip(), verification_reference=data["verification_reference"].strip(), requested_by=staff)
        elif action in {"approve_sensitive", "reject_sensitive"}:
            if staff.role not in {"supervisor", "admin"}:
                return fail("Supervisor approval is required.", status_code=status.HTTP_403_FORBIDDEN)
            created = SensitiveActionRequest.objects.select_for_update().filter(pk=data.get("request_id"), entity_type=entity_type, entity_id=object_id, status="pending").first()
            if not created:
                return fail("Pending sensitive action request not found.", status_code=status.HTTP_404_NOT_FOUND)
            created.status = "approved" if action == "approve_sensitive" else "rejected"
            created.reviewed_by, created.reviewed_at, created.review_note = staff, timezone.now(), data.get("review_note", "")
            created.save(update_fields=["status", "reviewed_by", "reviewed_at", "review_note", "updated_at"])
        elif action == "reopen":
            if staff.role not in {"supervisor", "admin"}:
                return fail("Supervisor approval is required to reopen a case.", status_code=status.HTTP_403_FORBIDDEN)
            note = str(data.get("reason", "")).strip()
            if not note:
                return fail("Reopen reason is required.")
            if entity_type == "complaint":
                old_status = case.status
                if old_status not in {"resolved", "closed", "rejected", "withdrawn"}:
                    return fail("Only a completed complaint can be reopened.")
                case.status, case.resolved_at, case.resolution_notes = "under_review", None, note
                case.save(update_fields=["status", "resolved_at", "resolution_notes", "updated_at"])
                ComplaintStatusHistory.objects.create(complaint=case, from_status=old_status, to_status="under_review", changed_by="platform", changed_by_staff=staff, note=note)
                sla_service.sync_case_clock("complaint", case)
            elif entity_type == "ticket":
                old_status = case.status
                if old_status not in {"resolved", "closed"}:
                    return fail("Only a completed ticket can be reopened.")
                case.status, case.resolved_at, case.resolution_note = "open", None, note
                case.save(update_fields=["status", "resolved_at", "resolution_note", "updated_at"])
                from complaints.models import PlatformSupportTicketStatusHistory
                PlatformSupportTicketStatusHistory.objects.create(ticket=case, from_status=old_status, to_status="open", changed_by_staff=staff, note=note)
                sla_service.sync_case_clock("ticket", case)
            else:
                return fail("Only complaints and tickets can be reopened.")
            created = case
        elif action == "retry_delivery":
            notification = AppNotification.objects.filter(pk=data.get("notification_id")).filter(Q(data__case_type=entity_type, data__case_id=object_id) | Q(data__type__icontains=entity_type, data__id=object_id)).first()
            if not notification or notification.push_status == "delivered":
                return fail("Retryable delivery was not found.")
            from prescription.tasks import retry_app_notification_push_task
            retry_app_notification_push_task.delay(notification.id)
            created = notification
        else:
            return fail("Unsupported case-management action.")
        ip, ua = _get_client_info(request)
        audit_service.log_audit(staff, f"case_{action}", entity_type, object_id, new_data={key: value for key, value in data.items() if key not in {"verification_reference"}}, ip_address=ip, user_agent=ua)
        return ok({"id": getattr(created, "id", object_id)}, message="Case workflow updated.", status_code=status.HTTP_201_CREATED)


class SupportOperationsView(APIView):
    authentication_classes = [SupportJWTAuthentication]
    permission_classes = [IsSupportStaff]

    CLOSED_STATUSES = {"closed", "resolved", "processed", "rejected", "cancelled", "withdrawn"}

    @staticmethod
    def _has_first_reply(entity_type, obj):
        if entity_type == "complaint":
            return obj.messages.filter(sender_type="platform").exists()
        if entity_type == "ticket":
            return obj.messages.filter(sender_type="platform").exists()
        if entity_type == "refund":
            return bool(obj.reviewed_by_id)
        if entity_type == "safety_report":
            return obj.admin_actions.exists()
        return False

    def _case_record(self, entity_type, obj, now, policy_map):
        priority = (
            getattr(obj, "severity", None)
            or getattr(obj, "priority", None)
            or ("high" if entity_type == "refund" and obj.status == "failed" else "default" if entity_type == "refund" else "medium")
        )
        policy = policy_map.get((entity_type, priority)) or policy_map.get((entity_type, "default"))
        created_at = obj.created_at
        status_value = getattr(obj, "status", "open")
        first_reply_done = self._has_first_reply(entity_type, obj)
        deadline = None
        if policy:
            deadline, _ = sla_service.deadline_for(obj, policy, first_reply_done, now)
        if not first_reply_done:
            next_action = "Send the first reply"
        elif status_value in {"awaiting_info", "waiting_for_user"}:
            next_action = "Check whether the requester replied"
        elif entity_type == "refund" and status_value == "pending":
            next_action = "Review the refund request"
        elif entity_type == "safety_report" and status_value == "submitted":
            next_action = "Check the evidence"
        else:
            next_action = "Open the case, review the latest details, and update its status"
        return {
            "type": entity_type,
            "id": obj.id,
            "title": getattr(obj, "subject", None) or getattr(obj, "category", None) or (f"Refund ₹{obj.amount}" if entity_type == "refund" else f"Case #{obj.id}"),
            "status": status_value,
            "priority": priority,
            "created_at": created_at,
            "city_id": getattr(obj, "city_id", None) or (obj.charge.city_id if entity_type == "refund" else None),
            "city_name": getattr(getattr(obj, "city", None), "name", None) or (getattr(obj.charge.city, "name", None) if entity_type == "refund" else None),
            "deadline": deadline,
            "next_action": next_action,
        }

    def get(self, request):
        staff = request.support_staff
        now = timezone.now()
        policies = list(SLAConfiguration.objects.filter(is_active=True))
        policy_map = {(item.entity_type, item.priority): item for item in policies}
        work = []
        assignments = SupportAssignment.objects.filter(assigned_to=staff, is_active=True).select_related("content_type").order_by("-assigned_at")[:100]
        for assignment in assignments:
            obj = assignment.content_object
            if not obj:
                continue
            status_value = getattr(obj, "status", "open")
            if status_value in self.CLOSED_STATUSES:
                continue
            entity_type = "ticket" if assignment.content_type.model == "platformsupportticket" else assignment.content_type.model
            work.append(self._case_record(entity_type, obj, now, policy_map))
        for report in SafetyReport.objects.filter(assigned_to_id=staff.id).exclude(status="closed").order_by("-created_at")[:50]:
            work.append(self._case_record("safety_report", report, now, policy_map))
        for refund in RefundRequest.objects.filter(assigned_to=staff, status__in=["pending", "approved", "failed"]).order_by("-created_at")[:50]:
            work.append(self._case_record("refund", refund, now, policy_map))

        state_order = {"overdue": 0, "due_soon": 1, "on_track": 2}
        priority_order = {"critical": 0, "urgent": 0, "high": 1, "medium": 2, "default": 2, "low": 3}
        work.sort(key=lambda item: (
            state_order.get((item.get("deadline") or {}).get("state"), 3),
            priority_order.get(item.get("priority"), 3),
            item["created_at"],
        ))

        unassigned = []
        if staff.is_active:
            complaint_qs = _scope_queryset(Complaint.objects.filter(Q(assigned_to__isnull=True) | Q(assigned_to="")), staff).exclude(status__in=self.CLOSED_STATUSES).select_related("city")[:50]
            ticket_qs = _scope_queryset(PlatformSupportTicket.objects.filter(Q(assigned_to__isnull=True) | Q(assigned_to="")), staff, include_global=True).exclude(status__in=self.CLOSED_STATUSES).select_related("city")[:50]
            safety_qs = _scope_queryset(SafetyReport.objects.filter(assigned_to_id__isnull=True), staff, include_global=True).exclude(status="closed").select_related("city")[:50]
            refund_qs = RefundRequest.objects.filter(assigned_to__isnull=True, status__in=["pending", "approved", "failed"]).select_related("charge__city")
            allowed = _staff_city_ids(staff)
            if allowed is not None:
                refund_qs = refund_qs.filter(charge__city_id__in=allowed)
            for obj in complaint_qs: unassigned.append(self._case_record("complaint", obj, now, policy_map))
            for obj in ticket_qs: unassigned.append(self._case_record("ticket", obj, now, policy_map))
            for obj in safety_qs: unassigned.append(self._case_record("safety_report", obj, now, policy_map))
            for obj in refund_qs[:50]: unassigned.append(self._case_record("refund", obj, now, policy_map))
            unassigned.sort(key=lambda item: (
                state_order.get((item.get("deadline") or {}).get("state"), 3),
                priority_order.get(item.get("priority"), 3), item["created_at"],
            ))

        follow_ups = ContactLog.objects.filter(
            created_by=staff, follow_up_at__isnull=False, status="scheduled",
        ).exclude(outcome="resolved").select_related("content_type", "created_by__user").order_by("follow_up_at")[:100]
        follow_up_data = [{
            **ContactLogSerializer(item).data,
            "state": "overdue" if item.follow_up_at < now else "due_today" if item.follow_up_at.date() == now.date() else "upcoming",
        } for item in follow_ups]

        workload = []
        if staff.role in (SupportStaff.ROLE_SUPERVISOR, SupportStaff.ROLE_ADMIN):
            for member in notification_service.eligible_staff_for_case("GLOBAL").select_related("user").order_by("user__first_name", "user__email"):
                workload.append({
                    "id": str(member.id),
                    "name": member.user.get_full_name() or member.user.username or member.user.email,
                    "role": member.role,
                    "active_cases": notification_service.active_case_count(member),
                    "last_seen_at": member.last_seen_at,
                    "is_online": bool(member.last_seen_at and member.last_seen_at >= now - timedelta(minutes=5)),
                })
            workload.sort(key=lambda item: (item["active_cases"], item["name"]))

        breach_counts = {"complaint": 0, "ticket": 0, "refund": 0, "safety_report": 0}
        first_response_breaches = {"complaint": 0, "ticket": 0, "refund": 0, "safety_report": 0}
        active_groups = {
            "complaint": _scope_queryset(Complaint.objects.exclude(status__in=self.CLOSED_STATUSES), staff),
            "ticket": _scope_queryset(PlatformSupportTicket.objects.exclude(status__in=self.CLOSED_STATUSES), staff, include_global=True),
            "safety_report": _scope_queryset(SafetyReport.objects.exclude(status="closed"), staff, include_global=True),
        }
        refund_base = RefundRequest.objects.filter(status__in=["pending", "approved", "failed"]); allowed = _staff_city_ids(staff)
        if allowed is not None: refund_base = refund_base.filter(charge__city_id__in=allowed)
        active_groups["refund"] = refund_base
        for entity_type, queryset in active_groups.items():
            for obj in queryset.iterator(chunk_size=200):
                record = self._case_record(entity_type, obj, now, policy_map)
                deadline = record.get("deadline") or {}
                if deadline.get("state") == "overdue":
                    target = first_response_breaches if deadline.get("stage") == "first_reply" else breach_counts
                    target[entity_type] += 1

        contacts = ContactLog.objects.filter(created_by=staff).select_related("created_by__user", "content_type").order_by("-created_at")[:50]
        replies = SavedReplyTemplate.objects.filter(is_active=True).order_by("category", "title")
        notifications = SupportNotification.objects.filter(recipient=staff).order_by("-created_at")[:50]
        return ok({
            "my_work": work[:100],
            "unassigned": unassigned[:100],
            "follow_ups": follow_up_data,
            "workload": workload,
            "sla": {"policies": SLAConfigurationSerializer(policies, many=True).data, "breaches": breach_counts, "first_response_breaches": first_response_breaches},
            "notifications": SupportNotificationSerializer(notifications, many=True).data,
            "contacts": ContactLogSerializer(contacts, many=True).data,
            "saved_replies": SavedReplyTemplateSerializer(replies, many=True).data,
            "analytics": dashboard_service.get_dashboard_summary(request.support_staff),
        })


class ContactLogListCreateView(APIView):
    authentication_classes = [SupportJWTAuthentication]
    permission_classes = [IsSupportStaff]
    model_map = {"complaint": Complaint, "ticket": PlatformSupportTicket, "refund": RefundRequest, "safety_report": SafetyReport}

    @staticmethod
    def _can_access(obj, staff):
        if isinstance(obj, RefundRequest):
            return _can_access_city_id(obj.charge.city_id, staff)
        return _can_access_scope(obj, staff)

    def get(self, request):
        model = self.model_map.get(request.query_params.get("entity_type"))
        object_id = request.query_params.get("object_id")
        if not model or not object_id:
            return fail("Valid entity_type and object_id are required.")
        obj = model.objects.filter(id=object_id).first()
        if not obj or not self._can_access(obj, request.support_staff):
            return fail("Case not found.", status_code=status.HTTP_404_NOT_FOUND)
        content_type = ContentType.objects.get_for_model(model)
        logs = ContactLog.objects.filter(content_type=content_type, object_id=object_id).select_related("created_by__user", "content_type").order_by("-created_at")
        return ok({"results": ContactLogSerializer(logs, many=True).data})

    def post(self, request):
        model = self.model_map.get(request.data.get("entity_type"))
        obj = model.objects.filter(id=request.data.get("object_id")).first() if model else None
        if not obj or not self._can_access(obj, request.support_staff):
            return fail("Valid entity_type and object_id are required.")
        serializer = ContactLogSerializer(data=request.data)
        if not serializer.is_valid():
            return fail("Validation failed.", errors=serializer.errors)
        log = serializer.save(content_type=ContentType.objects.get_for_model(model), created_by=request.support_staff, status="scheduled")
        ip, ua = _get_client_info(request)
        audit_service.log_audit(request.support_staff, "create_follow_up", "contact_log", log.id, new_data=ContactLogSerializer(log).data, ip_address=ip, user_agent=ua)
        return ok(ContactLogSerializer(log).data, message="Contact activity recorded.", status_code=status.HTTP_201_CREATED)


class ContactLogDetailView(APIView):
    authentication_classes = [SupportJWTAuthentication]
    permission_classes = [IsSupportStaff]

    def patch(self, request, pk):
        log = ContactLog.objects.select_related("content_type", "created_by").filter(pk=pk).first()
        if not log or not ContactLogListCreateView._can_access(log.content_object, request.support_staff):
            return fail("Follow-up not found.", status_code=status.HTTP_404_NOT_FOUND)
        if log.created_by_id != request.support_staff.id and request.support_staff.role == SupportStaff.ROLE_AGENT:
            return fail("You can only change your own follow-ups.", status_code=status.HTTP_403_FORBIDDEN)
        requested_status = request.data.get("status", log.status)
        if requested_status not in dict(ContactLog.STATUS_CHOICES):
            return fail("Invalid follow-up status.")
        serializer = ContactLogSerializer(log, data=request.data, partial=True)
        if not serializer.is_valid():
            return fail("Validation failed.", errors=serializer.errors)
        old_data = ContactLogSerializer(log).data
        old_follow_up_at = log.follow_up_at
        old_status = log.status
        log = serializer.save()
        if requested_status == "completed":
            log.completed_at = timezone.now()
        elif requested_status in {"scheduled", "cancelled"}:
            log.completed_at = None
        log.status = requested_status
        log.save(update_fields=["status", "completed_at", "updated_at"])
        if requested_status == "scheduled" and (old_follow_up_at != log.follow_up_at or old_status != "scheduled"):
            SupportNotification.objects.filter(notification_type="follow_up", entity_type="contact_log", entity_id=str(log.id)).delete()
        ip, ua = _get_client_info(request)
        audit_service.log_audit(request.support_staff, f"follow_up_{requested_status}", "contact_log", log.id, old_data=old_data, new_data=ContactLogSerializer(log).data, ip_address=ip, user_agent=ua)
        return ok(ContactLogSerializer(log).data, message="Follow-up updated.")


class SavedReplyListCreateView(APIView):
    authentication_classes = [SupportJWTAuthentication]
    permission_classes = [IsSupportStaff]

    def get(self, request):
        return ok({"results": SavedReplyTemplateSerializer(SavedReplyTemplate.objects.filter(is_active=True), many=True).data})

    def post(self, request):
        if request.support_staff.role not in (SupportStaff.ROLE_SUPERVISOR, SupportStaff.ROLE_ADMIN):
            return fail("Only supervisors or admins can create templates.", status_code=status.HTTP_403_FORBIDDEN)
        serializer = SavedReplyTemplateSerializer(data=request.data)
        if not serializer.is_valid():
            return fail("Validation failed.", errors=serializer.errors)
        template = serializer.save(created_by=request.support_staff)
        ip, ua = _get_client_info(request)
        audit_service.log_audit(request.support_staff, "create_saved_reply", "saved_reply", template.id, new_data=SavedReplyTemplateSerializer(template).data, ip_address=ip, user_agent=ua)
        return ok(SavedReplyTemplateSerializer(template).data, message="Saved reply created.", status_code=status.HTTP_201_CREATED)


class SavedReplyDetailView(APIView):
    authentication_classes = [SupportJWTAuthentication]
    permission_classes = [IsSupportSupervisor]

    def patch(self, request, pk):
        template = SavedReplyTemplate.objects.filter(pk=pk).first()
        if not template:
            return fail("Ready reply not found.", status_code=status.HTTP_404_NOT_FOUND)
        old_data = SavedReplyTemplateSerializer(template).data
        serializer = SavedReplyTemplateSerializer(template, data=request.data, partial=True)
        if not serializer.is_valid():
            return fail("Validation failed.", errors=serializer.errors)
        template = serializer.save()
        ip, ua = _get_client_info(request)
        audit_service.log_audit(request.support_staff, "update_saved_reply", "saved_reply", template.id, old_data=old_data, new_data=SavedReplyTemplateSerializer(template).data, ip_address=ip, user_agent=ua)
        return ok(SavedReplyTemplateSerializer(template).data, message="Ready reply updated.")

    def delete(self, request, pk):
        template = SavedReplyTemplate.objects.filter(pk=pk).first()
        if not template:
            return fail("Ready reply not found.", status_code=status.HTTP_404_NOT_FOUND)
        template.is_active = False
        template.save(update_fields=["is_active", "updated_at"])
        ip, ua = _get_client_info(request)
        audit_service.log_audit(request.support_staff, "deactivate_saved_reply", "saved_reply", template.id, old_data={"is_active": True}, new_data={"is_active": False}, ip_address=ip, user_agent=ua)
        return ok(message="Ready reply deactivated.")


class SLAConfigurationListCreateView(APIView):
    authentication_classes = [SupportJWTAuthentication]
    permission_classes = [IsSupportAdmin]

    def get(self, request):
        policies = SLAConfiguration.objects.order_by("entity_type", "priority")
        holidays = SupportHoliday.objects.order_by("date")
        return ok({"policies": SLAConfigurationSerializer(policies, many=True).data, "holidays": SupportHolidaySerializer(holidays, many=True).data})

    def post(self, request):
        serializer = SLAConfigurationSerializer(data=request.data)
        if not serializer.is_valid():
            return fail("Validation failed.", errors=serializer.errors)
        policy = serializer.save()
        ip, ua = _get_client_info(request)
        audit_service.log_audit(request.support_staff, "create_sla_policy", "sla_configuration", policy.id, new_data=SLAConfigurationSerializer(policy).data, ip_address=ip, user_agent=ua)
        return ok(SLAConfigurationSerializer(policy).data, message="Response deadline rule created.", status_code=status.HTTP_201_CREATED)


class SLAConfigurationDetailView(APIView):
    authentication_classes = [SupportJWTAuthentication]
    permission_classes = [IsSupportAdmin]

    def patch(self, request, pk):
        policy = SLAConfiguration.objects.filter(pk=pk).first()
        if not policy:
            return fail("Response deadline rule not found.", status_code=status.HTTP_404_NOT_FOUND)
        old_data = SLAConfigurationSerializer(policy).data
        serializer = SLAConfigurationSerializer(policy, data=request.data, partial=True)
        if not serializer.is_valid():
            return fail("Validation failed.", errors=serializer.errors)
        policy = serializer.save()
        ip, ua = _get_client_info(request)
        audit_service.log_audit(request.support_staff, "update_sla_policy", "sla_configuration", policy.id, old_data=old_data, new_data=SLAConfigurationSerializer(policy).data, ip_address=ip, user_agent=ua)
        return ok(SLAConfigurationSerializer(policy).data, message="Response deadline rule updated.")


class SupportHolidayListCreateView(APIView):
    authentication_classes = [SupportJWTAuthentication]
    permission_classes = [IsSupportAdmin]

    def post(self, request):
        serializer = SupportHolidaySerializer(data=request.data)
        if not serializer.is_valid():
            return fail("Validation failed.", errors=serializer.errors)
        holiday = serializer.save()
        ip, ua = _get_client_info(request)
        audit_service.log_audit(request.support_staff, "create_support_holiday", "support_holiday", holiday.id, new_data=SupportHolidaySerializer(holiday).data, ip_address=ip, user_agent=ua)
        return ok(SupportHolidaySerializer(holiday).data, message="Holiday added.", status_code=status.HTTP_201_CREATED)


class SupportHolidayDetailView(APIView):
    authentication_classes = [SupportJWTAuthentication]
    permission_classes = [IsSupportAdmin]

    def patch(self, request, pk):
        holiday = SupportHoliday.objects.filter(pk=pk).first()
        if not holiday:
            return fail("Holiday not found.", status_code=status.HTTP_404_NOT_FOUND)
        old_data = SupportHolidaySerializer(holiday).data
        serializer = SupportHolidaySerializer(holiday, data=request.data, partial=True)
        if not serializer.is_valid():
            return fail("Validation failed.", errors=serializer.errors)
        holiday = serializer.save()
        ip, ua = _get_client_info(request)
        audit_service.log_audit(request.support_staff, "update_support_holiday", "support_holiday", holiday.id, old_data=old_data, new_data=SupportHolidaySerializer(holiday).data, ip_address=ip, user_agent=ua)
        return ok(SupportHolidaySerializer(holiday).data, message="Holiday updated.")

    def delete(self, request, pk):
        holiday = SupportHoliday.objects.filter(pk=pk).first()
        if not holiday:
            return fail("Holiday not found.", status_code=status.HTTP_404_NOT_FOUND)
        old_data = SupportHolidaySerializer(holiday).data
        holiday_id = holiday.id
        holiday.delete()
        ip, ua = _get_client_info(request)
        audit_service.log_audit(request.support_staff, "delete_support_holiday", "support_holiday", holiday_id, old_data=old_data, ip_address=ip, user_agent=ua)
        return ok(message="Holiday removed.")


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
