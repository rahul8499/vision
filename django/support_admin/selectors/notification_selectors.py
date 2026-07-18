from ..models import SupportNotification
from django.db.models import Q


def get_notification_by_id(notification_id, staff):
    try:
        return SupportNotification.objects.get(id=notification_id, recipient=staff)
    except SupportNotification.DoesNotExist:
        return None


def get_notification_queryset_for_staff(staff):
    return SupportNotification.objects.filter(recipient=staff).all()


def search_notifications(staff, is_read=None, notification_type=None, page=1, page_size=20):
    qs = get_notification_queryset_for_staff(staff)
    if is_read is not None:
        qs = qs.filter(is_read=is_read)
    if notification_type:
        qs = qs.filter(notification_type__iexact=notification_type)
    return qs.order_by("-created_at"), qs.count()
