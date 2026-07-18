from django.contrib.contenttypes.models import ContentType
from django.db.models import Q
from django.utils import timezone
from complaints.models import Complaint
from ..models import SupportStaff, SupportAssignment, InternalNote, SupportNotification
from ..selectors.complaint_selectors import get_complaint_by_id, get_complaint_queryset
from complaints.models import Complaint, ComplaintMessage, ComplaintStatusHistory


def assign_complaint(complaint_id, assigned_to_id, assigned_by):
    complaint = get_complaint_by_id(complaint_id)
    if not complaint:
        raise ValueError("Complaint not found.")

    staff = get_staff_by_id(assigned_to_id)
    if not staff or not staff.is_active:
        raise ValueError("Assigned staff not found or inactive.")

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
    if not created and not assignment.is_active:
        assignment.is_active = True
        assignment.assigned_to = staff
        assignment.assigned_by = assigned_by
        assignment.save()

    complaint.assigned_to = str(staff.id)
    complaint.save()

    return complaint, assignment


def reply_to_complaint(complaint_id, text, actor, actor_type="staff", attachment=None):
    complaint = get_complaint_by_id(complaint_id)
    if not complaint:
        raise ValueError("Complaint not found.")

    if complaint.status in ("resolved", "rejected", "withdrawn", "closed"):
        raise ValueError("This complaint is closed. No further replies allowed.")

    message = ComplaintMessage.objects.create(
        complaint=complaint,
        sender_type="platform",
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


def update_complaint_status(complaint_id, new_status, changed_by, note=None):
    complaint = get_complaint_by_id(complaint_id)
    if not complaint:
        raise ValueError("Complaint not found.")

    old_status = complaint.status
    if new_status not in dict(Complaint.STATUS_CHOICES):
        raise ValueError("Invalid status.")

    allowed = Complaint.STATUS_TRANSITIONS.get(old_status, [])
    if new_status not in allowed:
        raise ValueError(f"Illegal status transition from '{old_status}' to '{new_status}'.")

    complaint.status = new_status
    if new_status in ("resolved", "rejected", "withdrawn", "closed"):
        complaint.resolved_at = timezone.now()
    if note:
        complaint.resolution_notes = note
    complaint.save()

    ComplaintStatusHistory.objects.create(
        complaint=complaint,
        from_status=old_status,
        to_status=new_status,
        changed_by=changed_by,
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
