from django.db.models import Q
from ..models import SupportNotification, SupportStaff
from ..selectors.notification_selectors import get_notification_by_id, get_notification_queryset_for_staff


def eligible_staff_for_case(scope="CITY", city_id=None):
    """Return only active staff allowed to see this support case."""
    qs = SupportStaff.objects.filter(is_active=True)
    if scope == "GLOBAL":
        return qs
    if city_id is None:
        return qs.filter(Q(role=SupportStaff.ROLE_ADMIN) | Q(all_cities_access=True)).distinct()
    return qs.filter(
        Q(role=SupportStaff.ROLE_ADMIN) | Q(all_cities_access=True) | Q(cities__id=city_id)
    ).distinct()


def create_scoped_notifications(*, notification_type, title, message, entity_type,
                                entity_id, scope="CITY", city_id=None,
                                assigned_to_id=None):
    recipients = eligible_staff_for_case(scope=scope, city_id=city_id)
    if assigned_to_id:
        try:
            assigned_to_id = int(assigned_to_id)
        except (TypeError, ValueError):
            assigned_to_id = None
        assigned = recipients.filter(id=assigned_to_id).first() if assigned_to_id else None
        recipients = [assigned] if assigned else []
    created = []
    for recipient in recipients:
        created.append(SupportNotification.objects.create(
            recipient=recipient,
            notification_type=notification_type,
            title=title,
            message=message,
            entity_type=entity_type,
            entity_id=str(entity_id),
        ))
    return created


def create_assignment_notification(*, recipient, title, message, entity_type, entity_id):
    if not recipient or not recipient.is_active:
        return None
    return SupportNotification.objects.create(
        recipient=recipient,
        notification_type="assignment",
        title=title,
        message=message,
        entity_type=entity_type,
        entity_id=str(entity_id),
    )


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
