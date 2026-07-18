from django.db.models import Q
from complaints.models import PlatformSupportTicket, PlatformSupportMessage


def get_ticket_by_id(ticket_id):
    try:
        return PlatformSupportTicket.objects.select_related("city", "service_zone", "requester_user", "requester_store").prefetch_related("messages").get(id=ticket_id)
    except PlatformSupportTicket.DoesNotExist:
        return None


def get_ticket_queryset():
    return PlatformSupportTicket.objects.all()


def search_tickets(query=None, status=None, category=None, priority=None, page=1, page_size=20):
    qs = get_ticket_queryset()
    if query:
        qs = qs.filter(
            Q(subject__icontains=query) |
            Q(description__icontains=query)
        )
    if status:
        qs = qs.filter(status=status)
    if category:
        qs = qs.filter(category=category)
    if priority:
        qs = qs.filter(priority=priority)
    return qs.order_by("-updated_at"), qs.count()
