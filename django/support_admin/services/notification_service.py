from django.db.models import Q
from ..models import SupportNotification, SupportStaff
from ..selectors.notification_selectors import get_notification_by_id, get_notification_queryset_for_staff


def list_notifications(staff, filters=None):
    qs = get_notification_queryset_for_staff(staff)
    if filters:
        if filters.get("is_read") is not None:
            qs = qs.filter(is_read=filters["is_read"])
        if filters.get("notification_type"):
            qs = qs.filter(notification_type=filters["notification_type"])
    return qs.order_by("-created_at")


def mark_notification_read(staff, notification_id):
    notification = get_notification_by_id(notification_id, staff)
    if not notification:
        raise ValueError("Notification not found.")
    notification.is_read = True
    notification.save(update_fields=["is_read"])
    return notification


def get_unread_count(staff):
    return SupportNotification.objects.filter(recipient=staff, is_read=False).count()
