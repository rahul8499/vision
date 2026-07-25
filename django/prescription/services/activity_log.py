from django.utils import timezone
from ..models import ActivityLog


def log_activity(category, action, title, actor=None, subject=None, details=None):
    actor_type = ''
    actor_id = ''
    if actor is not None:
        actor_type = actor.__class__.__name__.lower()
        actor_id = str(getattr(actor, 'id', '') or '')

    subject_type = ''
    subject_id = ''
    if subject is not None:
        subject_type = subject.__class__.__name__.lower()
        subject_id = str(getattr(subject, 'id', '') or '')

    return ActivityLog.objects.create(
        category=category,
        action=action,
        title=title[:180],
        actor_type=actor_type,
        actor_id=actor_id,
        subject_type=subject_type,
        subject_id=subject_id,
        details=details or {},
        created_at=timezone.now(),
    )
