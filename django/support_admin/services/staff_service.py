from django.contrib.auth import get_user_model
from django.db import transaction
from ..models import SupportStaff, SupportAssignment, SupportNotification
from ..selectors.staff_selectors import get_staff_by_id, get_staff_by_employee_id, get_staff_queryset
from .notification_service import list_notifications

User = get_user_model()


def list_staff(filters=None):
    qs = get_staff_queryset()
    if filters:
        if filters.get("role"):
            qs = qs.filter(role=filters["role"])
        if filters.get("is_active") is not None:
            qs = qs.filter(is_active=filters["is_active"])
        if filters.get("department"):
            qs = qs.filter(department__icontains=filters["department"])
        if filters.get("created_from"):
            qs = qs.filter(created_at__date__gte=filters["created_from"])
        if filters.get("created_to"):
            qs = qs.filter(created_at__date__lte=filters["created_to"])
    return qs.select_related("user")


def create_staff(data, created_by):
    with transaction.atomic():
        user = User.objects.create(
            name=data["name"],
            email=data["email"],
            password=data["password"],
        )
        staff = SupportStaff.objects.create(
            user=user,
            role=data.get("role", SupportStaff.ROLE_AGENT),
            employee_id=data["employee_id"],
            department=data.get("department", ""),
            phone=data.get("phone", ""),
            created_by=created_by,
        )
        return staff


def update_staff(staff, data):
    if "is_active" in data:
        staff.is_active = data["is_active"]
    if "role" in data:
        staff.role = data["role"]
    if "department" in data:
        staff.department = data["department"]
    if "phone" in data:
        staff.phone = data["phone"]
    if "timezone" in data:
        staff.timezone = data["timezone"]
    staff.save()
    return staff


def activate_staff(staff_id):
    staff = get_staff_by_id(staff_id)
    if not staff:
        raise ValueError("Staff not found.")
    staff.is_active = True
    staff.save(update_fields=["is_active"])
    return staff


def reset_staff_password(staff, new_password):
    user = staff.user
    user.password = new_password
    user.save()


def get_staff_notifications(staff, filters=None):
    return list_notifications(staff, filters)
