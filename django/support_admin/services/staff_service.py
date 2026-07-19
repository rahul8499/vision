from django.contrib.auth import get_user_model
from django.contrib.auth.hashers import make_password
from django.db import transaction
from django.db.models import Q
from ..models import SupportStaff, SupportAssignment, SupportNotification
from ..selectors.staff_selectors import get_staff_by_id, get_staff_by_employee_id, get_staff_queryset
from .notification_service import list_notifications

User = get_user_model()


def list_staff(filters=None):
    qs = get_staff_queryset()
    if filters:
        if filters.get("role"):
            qs = qs.filter(role=filters["role"])
        if filters.get("search"):
            value = filters["search"].strip()
            qs = qs.filter(Q(user__name__icontains=value) | Q(user__email__icontains=value) | Q(employee_id__icontains=value) | Q(phone__icontains=value))
        if filters.get("is_active") is not None:
            qs = qs.filter(is_active=str(filters["is_active"]).lower() in ("1", "true", "yes"))
        if filters.get("department"):
            qs = qs.filter(department__icontains=filters["department"])
        if filters.get("created_from"):
            qs = qs.filter(created_at__date__gte=filters["created_from"])
        if filters.get("created_to"):
            qs = qs.filter(created_at__date__lte=filters["created_to"])
    return qs.select_related("user").prefetch_related("cities")


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
            all_cities_access=data.get("all_cities_access", False),
        )
        if not staff.all_cities_access:
            staff.cities.set(data.get("cities", []))
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
    if "all_cities_access" in data:
        staff.all_cities_access = data["all_cities_access"]
    staff.save()
    if "cities" in data and not staff.all_cities_access:
        staff.cities.set(data["cities"])
    elif staff.all_cities_access:
        staff.cities.clear()
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
    user.password = make_password(new_password)
    user.save(update_fields=["password"])


def get_staff_notifications(staff, filters=None):
    return list_notifications(staff, filters)
