from django.contrib.contenttypes.models import ContentType
from django.db.models import Count, Q, Sum, Avg, F, Case, When, IntegerField, Value
from django.utils import timezone
from datetime import timedelta
from complaints.models import Complaint, ComplaintStatusHistory, PlatformSupportTicket, PlatformSupportMessage
from prescription.models import SafetyReport
from ..models import RefundRequest, SupportStaff, SupportNotification


def get_dashboard_summary():
    now = timezone.now()
    last_24h = now - timedelta(hours=24)
    last_7d = now - timedelta(days=7)

    complaints_open = Complaint.objects.filter(status__in=["open", "under_review", "awaiting_info"]).count()
    complaints_total = Complaint.objects.count()
    complaints_24h = Complaint.objects.filter(created_at__gte=last_24h).count()

    tickets_open = PlatformSupportTicket.objects.filter(status__in=["open", "in_progress", "waiting_for_user"]).count()
    tickets_total = PlatformSupportTicket.objects.count()
    tickets_24h = PlatformSupportTicket.objects.filter(created_at__gte=last_24h).count()

    refunds_pending = RefundRequest.objects.filter(status="pending").count()
    refunds_total = RefundRequest.objects.count()
    refunds_24h = RefundRequest.objects.filter(created_at__gte=last_24h).count()

    safety_reports_open = SafetyReport.objects.filter(status__in=["submitted", "under_review"]).count()
    safety_reports_total = SafetyReport.objects.count()
    safety_reports_24h = SafetyReport.objects.filter(created_at__gte=last_24h).count()

    active_staff = SupportStaff.objects.filter(is_active=True).count()
    unread_notifications = SupportNotification.objects.filter(is_read=False).count()

    complaint_status_dist = dict(
        Complaint.objects.values_list("status").annotate(count=Count("id")).order_by()
    )

    ticket_status_dist = dict(
        PlatformSupportTicket.objects.values_list("status").annotate(count=Count("id")).order_by()
    )

    refund_status_dist = dict(
        RefundRequest.objects.values_list("status").annotate(count=Count("id")).order_by()
    )

    return {
        "complaints": {
            "open": complaints_open,
            "total": complaints_total,
            "last_24h": complaints_24h,
            "status_distribution": complaint_status_dist,
        },
        "tickets": {
            "open": tickets_open,
            "total": tickets_total,
            "last_24h": tickets_24h,
            "status_distribution": ticket_status_dist,
        },
        "refunds": {
            "pending": refunds_pending,
            "total": refunds_total,
            "last_24h": refunds_24h,
            "status_distribution": refund_status_dist,
        },
        "safety_reports": {
            "open": safety_reports_open,
            "total": safety_reports_total,
            "last_24h": safety_reports_24h,
        },
        "staff": {
            "active": active_staff,
        },
        "notifications": {
            "unread": unread_notifications,
        },
    }
