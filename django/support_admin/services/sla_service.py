from datetime import datetime, timedelta

from django.contrib.contenttypes.models import ContentType
from django.utils import timezone

from ..models import CaseSLAClock, SLAConfiguration, SupportHoliday


WAITING_STATUSES = {"awaiting_info", "waiting_for_user"}


def _holiday_dates():
    return set(SupportHoliday.objects.filter(is_active=True).values_list("date", flat=True))


def _is_working_day(value, policy, holidays):
    return value.weekday() in (policy.working_days or [0, 1, 2, 3, 4, 5]) and value.date() not in holidays


def sla_seconds_between(start, end, policy):
    if end <= start:
        return 0
    if not policy.working_hours_only:
        return int((end - start).total_seconds())
    holidays = _holiday_dates()
    current = timezone.localtime(start)
    finish = timezone.localtime(end)
    total = 0
    while current.date() <= finish.date():
        day_start = timezone.make_aware(datetime.combine(current.date(), policy.workday_start), timezone.get_current_timezone())
        day_end = timezone.make_aware(datetime.combine(current.date(), policy.workday_end), timezone.get_current_timezone())
        if _is_working_day(current, policy, holidays):
            interval_start = max(current, day_start)
            interval_end = min(finish, day_end)
            if interval_end > interval_start:
                total += int((interval_end - interval_start).total_seconds())
        current = timezone.make_aware(datetime.combine(current.date() + timedelta(days=1), policy.workday_start), timezone.get_current_timezone())
    return total


def add_sla_seconds(start, seconds, policy):
    if not policy.working_hours_only:
        return start + timedelta(seconds=seconds)
    holidays = _holiday_dates()
    current = timezone.localtime(start)
    remaining = int(seconds)
    while remaining > 0:
        day_start = timezone.make_aware(datetime.combine(current.date(), policy.workday_start), timezone.get_current_timezone())
        day_end = timezone.make_aware(datetime.combine(current.date(), policy.workday_end), timezone.get_current_timezone())
        if not _is_working_day(current, policy, holidays) or current >= day_end:
            current = timezone.make_aware(datetime.combine(current.date() + timedelta(days=1), policy.workday_start), timezone.get_current_timezone())
            continue
        current = max(current, day_start)
        used = min(remaining, max(0, int((day_end - current).total_seconds())))
        current += timedelta(seconds=used)
        remaining -= used
        if remaining:
            current = timezone.make_aware(datetime.combine(current.date() + timedelta(days=1), policy.workday_start), timezone.get_current_timezone())
    return current


def add_sla_minutes(start, minutes, policy):
    return add_sla_seconds(start, int(minutes * 60), policy)


def sync_clock(obj, policy=None, now=None):
    now = now or timezone.now()
    content_type = ContentType.objects.get_for_model(obj)
    clock, _ = CaseSLAClock.objects.get_or_create(content_type=content_type, object_id=obj.pk)
    pause_enabled = bool(policy and policy.pause_when_waiting)
    waiting = pause_enabled and getattr(obj, "status", "") in WAITING_STATUSES
    changed = []
    if waiting and not clock.paused_at:
        clock.paused_at = getattr(obj, "updated_at", None) or now
        changed.append("paused_at")
    elif not waiting and clock.paused_at:
        clock.paused_seconds += max(0, int((now - clock.paused_at).total_seconds()))
        clock.paused_business_seconds += sla_seconds_between(clock.paused_at, now, policy) if policy else 0
        clock.paused_at = None
        changed.extend(["paused_at", "paused_seconds", "paused_business_seconds"])
    if changed:
        clock.save(update_fields=[*changed, "updated_at"])
    return clock


def sync_case_clock(entity_type, obj, now=None):
    priority = getattr(obj, "severity", None) or getattr(obj, "priority", None) or "default"
    policy = SLAConfiguration.objects.filter(entity_type=entity_type, priority=priority, is_active=True).first() or SLAConfiguration.objects.filter(entity_type=entity_type, priority="default", is_active=True).first()
    return sync_clock(obj, policy, now)


def deadline_for(obj, policy, first_reply_done, now=None):
    now = now or timezone.now()
    clock = sync_clock(obj, policy, now)
    reference = clock.paused_at or now
    stage = "close" if first_reply_done else "first_reply"
    target_seconds = (policy.resolution_minutes if first_reply_done else policy.first_response_minutes) * 60
    elapsed = max(0, sla_seconds_between(obj.created_at, reference, policy) - clock.paused_business_seconds)
    remaining = int(target_seconds - elapsed)
    due_at = None if clock.paused_at else add_sla_seconds(obj.created_at, target_seconds + clock.paused_business_seconds, policy)
    if clock.paused_at:
        state = "paused"
    elif remaining < 0:
        state = "overdue"
    elif remaining <= policy.warning_minutes * 60:
        state = "due_soon"
    else:
        state = "on_track"
    return {"stage": stage, "due_at": due_at, "remaining_seconds": remaining, "state": state, "is_paused": bool(clock.paused_at)}, clock
