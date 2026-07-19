from django.db.models import Q
from django.utils import timezone
from ..selectors.ticket_selectors import get_ticket_by_id, get_ticket_queryset
from complaints.models import PlatformSupportTicket, PlatformSupportMessage
from complaints.models import PlatformSupportTicket, PlatformSupportMessage
from ..models import SupportStaff, SupportAssignment
from django.contrib.contenttypes.models import ContentType
from .notification_service import create_assignment_notification, eligible_staff_for_case
from ..selectors.staff_selectors import get_staff_by_id


def assign_ticket(ticket_id, assigned_to_id, assigned_by):
    ticket = get_ticket_by_id(ticket_id)
    if not ticket:
        raise ValueError("Support ticket not found.")

    staff = get_staff_by_id(assigned_to_id)
    if not staff or not staff.is_active:
        raise ValueError("Assigned staff not found or inactive.")
    if not eligible_staff_for_case(ticket.scope, ticket.city_id).filter(id=staff.id).exists():
        raise ValueError("Assigned staff does not have access to this ticket city.")

    content_type = ContentType.objects.get_for_model(PlatformSupportTicket)
    assignment = SupportAssignment.objects.filter(
        content_type=content_type, object_id=ticket.id, is_active=True,
    ).order_by("-assigned_at").first()
    if assignment:
        assignment.assigned_to = staff
        assignment.assigned_by = assigned_by
        assignment.unassigned_at = None
        assignment.save(update_fields=["assigned_to", "assigned_by", "unassigned_at"])
    else:
        assignment = SupportAssignment.objects.create(
            content_type=content_type, object_id=ticket.id,
            assigned_to=staff, assigned_by=assigned_by,
        )
    ticket.assigned_to = str(staff.id)
    ticket.save(update_fields=["assigned_to", "updated_at"])
    create_assignment_notification(
        recipient=staff,
        title="Support ticket assigned to you",
        message=f"Ticket #{ticket.id}: {ticket.subject}",
        entity_type="ticket",
        entity_id=ticket.id,
    )
    return ticket, assignment


def reply_to_ticket(ticket_id, text, staff, attachment=None):
    ticket = get_ticket_by_id(ticket_id)
    if not ticket:
        raise ValueError("Support ticket not found.")

    if ticket.status == "closed":
        raise ValueError("This support request is closed.")

    message = PlatformSupportMessage.objects.create(
        ticket=ticket,
        sender_type="platform",
        text=text or None,
        attachment=attachment,
        is_read=False,
    )

    if ticket.status == "resolved":
        ticket.status = "open"
        ticket.resolved_at = None
        ticket.save(update_fields=["status", "resolved_at", "updated_at"])

    return message, ticket


def update_ticket_status(ticket_id, new_status, staff, resolution_note=None):
    ticket = get_ticket_by_id(ticket_id)
    if not ticket:
        raise ValueError("Support ticket not found.")

    if new_status not in dict(PlatformSupportTicket.STATUS_CHOICES):
        raise ValueError("Invalid status.")

    old_status = ticket.status
    ticket.status = new_status
    if new_status == "resolved":
        ticket.resolved_at = timezone.now()
    if resolution_note:
        ticket.resolution_note = resolution_note
    ticket.save()
    return ticket
