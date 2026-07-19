from django.contrib.contenttypes.models import ContentType
from django.db.models import Q
from django.utils import timezone
from django.db import transaction
from complaints.models import Complaint
from ..models import SupportStaff, SupportAssignment, InternalNote, SupportNotification
from ..selectors.complaint_selectors import get_complaint_by_id, get_complaint_queryset
from ..selectors.staff_selectors import get_staff_by_id
from complaints.models import Complaint, ComplaintMessage, ComplaintStatusHistory
from .notification_service import create_assignment_notification, eligible_staff_for_case
from . import sla_service


def assign_complaint(complaint_id, assigned_to_id, assigned_by):
    complaint = get_complaint_by_id(complaint_id)
    if not complaint:
        raise ValueError("Complaint not found.")

    staff = get_staff_by_id(assigned_to_id)
    if not staff or not staff.is_active:
        raise ValueError("Assigned staff not found or inactive.")
    if not eligible_staff_for_case(complaint.scope, complaint.city_id).filter(id=staff.id).exists():
        raise ValueError("Assigned staff does not have access to this complaint city.")

    ct = ContentType.objects.get_for_model(Complaint)
    assignment, created = SupportAssignment.objects.get_or_create(
        content_type=ct,
        object_id=complaint.id,
        defaults={
            "assigned_to": staff,
            "assigned_by": assigned_by,
            "is_active": True,
        },
    )
    if not created and (not assignment.is_active or assignment.assigned_to_id != staff.id):
        assignment.is_active = True
        assignment.assigned_to = staff
        assignment.assigned_by = assigned_by
        assignment.unassigned_at = None
        assignment.save(update_fields=["is_active", "assigned_to", "assigned_by", "unassigned_at"])

    complaint.assigned_to = str(staff.id)
    complaint.save()

    create_assignment_notification(
        recipient=staff,
        title="Complaint assigned to you",
        message=f"Complaint #{complaint.id}: {complaint.subject}",
        entity_type="complaint",
        entity_id=complaint.id,
    )

    return complaint, assignment


@transaction.atomic
def claim_unassigned_complaint(complaint_id, staff):
    complaint = Complaint.objects.select_for_update().filter(id=complaint_id).first()
    if not complaint:
        raise ValueError("Complaint not found.")
    if complaint.assigned_to:
        raise ValueError("This complaint is already assigned.")
    return assign_complaint(complaint_id, staff.id, staff)


def reply_to_complaint(
    complaint_id, text, actor, actor_type="staff", attachment=None,
    visibility=ComplaintMessage.VISIBILITY_SHARED,
):
    complaint = get_complaint_by_id(complaint_id)
    if not complaint:
        raise ValueError("Complaint not found.")

    if complaint.status in ("resolved", "rejected", "withdrawn", "closed"):
        raise ValueError("This complaint is closed. No further replies allowed.")
    if visibility not in dict(ComplaintMessage.VISIBILITY_CHOICES):
        raise ValueError("Invalid message visibility.")
    message = ComplaintMessage.objects.create(
        complaint=complaint,
        sender_type="platform",
        support_staff=actor,
        visibility=visibility,
        text=text or None,
        attachment=attachment,
        is_read=False,
    )
    return message


def add_internal_note(complaint_id, body, staff, is_pinned=False):
    complaint = get_complaint_by_id(complaint_id)
    if not complaint:
        raise ValueError("Complaint not found.")

    ct = ContentType.objects.get_for_model(Complaint)
    note = InternalNote.objects.create(
        content_type=ct,
        object_id=complaint.id,
        body=body,
        created_by=staff,
        is_pinned=is_pinned,
    )
    return note


def update_complaint_status(complaint_id, new_status, changed_by, note=None, changed_by_staff=None):
    complaint = get_complaint_by_id(complaint_id)
    if not complaint:
        raise ValueError("Complaint not found.")

    old_status = complaint.status
    if new_status not in dict(Complaint.STATUS_CHOICES):
        raise ValueError("Invalid status.")

    allowed = Complaint.STATUS_TRANSITIONS.get(old_status, [])
    if new_status not in allowed:
        raise ValueError(f"Illegal status transition from '{old_status}' to '{new_status}'.")

    sla_service.sync_case_clock("complaint", complaint)
    complaint.status = new_status
    if new_status in ("resolved", "rejected", "withdrawn", "closed"):
        complaint.resolved_at = timezone.now()
    if note:
        complaint.resolution_notes = note
    complaint.save()
    sla_service.sync_case_clock("complaint", complaint)

    ComplaintStatusHistory.objects.create(
        complaint=complaint,
        from_status=old_status,
        to_status=new_status,
        changed_by=changed_by,
        changed_by_staff=changed_by_staff,
        note=note,
    )
    return complaint


def bulk_assign_complaints(complaint_ids, assigned_to_id, assigned_by):
    results = []
    for cid in complaint_ids:
        try:
            complaint, assignment = assign_complaint(cid, assigned_to_id, assigned_by)
            results.append({"complaint_id": complaint.id, "assigned_to_id": assigned_to_id, "success": True})
        except Exception as exc:
            results.append({"complaint_id": cid, "success": False, "error": str(exc)})
    return results


def bulk_close_complaints(complaint_ids, changed_by):
    results = []
    for cid in complaint_ids:
        try:
            complaint = update_complaint_status(cid, "closed", changed_by, note="Bulk closed by admin")
            results.append({"complaint_id": complaint.id, "success": True})
        except Exception as exc:
            results.append({"complaint_id": cid, "success": False, "error": str(exc)})
    return results
