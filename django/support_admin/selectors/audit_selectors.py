from ..models import SupportAuditLog
from django.db.models import Q


def get_audit_log_by_id(log_id):
    try:
        return SupportAuditLog.objects.select_related("actor__user").get(id=log_id)
    except SupportAuditLog.DoesNotExist:
        return None


def get_audit_log_queryset():
    return SupportAuditLog.objects.select_related("actor__user").all()


def search_audit_logs(actor=None, action=None, entity_type=None, entity_id=None, created_from=None, created_to=None, page=1, page_size=20):
    qs = get_audit_log_queryset()
    if actor:
        qs = qs.filter(actor_id=actor)
    if action:
        qs = qs.filter(action__iexact=action)
    if entity_type:
        qs = qs.filter(entity_type__iexact=entity_type)
    if entity_id:
        qs = qs.filter(entity_id__iexact=entity_id)
    if created_from:
        qs = qs.filter(created_at__date__gte=created_from)
    if created_to:
        qs = qs.filter(created_at__date__lte=created_to)
    return qs.order_by("-created_at"), qs.count()
