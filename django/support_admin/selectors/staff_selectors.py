from ..models import SupportStaff
from django.db.models import Q


def get_staff_by_id(staff_id):
    try:
        return SupportStaff.objects.select_related("user").get(id=staff_id)
    except SupportStaff.DoesNotExist:
        return None


def get_staff_by_employee_id(employee_id):
    try:
        return SupportStaff.objects.select_related("user").get(employee_id=employee_id)
    except SupportStaff.DoesNotExist:
        return None


def get_staff_queryset():
    return SupportStaff.objects.select_related("user").all()


def search_staff(query=None, role=None, is_active=None, department=None, page=1, page_size=20):
    qs = get_staff_queryset()
    if query:
        qs = qs.filter(
            Q(user__first_name__icontains=query) |
            Q(user__last_name__icontains=query) |
            Q(user__email__icontains=query) |
            Q(employee_id__icontains=query) |
            Q(phone__icontains=query)
        )
    if role:
        qs = qs.filter(role=role)
    if is_active is not None:
        qs = qs.filter(is_active=is_active)
    if department:
        qs = qs.filter(department__icontains=department)
    return qs.order_by("-created_at"), qs.count()
