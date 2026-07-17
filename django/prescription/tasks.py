from celery import shared_task
import logging
from .models import PrescriptionResponse, Prescription
from django.utils import timezone
from datetime import timedelta
from decimal import Decimal
import math
import uuid

logger = logging.getLogger(__name__)


def _send_user_notification(user, title, body, data=None, dedupe_key=None):
    from .utils.app_notifications import send_user_app_notification
    return send_user_app_notification(user, title, body, data or {}, dedupe_key=dedupe_key)


def _send_store_notification(store, title, body, data=None, dedupe_key=None):
    from .utils.app_notifications import send_store_app_notification
    return send_store_app_notification(store, title, body, data or {}, dedupe_key=dedupe_key)


# ============================================================
# Single notification task (for notes / direct messages)
# ============================================================
@shared_task(
    bind=True,
    max_retries=3,
    default_retry_delay=30,
    queue='notifications',
    rate_limit='500/m',
)
def send_push_task(self, expo_push_token, title, body, data=None):
    """Celery task to send a single Expo push notification."""
    from .utils.notifications import send_push_notification
    try:
        result = send_push_notification(expo_push_token, title=title, body=body, data=data)
        return result
    except Exception as e:
        logger.error(f"send_push_task error: {e}")
        raise self.retry(exc=e)


