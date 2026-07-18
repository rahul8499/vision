from django.db.models import Q
from django.utils import timezone
from ..selectors.ticket_selectors import get_ticket_by_id, get_ticket_queryset
from complaints.models import PlatformSupportTicket, PlatformSupportMessage
from complaints.models import PlatformSupportTicket, PlatformSupportMessage
from ..models import SupportStaff, SupportAssignment
from django.contrib.contenttypes.models import ContentType


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
