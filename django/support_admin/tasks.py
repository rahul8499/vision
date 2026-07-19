from celery import shared_task
from django.utils import timezone
from django.core.cache import cache

from complaints.models import Complaint, PlatformSupportTicket
from prescription.models import SafetyReport
from .models import ContactLog, RefundRequest, SLAConfiguration, SupportNotification, SupportStaff
from .services import audit_service, complaint_service, notification_service, refund_service, sla_service, ticket_service


@shared_task
def record_support_runtime_heartbeat():
    value = timezone.now().isoformat()
    cache.set("support_runtime_heartbeat", value, timeout=180)
    return value


@shared_task
def send_due_follow_up_reminders():
    """Create one durable alert for each due follow-up."""
    due_logs = ContactLog.objects.filter(
        status="scheduled",
        follow_up_at__isnull=False,
        follow_up_at__lte=timezone.now(),
    ).exclude(outcome="resolved").select_related("content_type", "created_by")[:500]
    created = 0
    for log in due_logs:
        entity_id = str(log.id)
        if SupportNotification.objects.filter(
            recipient=log.created_by,
            notification_type="follow_up",
            entity_type="contact_log",
            entity_id=entity_id,
        ).exists():
            continue
        SupportNotification.objects.create(
            recipient=log.created_by,
            notification_type="follow_up",
            title="Follow-up is due",
            message=f"Follow up on {log.content_type.model.replace('_', ' ')} #{log.object_id}: {log.note or 'No note added.'}",
            entity_type="contact_log",
            entity_id=entity_id,
        )
        created += 1
    return {"created": created}


def _first_reply_done(entity_type, obj):
    if entity_type in {"complaint", "ticket"}:
        return obj.messages.filter(sender_type="platform").exists()
    if entity_type == "refund":
        return bool(obj.reviewed_by_id)
    return obj.admin_actions.exists()


def _priority(entity_type, obj):
    return getattr(obj, "severity", None) or getattr(obj, "priority", None) or ("high" if entity_type == "refund" and obj.status == "failed" else "default")


def _eligible(entity_type, obj):
    if entity_type == "refund":
        return notification_service.eligible_staff_for_case("CITY", obj.charge.city_id)
    return notification_service.eligible_staff_for_case(getattr(obj, "scope", "GLOBAL"), getattr(obj, "city_id", None))


def _assignee(entity_type, obj):
    value = obj.assigned_to_id if entity_type in {"refund", "safety_report"} else obj.assigned_to
    return SupportStaff.objects.filter(id=value, is_active=True).first() if value else None


def _assign_least_loaded(entity_type, obj):
    candidates = list(_eligible(entity_type, obj).filter(role__in=["agent", "supervisor"]))
    if not candidates:
        return None
    staff = min(candidates, key=lambda item: notification_service.active_case_count(item))
    if entity_type == "complaint":
        complaint_service.claim_unassigned_complaint(obj.id, staff)
    elif entity_type == "ticket":
        ticket_service.claim_unassigned_ticket(obj.id, staff)
    elif entity_type == "refund":
        refund_service.claim_unassigned_refund(obj.id, staff)
    else:
        values = {"assigned_to_id": staff.id}
        if obj.status == "submitted":
            values["status"] = "under_review"
        updated = SafetyReport.objects.filter(pk=obj.pk, assigned_to_id__isnull=True).update(**values)
        if not updated:
            return None
        notification_service.create_assignment_notification(recipient=staff, title="Safety issue assigned to you", message=f"Safety issue #{obj.id}", entity_type="safety_report", entity_id=obj.id)
    return staff


@shared_task
def monitor_support_sla_deadlines():
    """Send idempotent warnings/escalations and apply explicitly enabled assignment rules."""
    policies = {(item.entity_type, item.priority): item for item in SLAConfiguration.objects.filter(is_active=True)}
    groups = {
        "complaint": Complaint.objects.exclude(status__in=["resolved", "closed", "rejected", "withdrawn"]),
        "ticket": PlatformSupportTicket.objects.exclude(status__in=["resolved", "closed"]),
        "refund": RefundRequest.objects.filter(status__in=["pending", "approved", "failed"]).select_related("charge"),
        "safety_report": SafetyReport.objects.exclude(status="closed"),
    }
    warnings = escalations = assignments = 0
    for entity_type, queryset in groups.items():
        for obj in queryset.iterator(chunk_size=200):
            policy = policies.get((entity_type, _priority(entity_type, obj))) or policies.get((entity_type, "default"))
            if not policy:
                continue
            assignee = _assignee(entity_type, obj)
            if not assignee and policy.auto_assign:
                try:
                    assignee = _assign_least_loaded(entity_type, obj)
                    assignments += bool(assignee)
                    if assignee:
                        audit_service.log_audit(None, "automatic_case_assignment", entity_type, obj.id, new_data={"assigned_to": str(assignee.id), "rule": "least_active_cases"})
                except ValueError:
                    assignee = _assignee(entity_type, obj)
            deadline, clock = sla_service.deadline_for(obj, policy, _first_reply_done(entity_type, obj))
            stage = deadline["stage"]
            if deadline["state"] == "due_soon" and assignee and clock.warning_stage != stage:
                SupportNotification.objects.create(recipient=assignee, notification_type="sla_warning", title="Case deadline is close", message=f"{entity_type.replace('_', ' ').title()} #{obj.id} needs action before its deadline.", entity_type=entity_type, entity_id=str(obj.id))
                clock.warning_stage = stage
                clock.save(update_fields=["warning_stage", "updated_at"])
                warnings += 1
            if deadline["state"] == "overdue" and policy.auto_escalate and clock.escalated_stage != stage:
                recipients = list(_eligible(entity_type, obj).filter(role__in=["supervisor", "admin"]))
                for recipient in recipients:
                    SupportNotification.objects.create(recipient=recipient, notification_type="sla_escalation", title="Case deadline missed", message=f"{entity_type.replace('_', ' ').title()} #{obj.id} is overdue and needs senior-team attention.", entity_type=entity_type, entity_id=str(obj.id))
                if recipients:
                    clock.breached_stage = stage
                    clock.escalated_stage = stage
                    clock.save(update_fields=["breached_stage", "escalated_stage", "updated_at"])
                    escalations += 1
                    audit_service.log_audit(None, "automatic_sla_escalation", entity_type, obj.id, new_data={"stage": stage, "recipients": [item.id for item in recipients]})
    return {"warnings": warnings, "escalations": escalations, "assignments": assignments}
