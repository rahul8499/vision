from django.contrib.contenttypes.models import ContentType
from django.db.models import Count, Q
from django.utils import timezone
from datetime import timedelta
from complaints.models import Complaint, PlatformSupportTicket
from ..models import RefundRequest, SupportStaff, SupportNotification


def get_complaint_counts():
    return {
        "open": Complaint.objects.filter(status__in=["open", "under_review", "awaiting_info"]).count(),
        "total": Complaint.objects.count(),
        "by_status": dict(Complaint.objects.values_list("status").annotate(count=Count("id")).order_by()),
    }


def get_ticket_counts():
    return {
        "open": PlatformSupportTicket.objects.filter(status__in=["open", "in_progress", "waiting_for_user"]).count(),
        "total": PlatformSupportTicket.objects.count(),
        "by_status": dict(PlatformSupportTicket.objects.values_list("status").annotate(count=Count("id")).order_by()),
    }


def get_refund_counts():
    return {
        "pending": RefundRequest.objects.filter(status="pending").count(),
        "total": RefundRequest.objects.count(),
        "by_status": dict(RefundRequest.objects.values_list("status").annotate(count=Count("id")).order_by()),
    }


def get_staff_counts():
    return {
        "active": SupportStaff.objects.filter(is_active=True).count(),
        "total": SupportStaff.objects.count(),
    }


def get_recent_activity(limit=10):
    from ..models import SupportAuditLog
    return SupportAuditLog.objects.select_related("actor__user").order_by("-created_at")[:limit]