def _haversine_km(lat1, lon1, lat2, lon2):
    try:
        lat1, lon1 = float(lat1), float(lon1)
        lat2, lon2 = float(lat2), float(lon2)
    except (TypeError, ValueError):
        return None

    radius = 6371
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(dlon / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return radius * c


DISPATCH_BATCH_PLAN = [
    {
        "label": "0-10_top20",
        "components": [
            {"label": "0-10_top20", "min_km": 0, "max_km": 10, "limit": 20},
        ],
    },
    {
        "label": "0-10_remaining_plus_10-20_top20",
        "components": [
            {"label": "0-10_remaining", "min_km": 0, "max_km": 10, "limit": None},
            {"label": "10-20_top20", "min_km": 10, "max_km": 20, "limit": 20},
        ],
    },
    {
        "label": "10-20_remaining_plus_20-30_top20",
        "components": [
            {"label": "10-20_remaining", "min_km": 10, "max_km": 20, "limit": None},
            {"label": "20-30_top20", "min_km": 20, "max_km": 30, "limit": 20},
        ],
    },
    {
        "label": "remaining_verified",
        "components": [
            {"label": "remaining_verified", "min_km": 0, "max_km": None, "limit": None},
        ],
    },
]


def _store_dispatch_score(store, distance_km, prescription_status, radius_km=10):
    radius_for_score = max(float(radius_km or 30), float(distance_km or 0), 1.0)
    distance_score = max(0.0, 1.0 - (float(distance_km or radius_for_score) / radius_for_score))

    avg_response = float(store.avg_response_time_mins or 30)
    speed_score = 1.0 / (1.0 + (avg_response / 15.0))

    exposure_count = int(store.exposure_count or 0)
    quotes_sent_count = int(store.quotes_sent_count or 0)
    if exposure_count >= 5:
        response_rate_score = min(1.0, quotes_sent_count / max(exposure_count, 1))
    else:
        response_rate_score = 0.65

    if store.total_ratings >= 5:
        rating_score = min(1.0, float(store.average_rating or 0) / 5.0)
    else:
        rating_score = 0.70

    verified_score = 1.0 if store.is_verified else 0.35
    fairness_score = 1.0 / (1.0 + (float(store.exposure_count or 0) / 50.0))

    if prescription_status == 'emergency':
        weights = {
            "distance": 0.25,
            "speed": 0.35,
            "response_rate": 0.20,
            "verified": 0.10,
            "rating": 0.05,
            "fairness": 0.05,
        }
    else:
        weights = {
            "distance": 0.30,
            "speed": 0.25,
            "response_rate": 0.20,
            "verified": 0.10,
            "rating": 0.10,
            "fairness": 0.05,
        }

    score = (
        distance_score * weights["distance"]
        + speed_score * weights["speed"]
        + response_rate_score * weights["response_rate"]
        + verified_score * weights["verified"]
        + rating_score * weights["rating"]
        + fairness_score * weights["fairness"]
    ) * 100
    return round(score, 4)


def get_ranked_dispatch_candidates(
    prescription,
    radius_km=10,
    exclude_store_ids=None,
    min_radius_km=0,
    max_radius_km=None,
):
    """
    Returns [(score, store, distance_km)] for verified active stores in radius.
    Kept import-safe so views can preview the first batch for the upload response.
    """
    from .models import Store

    exclude_store_ids = set(exclude_store_ids or [])
    stores = Store.objects.filter(
        is_active=True,
        is_verified=True,
        is_deleted=False,
        latitude__isnull=False,
        longitude__isnull=False,
    )
    if exclude_store_ids:
        stores = stores.exclude(id__in=exclude_store_ids)

    scored = []

    upper_radius = max_radius_km if max_radius_km is not None else radius_km

    if prescription.location and upper_radius is not None:
        try:
            from django.contrib.gis.db.models.functions import Distance
            from django.contrib.gis.measure import D

            stores = stores.filter(
                location__isnull=False,
                location__distance_lte=(prescription.location, D(km=upper_radius))
            ).annotate(distance=Distance('location', prescription.location))

            for store in stores:
                distance_km = store.distance.km if store.distance is not None else None
                if distance_km is None:
                    continue
                if distance_km < min_radius_km:
                    continue
                if upper_radius is not None and distance_km > upper_radius:
                    continue
                score = _store_dispatch_score(store, distance_km, prescription.status, upper_radius)
                scored.append((score, store, distance_km))
        except Exception as exc:
            logger.warning(f"PostGIS dispatch ranking fallback for Rx {prescription.id}: {exc}")
            stores = Store.objects.filter(
                is_active=True,
                is_verified=True,
                is_deleted=False,
                latitude__isnull=False,
                longitude__isnull=False,
            )
            if exclude_store_ids:
                stores = stores.exclude(id__in=exclude_store_ids)

    if not scored:
        stores = Store.objects.filter(
            is_active=True,
            is_verified=True,
            is_deleted=False,
            latitude__isnull=False,
            longitude__isnull=False,
        )
        if exclude_store_ids:
            stores = stores.exclude(id__in=exclude_store_ids)

        for store in stores:
            distance_km = _haversine_km(
                prescription.latitude,
                prescription.longitude,
                store.latitude,
                store.longitude,
            )
            if distance_km is None:
                continue
            if distance_km < min_radius_km:
                continue
            if upper_radius is not None and distance_km > upper_radius:
                continue
            score = _store_dispatch_score(store, distance_km, prescription.status, upper_radius or max(distance_km, 30))
            scored.append((score, store, distance_km))

    scored.sort(key=lambda item: item[0], reverse=True)
    return scored


def get_dispatch_batch_candidates(prescription, notified_store_ids, batch_number):
    """
    Selects stores according to the production coverage plan:
    B1: 0-10 top 20
    B2: 0-10 remaining + 10-20 top 20
    B3: 10-20 remaining + 20-30 top 20
    B4: all remaining verified stores
    """
    notified_store_ids = set(notified_store_ids or [])
    start_index = min(max(batch_number - 1, 0), len(DISPATCH_BATCH_PLAN) - 1)

    for plan_index in range(start_index, len(DISPATCH_BATCH_PLAN)):
        plan = DISPATCH_BATCH_PLAN[plan_index]
        selected = []
        selected_store_ids = set()

        for component in plan["components"]:
            exclude_ids = notified_store_ids | selected_store_ids
            ranked = get_ranked_dispatch_candidates(
                prescription,
                radius_km=component["max_km"] or 30,
                exclude_store_ids=exclude_ids,
                min_radius_km=component["min_km"],
                max_radius_km=component["max_km"],
            )
            limit = component["limit"] if component["limit"] is not None else len(ranked)

            for score, store, distance_km in ranked[:limit]:
                selected.append((score, store, distance_km, component))
                selected_store_ids.add(store.id)

        if selected:
            return plan, selected

    return None, []


def _bump_store_prescription_cache(store_ids):
    from django.core.cache import cache

    for store_id in store_ids:
        key = f"store_{store_id}_cache_version"
        try:
            cache.incr(key)
        except ValueError:
            cache.set(key, 1, timeout=None)


def _broadcast_prescription_batch(prescription_id, store_ids):
    from asgiref.sync import async_to_sync
    from channels.layers import get_channel_layer
    from .models import Prescription, Store
    from .serializers import PrescriptionSerializer
    from .utils.notifications import send_push_notification_batch
    from .utils.app_notifications import create_app_notification_for_store

    prescription = Prescription.objects.select_related('user').get(id=prescription_id)
    stores = Store.objects.filter(id__in=store_ids)
    store_map = {store.id: store for store in stores}
    channel_layer = get_channel_layer()
    push_notifications = []

    for store_id in store_ids:
        store = store_map.get(store_id)
        if not store:
            continue

        distance_km = _haversine_km(
            prescription.latitude,
            prescription.longitude,
            store.latitude,
            store.longitude,
        )

        prescription.distance = distance_km if distance_km is not None else 0
        prescription.store_lat = store.latitude
        prescription.store_lon = store.longitude
        prescription.store_address = store.address
        prescription.has_responded = False

        ws_data = PrescriptionSerializer(prescription).data
        ws_data['store_latitude'] = store.latitude
        ws_data['store_longitude'] = store.longitude
        ws_data['store_address'] = store.address
        ws_data['has_responded'] = False

        try:
            async_to_sync(channel_layer.group_send)(
                f"store_{store.id}_fulfillment",
                {
                    "type": "fulfillment_update",
                    "event_id": str(uuid.uuid4()),
                    "seq": prescription.id,
                    "action": "new_prescription",
                    "data": ws_data,
                }
            )
        except Exception as exc:
            logger.error(f"Store WS dispatch failed store={store.id} rx={prescription.id}: {exc}")

        title = "Emergency: New Rx" if prescription.status == 'emergency' else "New Prescription Nearby"
        body = f"A prescription request is {round(distance_km or 0, 1)} km away. Send a quote quickly."
        data = {"prescription_id": prescription.id, "type": "NEW_PRESCRIPTION"}
        create_app_notification_for_store(
            store,
            title,
            body,
            data,
            dedupe_key=f"store:{store.id}:rx:{prescription.id}:new_prescription",
        )

        if store.expo_push_token:
            push_notifications.append({
                "to": store.expo_push_token,
                "sound": "default",
                "title": title,
                "body": body,
                "data": data,
            })

    if push_notifications:
        try:
            send_push_notification_batch(push_notifications)
        except Exception as exc:
            logger.error(f"Batch push dispatch failed rx={prescription.id}: {exc}")


def _broadcast_ai_analysis_update(prescription):
    from asgiref.sync import async_to_sync
    from channels.layers import get_channel_layer
    from .models import PrescriptionResponse, PrescriptionTargetStore

    try:
        store_ids = set(
            PrescriptionTargetStore.objects
            .filter(prescription=prescription)
            .values_list('store_id', flat=True)
        )
        store_ids.update(
            PrescriptionResponse.objects
            .filter(prescription=prescription)
            .values_list('store_id', flat=True)
        )
        store_ids.discard(None)

        if not store_ids:
            return

        payload = {
            'prescription_id': prescription.id,
            'prescription_upload_type': prescription.user_upload_type,
            'prescription_ai_status': prescription.ai_status,
            'prescription_ai_classification': prescription.ai_classification,
            'prescription_ai_score': prescription.ai_score,
            'prescription_ai_reason': prescription.ai_reason,
            'user_upload_type': prescription.user_upload_type,
            'ai_status': prescription.ai_status,
            'ai_classification': prescription.ai_classification,
            'ai_score': prescription.ai_score,
            'ai_reason': prescription.ai_reason,
        }
        seq = int(timezone.now().timestamp() * 1000)
        channel_layer = get_channel_layer()

        for store_id in store_ids:
            async_to_sync(channel_layer.group_send)(
                f"store_{store_id}_fulfillment",
                {
                    'type': 'fulfillment_update',
                    'event_id': str(uuid.uuid4()),
                    'seq': seq,
                    'action': 'ai_analysis_update',
                    'data': payload,
                }
            )
    except Exception as exc:
        logger.error(f"[AI] Failed to broadcast AI update for Rx {prescription.id}: {exc}")


# ============================================================
# Batch task: notify all nearby stores for a prescription
# (does geolocation work inside Celery — not in signal)
# ============================================================
@shared_task(
    bind=True,
    max_retries=2,
    default_retry_delay=60,
    queue='notifications',
    time_limit=120,
)
def notify_nearby_stores_task(self, prescription_id):
    """
    Maximum coverage dispatch:
      Batch 1 -> 0-10 km top 20.
      Batch 2 -> 0-10 km remaining + 10-20 km top 20.
      Batch 3 -> 10-20 km remaining + 20-30 km top 20.
      Final  -> all remaining active verified stores.
      Stop once enough quotations arrive.
    """
    from django.core.cache import cache
    from django.db import transaction
    from django.db.models import F
    from .models import Prescription, Store, PrescriptionTargetStore
    import time

    lock_key = f"lock_dispatch_rx_{prescription_id}"
    if not cache.add(lock_key, "locked", timeout=240):
        logger.warning(f"Dispatch lock active for Rx {prescription_id}. Skipping parallel run.")
        return

    metrics = {
        "prescription_id": prescription_id,
        "started_at": time.time(),
        "batch_number": None,
        "quotes_count": 0,
        "notified_count": 0,
        "status": "unknown",
    }

    try:
        with transaction.atomic():
            prescription = Prescription.objects.select_for_update().get(id=prescription_id)

            quotes_count = PrescriptionResponse.objects.filter(prescription=prescription).count()
            metrics["quotes_count"] = quotes_count
            if quotes_count >= prescription.dispatch_min_quotes:
                prescription.dispatch_status = 'completed'
                prescription.dispatch_next_check_at = None
                prescription.dispatch_completed_at = timezone.now()
                prescription.save(update_fields=[
                    'dispatch_status',
                    'dispatch_next_check_at',
                    'dispatch_completed_at',
                ])
                metrics["status"] = "completed_enough_quotes"
                return metrics

            if not prescription.latitude or not prescription.longitude:
                prescription.dispatch_status = 'exhausted'
                prescription.dispatch_next_check_at = None
                prescription.dispatch_completed_at = timezone.now()
                prescription.save(update_fields=[
                    'dispatch_status',
                    'dispatch_next_check_at',
                    'dispatch_completed_at',
                ])
                metrics["status"] = "exhausted_missing_location"
                return metrics

            now = timezone.now()
            if prescription.dispatch_current_batch and prescription.dispatch_next_check_at:
                latest_batch = prescription.dispatch_current_batch
                latest_targets = PrescriptionTargetStore.objects.filter(
                    prescription=prescription,
                    batch_number=latest_batch,
                )
                earliest_notified = latest_targets.order_by('notified_at').values_list('notified_at', flat=True).first()
                opened_count = latest_targets.filter(opened_at__isnull=False).count()
                early_seconds = 45 if prescription.status == 'emergency' else 90

                if now < prescription.dispatch_next_check_at:
                    can_expand_early = (
                        opened_count == 0
                        and earliest_notified
                        and (now - earliest_notified).total_seconds() >= early_seconds
                    )
                    if not can_expand_early:
                        remaining_seconds = max(
                            1,
                            int((prescription.dispatch_next_check_at - now).total_seconds())
                        )
                        notify_nearby_stores_task.apply_async((prescription_id,), countdown=remaining_seconds)
                        metrics["status"] = "waiting_for_batch_window"
                        metrics["opened_count"] = opened_count
                        return metrics

            notified_store_ids = set(PrescriptionTargetStore.objects.filter(
                prescription=prescription
            ).values_list('store_id', flat=True))

            next_batch = (prescription.dispatch_current_batch or 0) + 1
            plan, batch = get_dispatch_batch_candidates(
                prescription,
                notified_store_ids=notified_store_ids,
                batch_number=next_batch,
            )

            metrics["batch_number"] = next_batch
            metrics["radius_stage"] = plan["label"] if plan else None

            if not batch:
                prescription.dispatch_status = 'exhausted'
                prescription.dispatch_next_check_at = None
                prescription.dispatch_completed_at = timezone.now()
                prescription.save(update_fields=[
                    'dispatch_status',
                    'dispatch_next_check_at',
                    'dispatch_completed_at',
                ])
                metrics["status"] = "exhausted_no_more_stores"
                return metrics

            targets = [
                PrescriptionTargetStore(
                    prescription=prescription,
                    store=store,
                    batch_number=next_batch,
                    rank_score=Decimal(str(score)),
                    distance_km=Decimal(str(round(distance_km, 2))),
                    radius_min_km=Decimal(str(component["min_km"])) if component["min_km"] is not None else None,
                    radius_max_km=Decimal(str(component["max_km"])) if component["max_km"] is not None else None,
                    notified_at=now,
                    status='notified',
                )
                for score, store, distance_km, component in batch
            ]
            PrescriptionTargetStore.objects.bulk_create(targets, ignore_conflicts=True)

            store_ids = [store.id for _, store, _, _ in batch]
            Store.objects.filter(id__in=store_ids).update(exposure_count=F('exposure_count') + 1)

            wait_seconds = 120 if prescription.status == 'emergency' else 300
            early_seconds = 45 if prescription.status == 'emergency' else 90
            prescription.dispatch_status = 'active'
            prescription.dispatch_current_batch = next_batch
            prescription.dispatch_next_check_at = now + timedelta(seconds=wait_seconds)
            prescription.save(update_fields=[
                'dispatch_status',
                'dispatch_current_batch',
                'dispatch_next_check_at',
            ])

            metrics["notified_count"] = len(store_ids)
            metrics["status"] = "batch_dispatched"

        _bump_store_prescription_cache(store_ids)
        _broadcast_prescription_batch(prescription_id, store_ids)
        notify_nearby_stores_task.apply_async((prescription_id,), countdown=early_seconds)
        return metrics
    finally:
        metrics["duration"] = round(time.time() - metrics["started_at"], 3)
        logger.info(f"DISPATCH_STATS: {metrics}")
        cache.delete(lock_key)


# ============================================================
# Single targeted store notification
# ============================================================
@shared_task(
    bind=True,
    max_retries=3,
    default_retry_delay=30,
    queue='notifications',
    rate_limit='500/m',
)
def notify_targeted_store_task(self, store_id, prescription_id):
    """Notify a specific store that a user has selected them."""
    from .models import Store
    try:
        store = Store.objects.get(id=store_id)
    except Store.DoesNotExist:
        return

    _send_store_notification(
        store,
        title="New order request",
        body="You have been selected to provide a quotation for a prescription.",
        data={"prescription_id": prescription_id, "type": "TARGETED_ORDER"},
        dedupe_key=f"store:{store.id}:rx:{prescription_id}:targeted_order",
    )


# ============================================================
# Notify user when store sends a quotation response
# ============================================================
@shared_task(
    bind=True,
    max_retries=3,
    default_retry_delay=30,
    queue='notifications',
    rate_limit='500/m',
)
def notify_user_response_task(self, user_id, prescription_id, response_id, store_name):
    """Notify user that a store has sent them a quotation."""
    from .models import User
    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return

    _send_user_notification(
        user,
        title=f"New quotation from {store_name}",
        body="A pharmacy has responded to your prescription. Tap to view.",
        data={
            "prescription_id": prescription_id,
            "response_id": response_id,
            "type": "PRESCRIPTION_RESPONSE",
        },
        dedupe_key=f"user:{user.id}:response:{response_id}:quotation",
    )

# ============================================================
# Notify store when user accepts an offer or selects delivery
# ============================================================
@shared_task(
    bind=True,
    max_retries=3,
    default_retry_delay=30,
    queue='notifications',
    rate_limit='500/m',
)
def notify_store_order_accepted_task(self, response_id, event_type):
    """
    Notify the store that the user has accepted their offer
    or selected a delivery method.
    event_type: 'ACCEPTED' or 'DELIVERY_SELECTED'
    """
    from .models import PrescriptionResponse
    try:
        response = PrescriptionResponse.objects.select_related('store', 'user').get(id=response_id)
    except PrescriptionResponse.DoesNotExist:
        return

    store = response.store
    user = response.user

    if not store:
        return

    title = ""
    body = ""
    if event_type == 'ACCEPTED':
        title = "✅ Quotation Accepted!"
        body = f"Customer {user.name} has accepted your quotation for RX #{response.prescription_id}."
    elif event_type == 'DELIVERY_SELECTED':
        delivery_mode = response.get_delivery_option_display()
        title = "🚚 Delivery Method Selected"
        body = f"Customer {user.name} selected '{delivery_mode}' for RX #{response.prescription_id}."
    if title and body:
        _send_store_notification(
            store,
            title=title,
            body=body,
            data={
                "response_id": response_id,
                "prescription_id": response.prescription_id,
                "type": event_type,
            },
            dedupe_key=f"store:{store.id}:response:{response_id}:{event_type}",
        )

# ============================================================
# Accountability Loop: 10-min check for refresh requests
# ============================================ ==============
@shared_task(
    bind=True,
    max_retries=1,
    queue='notifications',
)
def enforce_pharmacist_accountability(self, response_id):
    """
    Check if pharmacist responded to a stock refresh request within 10 mins.
    If they didn't, mark as unresponsive and notify the user.
    """
    from .models import PrescriptionResponse
    try:
        response = PrescriptionResponse.objects.select_related('store', 'user').get(id=response_id)
        
        # If last check was done AFTER the refresh request, they are RESPONSIVE
        if response.stock_verified_at and response.last_refresh_requested_at:
            if response.stock_verified_at > response.last_refresh_requested_at:
                # They responded, all good. reset unresponsive just in case.
                response.is_unresponsive = False
                response.save()
                return "Pharmacist was responsive."

        # If they haven't refreshed, mark as unresponsive
        response.is_unresponsive = True
        response.save()

        _send_user_notification(
            response.user,
            title="Pharmacist is unresponsive",
            body=f"{response.store.name} has not responded to your refresh request. You may want to check other offers.",
            data={"response_id": response_id, "type": "STORE_UNRESPONSIVE"},
            dedupe_key=f"user:{response.user.id}:response:{response_id}:store_unresponsive",
        )
        return "Pharmacist marked as UNRESPONSIVE."

    except PrescriptionResponse.DoesNotExist:
        return "Response not found."

# ============================================================
# Notify other party on new chat message
# ============================================================
@shared_task(
    bind=True,
    max_retries=2,
    default_retry_delay=10,
    queue='notifications',
    rate_limit='2000/m',
)
def notify_chat_message_task(self, thread_id, sender_type, message_text):
    """
    Notify the user or store when they receive a new chat message.
    Designed for high throughput.
    """
    from .models import ChatThread
    try:
        # Fetch thread to know who receives the message
        thread = ChatThread.objects.select_related('user', 'store').get(id=thread_id)
    except ChatThread.DoesNotExist:
        return "Thread not found."

    from .utils.app_notifications import send_chat_message_push_notification

    send_chat_message_push_notification(thread, sender_type, message_text)
    return "Chat push notification processed."


# ============================================================
# 🕒 Order Freshness Monitor: Auto-Expire Stale Quotes
# ============================================================
@shared_task(queue='notifications')
def expire_stale_quotes_task():
    """
    Elite Guard: Find all quotes in 'pending' or 'quoted' state that are older than 24h
    and mark them as 'expired'. Also handles prescriptions with 0 quotes.
    """

    expiry_time = timezone.now() - timedelta(hours=24)
    
    # 1. Expire stale responses
    stale_responses = PrescriptionResponse.objects.filter(
        user_status__in=['pending', 'quoted'],
        created_at__lt=expiry_time
    )
    
    resp_count = 0
    for resp in stale_responses:
        resp.user_status = 'expired'
        resp.save(user_context="lifecycle_monitor")
        resp_count += 1

    # 2. Expire prescriptions with NO quotes after 48h
    prescription_expiry = timezone.now() - timedelta(hours=48)
    stale_prescriptions = Prescription.objects.filter(
        uploaded_at__lt=prescription_expiry,
        responses__isnull=True
    ).exclude(status='expired') # Assuming status might have expired
    
    # Note: Prescription model doesn't have 'expired' status yet in choices, 
    # but we can log them or update if we add the field.
    
    return f"Expired {resp_count} responses."


# ============================================================
# 🚨 Accountability Monitor: Alert for stuck 'Accepted' orders
# ============================================================
@shared_task(queue='notifications')
def monitor_stale_accepted_orders_task():
    """
    Find orders that were accepted by user but store hasn't started 
    processing for more than 1 hour. Notify the store to take action.
    """
    from .models import PrescriptionResponse
    from django.utils import timezone
    from datetime import timedelta
    
    warning_time = timezone.now() - timedelta(hours=1)
    stuck_orders = PrescriptionResponse.objects.filter(
        user_status='accepted',
        accepted_at__lt=warning_time,
        is_processing_started=False
    )
    
    count = 0
    for order in stuck_orders:
        if order.store:
            _send_store_notification(
                order.store,
                title="Action required: pending order",
                body=f"Order for {order.user.name} is still waiting for you to start processing.",
                data={"response_id": order.id, "type": "ORDER_STUCK_ALERT"},
                dedupe_key=f"store:{order.store.id}:response:{order.id}:stuck_accepted",
            )
            count += 1
            
    return f"Sent {count} alerts for stuck orders."

# ============================================================
# 🧹 Master Lifecycle Sweep: Periodic cleanup & nag
# ============================================================
@shared_task(queue='notifications')
def lifecycle_monitor_sweep():
    """
    The 'Central Nervous System' of order monitoring.
    Runs every 30-60 mins to catch edge cases.
    """
    from .models import PrescriptionResponse
    from django.utils import timezone
    from datetime import timedelta

    now = timezone.now()
    
    # 🚨 1. AUTO-CANCEL 'accepted' orders not moved to 'processing' for 6h
    stuck_accepted = PrescriptionResponse.objects.filter(
        user_status='accepted',
        accepted_at__lt=now - timedelta(hours=6)
    )
    for order in stuck_accepted:
        order.user_status = 'cancelled'
        order.cancel_reason = "Auto-cancelled: Store did not start processing within 6 hours."
        order.cancelled_by = 'system'
        order.save(user_context="lifecycle_monitor")
        
        _send_user_notification(
            order.user,
            "Order cancelled",
            "Your order was cancelled because the store didn't start processing it in time.",
            {"response_id": order.id, "type": "ORDER_AUTO_CANCELLED"},
            dedupe_key=f"user:{order.user.id}:response:{order.id}:auto_cancelled",
        )
        _send_store_notification(
            order.store,
            "Order lost",
            f"Order for {order.user.name} was auto-cancelled due to inactivity.",
            {"response_id": order.id, "type": "ORDER_AUTO_CANCELLED_STORE"},
            dedupe_key=f"store:{order.store.id}:response:{order.id}:auto_cancelled",
        )

    # 🚨 2. ALERT for orders in 'processing' for > 12h without status change
    stuck_processing = PrescriptionResponse.objects.filter(
        user_status='processing',
        processing_at__lt=now - timedelta(hours=12)
    )
    for order in stuck_processing:
        if order.store:
            _send_store_notification(
                order.store,
                "Critical: stuck in processing",
                f"Order for {order.user.name} has been in processing for 12 hours. Please complete or lock it.",
                data={"response_id": order.id, "type": "STUCK_PROCESSING_ALERT"},
                dedupe_key=f"store:{order.store.id}:response:{order.id}:stuck_processing",
            )

    return f"Lifecycle sweep completed at {now}"


# ============================================================
# 📡 Real-Time Store Capability Broadcast
# Triggered when a store's is_active or is_verified changes.
# Pushes store_capability_changed to the seller and affected buyers via
# their fulfillment WebSocket groups so visible cards update in real time.
# ============================================================
@shared_task(
    bind=True,
    max_retries=2,
    default_retry_delay=15,
    queue='notifications',
    rate_limit='100/m',
)
def broadcast_store_capability_change(self, store_id, old_is_active, old_is_verified):
    """
    Push the changed store capability flags to the seller and to buyers who
    have an active response from this store. Frontends patch/refetch in-place.
    """
    from asgiref.sync import async_to_sync
    from channels.layers import get_channel_layer
    from .models import Store, PrescriptionResponse
    from core.services.capability_service import get_capability_flags

    logger.info(f"[CAPABILITY_BROADCAST] store={store_id} old_active={old_is_active} old_verified={old_is_verified}")

    try:
        store = Store.objects.get(id=store_id)
    except Store.DoesNotExist:
        logger.warning(f"[CAPABILITY_BROADCAST] Store {store_id} not found — skipping.")
        return

    # Only broadcast if something actually changed
    if store.is_active == old_is_active and store.is_verified == old_is_verified:
        logger.info(f"[CAPABILITY_BROADCAST] No real change for store {store_id} — skipping.")
        return

    # Find all buyers who have a non-terminal response from this store
    TERMINAL_STATUSES = ('completed', 'cancelled', 'expired', 'rejected')
    active_responses = PrescriptionResponse.objects.filter(
        store=store
    ).exclude(
        user_status__in=TERMINAL_STATUSES
    ).select_related('user', 'prescription').distinct()

    channel_layer = get_channel_layer()
    # Compute capability flags once (same for all buyers for this store state)
    flags = get_capability_flags(store=store)

    response_ids_for_store = list(active_responses.values_list('id', flat=True))
    seller_payload = {
        "store_id": store_id,
        "response_ids": response_ids_for_store,
        "is_store_active": store.is_active,
        "is_store_verified": store.is_verified,
        "capabilities": flags,
        "updated_at": timezone.now().isoformat(),
    }

    try:
        async_to_sync(channel_layer.group_send)(
            f"store_{store_id}_fulfillment",
            {
                "type": "fulfillment_update",
                "event_id": str(uuid.uuid4()),
                "action": "store_capability_changed",
                "data": seller_payload,
            }
        )
    except Exception as exc:
        logger.error(f"[CAPABILITY_BROADCAST] WS send failed store={store_id}: {exc}")

    responses_by_user = {}
    for response in active_responses:
        user = response.user
        if not user:
            continue
        responses_by_user.setdefault(user.id, []).append(response.id)

    notified_user_ids = set()
    for user_id, response_ids in responses_by_user.items():
        try:
            async_to_sync(channel_layer.group_send)(
                f"user_{user_id}_fulfillment",
                {
                    "type": "fulfillment_update",
                    "event_id": str(uuid.uuid4()),
                    "action": "store_capability_changed",
                    "data": {
                        "store_id": store_id,
                        "response_ids": response_ids,
                        "is_store_active": store.is_active,
                        "is_store_verified": store.is_verified,
                        "capabilities": flags,
                        "updated_at": timezone.now().isoformat(),
                    },
                }
            )
            notified_user_ids.add(user_id)
        except Exception as exc:
            logger.error(f"[CAPABILITY_BROADCAST] WS send failed user={user_id} store={store_id}: {exc}")

    logger.info(f"[CAPABILITY_BROADCAST] Done — notified {len(notified_user_ids)} buyers for store {store_id}.")
    return f"Notified {len(notified_user_ids)} buyers."


# ============================================================
# AI Microservice - Image Analysis Task
# ============================================================
@shared_task(
    bind=True,
    max_retries=2,
    default_retry_delay=10,
    queue='notifications',
)
def analyze_prescription_image_task(self, prescription_id):
    """
    Sends the uploaded prescription image to the AI FastAPI microservice
    for classification and updates the prescription record.
    AI is advisory only — it never blocks Home Delivery.
    """
    import requests
    import os

    try:
        from .models import Prescription
        prescription = Prescription.objects.get(id=prescription_id)

        # Skip if no image uploaded
        if not prescription.image:
            prescription.ai_status = 'completed'
            prescription.ai_classification = 'unknown'
            prescription.save(update_fields=['ai_status', 'ai_classification'])
            _broadcast_ai_analysis_update(prescription)
            return "No image, skipped AI analysis."

        prescription.ai_status = 'processing'
        prescription.save(update_fields=['ai_status'])

        ai_url = os.environ.get('AI_CLASSIFIER_URL', 'http://127.0.0.1:8010/classify-prescription-image')

        try:
            # Storage-agnostic: FieldFile.open() works for local disk, S3 and
            # other remote Django storage backends. Never access .path because
            # cloud storage intentionally has no absolute local filesystem path.
            import mimetypes
            filename = os.path.basename(prescription.image.name) or f'prescription-{prescription.id}.jpg'
            content_type = mimetypes.guess_type(filename)[0] or 'application/octet-stream'
            prescription.image.open('rb')
            try:
                response = requests.post(
                    ai_url,
                    files={'file': (filename, prescription.image.file, content_type)},
                    data={'user_upload_type': prescription.user_upload_type},
                    timeout=60,
                )
            finally:
                prescription.image.close()
        except requests.RequestException as exc:
            prescription.ai_classification = 'unknown'
            prescription.ai_score = 0.0
            prescription.ai_reason = f"AI service unavailable: {exc}"
            prescription.ocr_text = ''
            prescription.ai_status = 'completed'
            prescription.save(update_fields=[
                'ai_classification', 'ai_score', 'ai_reason', 'ocr_text', 'ai_status'
            ])
            _broadcast_ai_analysis_update(prescription)
            logger.warning(f"[AI] Prescription {prescription_id} completed as unknown: {prescription.ai_reason}")
            return "AI analysis done: completed_unknown"

        try:
            data = response.json()
        except ValueError:
            data = {}

        if response.status_code == 200:
            prescription.ai_classification = data.get("classification") or "unknown"
            try:
                score = float(data.get('score', 0.0) or 0.0)
            except (TypeError, ValueError):
                score = 0.0
            # Persist a stable 0..1 score. This also tolerates a service that
            # returns percentage-style values such as 85 instead of 0.85.
            if score > 1.0 and score <= 100.0:
                score /= 100.0
            prescription.ai_score = max(0.0, min(1.0, score))
            prescription.ai_reason = data.get("reason", "")
            prescription.ocr_text = data.get("ocr_text", "")
            prescription.ai_status = 'completed'
        else:
            detail = data.get("reason") or data.get("detail") or response.text[:200]
            prescription.ai_classification = 'unknown'
            prescription.ai_score = 0.0
            prescription.ai_reason = f"AI service returned {response.status_code}: {detail}"
            prescription.ocr_text = data.get("ocr_text", "")
            prescription.ai_status = 'completed'

        prescription.save(update_fields=[
            'ai_classification', 'ai_score', 'ai_reason', 'ocr_text', 'ai_status'
        ])
        _broadcast_ai_analysis_update(prescription)
        logger.info(
            f"[AI] Prescription {prescription_id} status={prescription.ai_status} "
            f"classified_as={prescription.ai_classification} reason={prescription.ai_reason}"
        )
        return f"AI analysis done: {prescription.ai_status}"

    except Exception as e:
        logger.error(f"[AI] analyze_prescription_image_task failed for id={prescription_id}: {e}")
        try:
            from .models import Prescription
            prescription = Prescription.objects.get(id=prescription_id)
            prescription.ai_classification = 'unknown'
            prescription.ai_score = 0.0
            prescription.ai_status = 'completed'
            prescription.ai_reason = f"AI analysis error: {e}"
            prescription.save(update_fields=['ai_classification', 'ai_score', 'ai_status', 'ai_reason'])
            _broadcast_ai_analysis_update(prescription)
        except Exception:
            pass
        return f"AI analysis failed: {e}"
