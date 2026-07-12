from decimal import Decimal

from django.db import transaction
from django.db.models import F


def is_status_transition(instance, target_status):
    old_status = getattr(instance, '_pre_save_user_status', None)
    return old_status != target_status and getattr(instance, 'user_status', None) == target_status


def record_completed_order(response):
    if not response.user_id or not response.store_id:
        return None

    from prescription.models import SavedMedicine, Store, UserStoreRelationship

    with transaction.atomic():
        store = Store.objects.select_for_update().get(id=response.store_id)
        relationship, _ = UserStoreRelationship.objects.select_for_update().get_or_create(
            user_id=response.user_id,
            store_id=response.store_id,
        )

        if relationship.last_completed_order_id == response.id:
            return relationship

        was_repeat = relationship.completed_order_count > 0
        relationship.completed_order_count = F('completed_order_count') + 1
        relationship.last_completed_order = response
        relationship.last_order_at = response.completed_at or response.updated_at
        relationship.is_preferred = True
        relationship.save(update_fields=[
            'completed_order_count',
            'last_completed_order',
            'last_order_at',
            'is_preferred',
            'updated_at',
        ])

        UserStoreRelationship.objects.filter(
            user_id=response.user_id,
            is_preferred=True,
        ).exclude(store_id=response.store_id).update(is_preferred=False)

        store_updates = {
            'completed_orders_count': F('completed_orders_count') + 1,
            'total_completed_value': F('total_completed_value') + (response.total_amount or Decimal('0')),
        }
        if was_repeat:
            store_updates['repeat_order_count'] = F('repeat_order_count') + 1

        Store.objects.filter(id=response.store_id).update(**store_updates)

        if response.accepted_at and response.completed_at:
            duration = (response.completed_at - response.accepted_at).total_seconds() / 60
            current_avg = float(store.avg_delivery_time_mins or 60)
            store.avg_delivery_time_mins = int((current_avg * 0.8) + (duration * 0.2))
            store.save(update_fields=['avg_delivery_time_mins'])

        ordered_at = response.completed_at or response.updated_at
        for medicine in response.medicines.all():
            if not medicine.medicine_name:
                continue
            SavedMedicine.objects.update_or_create(
                user_id=response.user_id,
                medicine_name=medicine.medicine_name.strip(),
                medicine_brand=(medicine.medicine_brand or '').strip() or None,
                medicine_type=medicine.medicine_type or 'brand',
                defaults={
                    'store_id': response.store_id,
                    'source_response': response,
                    'last_price': medicine.price,
                    'last_ordered_at': ordered_at,
                    'is_active': True,
                },
            )

        relationship.refresh_from_db()
        return relationship


def create_order_again_request(response, *, scope='all_stores'):
    if response.user_status != 'completed':
        raise ValueError('Only completed orders can be ordered again.')
    if not response.prescription_id:
        raise ValueError('Original prescription is not available.')

    from prescription.models import Prescription, PrescriptionTargetStore, Store
    from prescription.tasks import notify_nearby_stores_task

    source = response.prescription
    preferred_store = response.store
    if scope not in ('preferred_only', 'all_stores'):
        scope = 'all_stores'

    new_prescription = Prescription.objects.create(
        user=response.user,
        image=source.image,
        latitude=source.latitude,
        longitude=source.longitude,
        user_address=source.user_address,
        status=source.status,
        source_response=response,
        preferred_store=preferred_store,
        reorder_scope=scope,
    )

    preferred_available = bool(
        preferred_store
        and getattr(preferred_store, 'is_active', False)
        and getattr(preferred_store, 'is_verified', False)
        and not getattr(preferred_store, 'is_deleted', False)
        and preferred_store.latitude is not None
        and preferred_store.longitude is not None
    )

    dispatch_result = None
    if scope == 'preferred_only':
        if not preferred_available:
            new_prescription.dispatch_status = 'exhausted'
            new_prescription.dispatch_completed_at = new_prescription.uploaded_at
            new_prescription.save(update_fields=['dispatch_status', 'dispatch_completed_at'])
            return new_prescription, {'status': 'preferred_store_unavailable', 'stores_notified': 0}

        distance_km = None
        if new_prescription.latitude is not None and new_prescription.longitude is not None:
            try:
                from prescription.tasks import _haversine_km
                distance_km = _haversine_km(
                    new_prescription.latitude,
                    new_prescription.longitude,
                    preferred_store.latitude,
                    preferred_store.longitude,
                )
            except Exception:
                distance_km = None

        PrescriptionTargetStore.objects.get_or_create(
            prescription=new_prescription,
            store=preferred_store,
            defaults={
                'batch_number': 1,
                'rank_score': Decimal('100.0'),
                'distance_km': Decimal(str(round(distance_km, 2))) if distance_km is not None else None,
                'radius_min_km': None,
                'radius_max_km': None,
                'status': 'notified',
            },
        )
        Store.objects.filter(id=preferred_store.id).update(exposure_count=F('exposure_count') + 1)
        new_prescription.dispatch_status = 'active'
        new_prescription.dispatch_current_batch = 1
        new_prescription.save(update_fields=['dispatch_status', 'dispatch_current_batch'])
        try:
            from django.core.cache import cache
            cache.incr(f'store_{preferred_store.id}_cache_version')
        except Exception:
            pass
        dispatch_result = {'status': 'preferred_store_dispatched', 'stores_notified': 1}
    else:
        dispatch_result = notify_nearby_stores_task.run(new_prescription.id)

    return new_prescription, dispatch_result or {}
