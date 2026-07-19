from datetime import timedelta

from django.db.models import Avg, Count, DurationField, ExpressionWrapper, F, OuterRef, Q, Subquery, Sum
from django.db.models.functions import TruncDate
from django.utils import timezone

from complaints.models import Complaint, ComplaintMessage, ComplaintStatusHistory, PlatformSupportMessage, PlatformSupportTicket, PlatformSupportTicketStatusHistory, SupportCaseRating
from prescription.models import SafetyReport
from ..models import RefundRequest, SupportNotification, SupportStaff


def _scope(queryset, staff):
    if not staff or staff.role == SupportStaff.ROLE_ADMIN or staff.all_cities_access:
        return queryset
    city_ids = list(staff.cities.values_list("id", flat=True))
    fields = {field.name for field in queryset.model._meta.fields}
    if "scope" in fields:
        return queryset.filter(Q(scope="GLOBAL") | Q(city_id__in=city_ids))
    if queryset.model is RefundRequest:
        return queryset.filter(charge__city_id__in=city_ids)
    if "city" in fields:
        return queryset.filter(city_id__in=city_ids)
    return queryset


def _trend(queryset, start, days=14):
    counts = dict(queryset.filter(created_at__date__gte=start).annotate(day=TruncDate("created_at")).values_list("day").annotate(total=Count("id")))
    return [{"date": (start + timedelta(days=offset)).isoformat(), "count": counts.get(start + timedelta(days=offset), 0)} for offset in range(days)]


def _hours(value):
    return round(value.total_seconds() / 3600, 1) if value else None


def _minutes(value):
    return round(value.total_seconds() / 60, 1) if value else None


def _agent_performance(complaints, tickets, viewer=None):
    rows = []
    staff_queryset = SupportStaff.objects.filter(is_active=True).select_related("user")
    if viewer and viewer.role == SupportStaff.ROLE_AGENT:
        staff_queryset = staff_queryset.filter(pk=viewer.pk)
    for staff in staff_queryset:
        complaint_ids = ComplaintStatusHistory.objects.filter(changed_by_staff=staff, to_status__in=["resolved", "closed"]).values("complaint_id")
        ticket_ids = PlatformSupportTicketStatusHistory.objects.filter(changed_by_staff=staff, to_status__in=["resolved", "closed"]).values("ticket_id")
        complaint_first_ids = ComplaintMessage.objects.filter(complaint_id=OuterRef("complaint_id"), sender_type="platform").order_by("created_at").values("id")[:1]
        ticket_first_ids = PlatformSupportMessage.objects.filter(ticket_id=OuterRef("ticket_id"), sender_type="platform").order_by("created_at").values("id")[:1]
        complaint_times = ComplaintMessage.objects.filter(support_staff=staff, id=Subquery(complaint_first_ids)).annotate(duration=ExpressionWrapper(F("created_at") - F("complaint__created_at"), output_field=DurationField()))
        ticket_times = PlatformSupportMessage.objects.filter(support_staff=staff, id=Subquery(ticket_first_ids)).annotate(duration=ExpressionWrapper(F("created_at") - F("ticket__created_at"), output_field=DurationField()))
        durations = [item.duration for item in complaint_times] + [item.duration for item in ticket_times]
        average_response = sum((item.total_seconds() for item in durations), 0) / len(durations) / 60 if durations else None
        satisfaction = SupportCaseRating.objects.filter(credited_staff=staff).aggregate(value=Avg("rating"))["value"]
        rows.append({
            "agent_id": str(staff.id),
            "agent_name": staff.user.get_full_name() or staff.user.username or staff.user.email,
            "tickets_resolved": tickets.filter(id__in=ticket_ids, status__in=["resolved", "closed"]).count(),
            "complaints_resolved": complaints.filter(id__in=complaint_ids, status__in=["resolved", "closed"]).count(),
            "avg_response_time_minutes": round(average_response, 1) if average_response is not None else None,
            "satisfaction_score": round(float(satisfaction), 2) if satisfaction is not None else None,
        })
    return sorted(rows, key=lambda row: -(row["tickets_resolved"] + row["complaints_resolved"]))


def get_dashboard_summary(staff=None):
    now = timezone.localdate()
    trend_start = now - timedelta(days=13)
    complaints = _scope(Complaint.objects.all(), staff)
    tickets = _scope(PlatformSupportTicket.objects.all(), staff)
    refunds = _scope(RefundRequest.objects.all(), staff)
    safety = _scope(SafetyReport.objects.all(), staff)

    first_complaint_reply = ComplaintMessage.objects.filter(complaint_id=OuterRef("pk"), sender_type="platform").order_by("created_at").values("created_at")[:1]
    first_ticket_reply = PlatformSupportMessage.objects.filter(ticket_id=OuterRef("pk"), sender_type="platform").order_by("created_at").values("created_at")[:1]
    complaint_resolution = complaints.filter(resolved_at__isnull=False).annotate(duration=ExpressionWrapper(F("resolved_at") - F("created_at"), output_field=DurationField())).aggregate(value=Avg("duration"))["value"]
    ticket_response = tickets.annotate(first_reply=Subquery(first_ticket_reply)).filter(first_reply__isnull=False).annotate(duration=ExpressionWrapper(F("first_reply") - F("created_at"), output_field=DurationField())).aggregate(value=Avg("duration"))["value"]
    complaint_response = complaints.annotate(first_reply=Subquery(first_complaint_reply)).filter(first_reply__isnull=False).annotate(duration=ExpressionWrapper(F("first_reply") - F("created_at"), output_field=DurationField())).aggregate(value=Avg("duration"))["value"]

    decided = refunds.filter(status__in=["approved", "processed", "rejected"])
    approved_count = decided.filter(status__in=["approved", "processed"]).count()
    decided_count = decided.count()
    processed_amount = refunds.filter(status="processed").aggregate(total=Sum("amount"))["total"] or 0

    return {
        "complaints": {"open": complaints.filter(status__in=["open", "under_review", "awaiting_info"]).count(), "total": complaints.count(), "resolved": complaints.filter(status__in=["resolved", "closed"]).count(), "average_resolution_hours": _hours(complaint_resolution), "average_first_response_minutes": _minutes(complaint_response), "status_distribution": dict(complaints.values_list("status").annotate(count=Count("id")).order_by()), "trend": _trend(complaints, trend_start)},
        "tickets": {"open": tickets.filter(status__in=["open", "in_progress", "waiting_for_user"]).count(), "total": tickets.count(), "average_first_response_minutes": _minutes(ticket_response), "status_distribution": dict(tickets.values_list("status").annotate(count=Count("id")).order_by()), "trend": _trend(tickets, trend_start)},
        "refunds": {"pending": refunds.filter(status="pending").count(), "total": refunds.count(), "approval_rate": round(approved_count * 100 / decided_count, 1) if decided_count else None, "processed_amount": float(processed_amount), "status_distribution": dict(refunds.values_list("status").annotate(count=Count("id")).order_by()), "trend": _trend(refunds, trend_start)},
        "safety_reports": {"open": safety.filter(status__in=["submitted", "under_review", "escalated"]).count(), "total": safety.count(), "critical": safety.filter(severity="critical").exclude(status="closed").count()},
        "staff": {"active": SupportStaff.objects.filter(is_active=True).count()},
        "notifications": {"unread": SupportNotification.objects.filter(recipient=staff, is_read=False).count() if staff else SupportNotification.objects.filter(is_read=False).count()},
        "agent_performance": _agent_performance(complaints, tickets, staff),
    }
