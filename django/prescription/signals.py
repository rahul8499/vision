from django.db import transaction
from django.db.models.signals import post_save, pre_save
from django.dispatch import receiver
import logging
from django.utils import timezone
from decimal import Decimal
from django.db.models import F, Avg
from .models import Prescription, PrescriptionResponse, PrescriptionTargetStore, Rating, Store
from core.services.repeat_customer_service import is_status_transition, record_completed_order

logger = logging.getLogger(__name__)


# ─── Store capability change detection ────────────────────────────────────────
# We snapshot the "before" values on pre_save so the post_save signal can
# detect an actual change and avoid spurious broadcasts.

@receiver(pre_save, sender=Store)
def snapshot_store_capability_fields(sender, instance, **kwargs):
    """Stash the current DB values before they are overwritten."""
    if instance.pk:
        try:
            old = Store.objects.only('is_active', 'is_verified').get(pk=instance.pk)
            instance._pre_save_is_active = old.is_active
            instance._pre_save_is_verified = old.is_verified
        except Store.DoesNotExist:
            instance._pre_save_is_active = instance.is_active
            instance._pre_save_is_verified = instance.is_verified
    else:
        # New store — no change to broadcast
        instance._pre_save_is_active = instance.is_active
        instance._pre_save_is_verified = instance.is_verified


@receiver(post_save, sender=Store)
def on_store_capability_changed(sender, instance, created, **kwargs):
    """
    Fire broadcast_store_capability_change if is_active or is_verified changed.
    Uses snapshots set by snapshot_store_capability_fields (pre_save).
    """
    if created:
        return  # New store — no existing buyers to notify

    old_active = getattr(instance, '_pre_save_is_active', instance.is_active)
    old_verified = getattr(instance, '_pre_save_is_verified', instance.is_verified)

    if old_active == instance.is_active and old_verified == instance.is_verified:
        return  # Nothing capability-relevant changed

    logger.info(
        f"[SIGNAL] Store {instance.id} capability changed: "
        f"is_active {old_active}->{instance.is_active} | "
        f"is_verified {old_verified}->{instance.is_verified}"
    )
    try:
        from .tasks import broadcast_store_capability_change
        store_id = instance.id
        transaction.on_commit(
            lambda: broadcast_store_capability_change.apply(
                args=(store_id, old_active, old_verified)
            )
        )
    except Exception as exc:
        logger.error(f"[SIGNAL] Failed to queue capability broadcast for store {instance.id}: {exc}")


# 1. Prescription uploaded → notify all nearby stores
@receiver(post_save, sender=Prescription)
def on_prescription_saved(sender, instance, created, **kwargs):
    # Dispatch is started explicitly from PrescriptionUploadView after the
    # prescription has location data. Keeping this signal passive prevents
    # duplicate dispatch jobs and makes upload behavior deterministic.
    return

# 2. Store sends response -> update conversion metrics
@receiver(post_save, sender=PrescriptionResponse)
def on_prescription_response_saved(sender, instance, created, **kwargs):
    if not created or not instance.store:
        return

    if instance.user_status in ('pending', 'quoted'):
        Store.objects.filter(id=instance.store.id).update(quotes_sent_count=F('quotes_sent_count') + 1)

# 3. Performance tracking on status change
@receiver(post_save, sender=PrescriptionResponse)
def on_response_status_performance_update(sender, instance, created, **kwargs):
    if created or not instance.store:
        return

    store_id = instance.store.id

    if is_status_transition(instance, 'accepted'):
        Store.objects.filter(id=store_id).update(orders_won_count=F('orders_won_count') + 1)

    elif is_status_transition(instance, 'completed'):
        record_completed_order(instance)

    elif is_status_transition(instance, 'cancelled') and instance.cancelled_by == 'store':
        Store.objects.filter(id=store_id).update(cancelled_orders_count=F('cancelled_orders_count') + 1)
        if instance.accepted_at:
            Store.objects.filter(id=store_id).update(quality_score=F('quality_score') - Decimal('10.0'))

# 4. Rating Saved → Update Analytics
@receiver(post_save, sender=Rating)
def on_rating_saved(sender, instance, created, **kwargs):
    if instance.target_type == 'store' and instance.order and instance.order.store:
        store = instance.order.store
        ratings = Rating.objects.filter(target_type='store', order__store=store)
        
        # Calculate new average and total safely
        agg = ratings.aggregate(avg=Avg('rating'))
        store.average_rating = agg['avg'] or 0.0
        store.total_ratings = ratings.count()
        store.save()
        logger.info(f"Updated rating for store {store.id}: {store.average_rating}")
