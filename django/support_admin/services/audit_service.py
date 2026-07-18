from django.utils import timezone
from ..models import SupportAuditLog, SupportStaff


def log_audit(actor, action, entity_type, entity_id, old_data=None, new_data=None, ip_address=None, user_agent=None):
    if not actor or not isinstance(actor, SupportStaff):
        actor = None

    log = SupportAuditLog.objects.create(
        actor=actor,
        action=action,
        entity_type=entity_type,
        entity_id=str(entity_id),
        old_data=old_data or {},
        new_data=new_data or {},
        ip_address=ip_address,
        user_agent=user_agent or "",
    )
    return log


def get_audit_logs(filters=None):
    qs = SupportAuditLog.objects.select_related("actor__user")
    if filters:
        if filters.get("actor"):
            qs = qs.filter(actor_id=filters["actor"])
        if filters.get("action"):
            qs = qs.filter(action__iexact=filters["action"])
        if filters.get("entity_type"):
            qs = qs.filter(entity_type__iexact=filters["entity_type"])
        if filters.get("entity_id"):
            qs = qs.filter(entity_id__iexact=filters["entity_id"])
        if filters.get("created_from"):
            qs = qs.filter(created_at__date__gte=filters["created_from"])
        if filters.get("created_to"):
            qs = qs.filter(created_at__date__lte=filters["created_to"])
    return qs.order_by("-created_at")
