import django_filters
from django.contrib.contenttypes.models import ContentType
from .models import SupportStaff, SupportAssignment, InternalNote, RefundRequest, SafetyReportAction, SupportAuditLog, SupportNotification


class SupportStaffFilter(django_filters.FilterSet):
    role = django_filters.ChoiceFilter(choices=SupportStaff.ROLE_CHOICES)
    is_active = django_filters.BooleanFilter()
    created_from = django_filters.DateFilter(field_name="created_at", lookup_expr="date__gte")
    created_to = django_filters.DateFilter(field_name="created_at", lookup_expr="date__lte")

    class Meta:
        model = SupportStaff
        fields = ["role", "is_active", "department"]


class RefundRequestFilter(django_filters.FilterSet):
    status = django_filters.ChoiceFilter(choices=RefundRequest.STATUS_CHOICES)
    assigned_to = django_filters.NumberFilter(field_name="assigned_to__id")
    requested_by = django_filters.NumberFilter(field_name="requested_by__id")
    created_from = django_filters.DateFilter(field_name="created_at", lookup_expr="date__gte")
    created_to = django_filters.DateFilter(field_name="created_at", lookup_expr="date__lte")
    amount_min = django_filters.NumberFilter(field_name="amount", lookup_expr="gte")
    amount_max = django_filters.NumberFilter(field_name="amount", lookup_expr="lte")

    class Meta:
        model = RefundRequest
        fields = ["status", "assigned_to", "requested_by"]


class SafetyReportActionFilter(django_filters.FilterSet):
    action = django_filters.ChoiceFilter(choices=SafetyReportAction.ACTION_CHOICES)
    admin = django_filters.NumberFilter(field_name="admin__id")
    created_from = django_filters.DateFilter(field_name="created_at", lookup_expr="date__gte")
    created_to = django_filters.DateFilter(field_name="created_at", lookup_expr="date__lte")

    class Meta:
        model = SafetyReportAction
        fields = ["action", "admin"]


class SupportAuditLogFilter(django_filters.FilterSet):
    actor = django_filters.NumberFilter(field_name="actor__id")
    action = django_filters.CharFilter(lookup_expr="iexact")
    entity_type = django_filters.CharFilter(lookup_expr="iexact")
    entity_id = django_filters.CharFilter(lookup_expr="iexact")
    created_from = django_filters.DateFilter(field_name="created_at", lookup_expr="date__gte")
    created_to = django_filters.DateFilter(field_name="created_at", lookup_expr="date__lte")

    class Meta:
        model = SupportAuditLog
        fields = ["actor", "action", "entity_type", "entity_id"]


class SupportNotificationFilter(django_filters.FilterSet):
    is_read = django_filters.BooleanFilter()
    notification_type = django_filters.CharFilter(lookup_expr="iexact")

    class Meta:
        model = SupportNotification
        fields = ["is_read", "notification_type"]


class SupportAssignmentFilter(django_filters.FilterSet):
    assigned_to = django_filters.NumberFilter(field_name="assigned_to__id")
    is_active = django_filters.BooleanFilter()
    content_type_id = django_filters.NumberFilter(field_name="content_type__id")

    class Meta:
        model = SupportAssignment
        fields = ["assigned_to", "is_active", "content_type_id"]
