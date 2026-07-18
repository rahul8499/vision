import hashlib
import hmac
from datetime import timedelta

import razorpay
from django.conf import settings
from django.db import transaction
from django.db.models import F
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from .models import (
    City,
    CityEmergencyPolicy,
    EmergencyBroadcastCharge,
    EmergencyFeePolicy,
    EmergencyRewardLedger,
    EmergencyStoreRewardProfile,
    UserEmergencyEntitlement,
    ServiceZone,
)


def get_policy():
    policy = EmergencyFeePolicy.objects.filter(enabled=True).order_by("pk").first()
    if policy:
        return policy
    return EmergencyFeePolicy.objects.create()


def get_default_city():
    city = City.objects.filter(is_active=True, is_default=True).order_by("pk").first()
    if city:
        return city
    city, _ = City.objects.get_or_create(
        name="Default Service Area",
        state="Unassigned",
        defaults={"timezone": "Asia/Kolkata", "is_active": True, "is_default": True},
    )
    if not city.is_default:
        city.is_default = True
        city.save(update_fields=["is_default"])
    return city


def resolve_city_zone(point):
    if point:
        zone = ServiceZone.objects.filter(is_active=True, boundary__covers=point).select_related("city").first()
        if zone:
            return zone.city, zone
        city = City.objects.filter(is_active=True, is_default=False, boundary__covers=point).first()
        if city:
            return city, None
    return get_default_city(), None


def backfill_geo_assignments(city=None, service_zone=None):
    """Re-scope existing location records after an admin saves a boundary."""
    from prescription.models import Prescription, PrescriptionTargetStore, Store
    if service_zone and service_zone.boundary:
        stores = Store.objects.filter(location__coveredby=service_zone.boundary)
        prescriptions = Prescription.objects.filter(location__coveredby=service_zone.boundary)
        stores.update(city=service_zone.city, service_zone=service_zone)
        prescriptions.update(city=service_zone.city, service_zone=service_zone)
        PrescriptionTargetStore.objects.filter(prescription__in=prescriptions).update(
            city=service_zone.city, service_zone=service_zone
        )
        EmergencyBroadcastCharge.objects.filter(prescription__in=prescriptions).update(
            city=service_zone.city, service_zone=service_zone
        )
        return
    if city and city.boundary:
        stores = Store.objects.filter(location__coveredby=city.boundary)
        prescriptions = Prescription.objects.filter(location__coveredby=city.boundary)
        stores.update(city=city, service_zone=None)
        prescriptions.update(city=city, service_zone=None)
        PrescriptionTargetStore.objects.filter(prescription__in=prescriptions).update(
            city=city, service_zone=None
        )
        EmergencyBroadcastCharge.objects.filter(prescription__in=prescriptions).update(
            city=city, service_zone=None
        )


def get_effective_dispatch_policy(city=None, service_zone=None, request_type="emergency"):
    global_policy = get_policy()
    values = {
        "first_store_reminder_seconds": global_policy.first_store_reminder_seconds,
        "second_store_reminder_seconds": global_policy.second_store_reminder_seconds,
        "support_escalation_seconds": global_policy.support_escalation_seconds,
        "max_store_reminders": global_policy.max_store_reminders,
        "reminders_enabled": global_policy.reminders_enabled,
        "support_escalation_enabled": global_policy.support_escalation_enabled,
        "manual_reminder_cooldown_seconds": global_policy.manual_reminder_cooldown_seconds,
        "manual_reminder_daily_limit": global_policy.manual_reminder_daily_limit,
        "quote_wait_minutes": global_policy.quote_wait_minutes,
    }
    if request_type == "normal":
        values.update({
            "first_store_reminder_seconds": global_policy.normal_first_store_reminder_seconds,
            "second_store_reminder_seconds": global_policy.normal_second_store_reminder_seconds,
            "support_escalation_seconds": global_policy.normal_support_escalation_seconds,
        })
    override = None
    if service_zone:
        override = CityEmergencyPolicy.objects.filter(service_zone=service_zone, is_active=True).first()
    if not override and city:
        override = CityEmergencyPolicy.objects.filter(city=city, service_zone__isnull=True, is_active=True).first()
    if override:
        for key in (
            "first_store_reminder_seconds", "second_store_reminder_seconds",
            "support_escalation_seconds", "max_store_reminders",
            "reminders_enabled", "support_escalation_enabled",
            "manual_reminder_cooldown_seconds", "manual_reminder_daily_limit",
        ):
            source_key = f"normal_{key}" if request_type == "normal" and key in {
                "first_store_reminder_seconds", "second_store_reminder_seconds", "support_escalation_seconds"
            } else key
            value = getattr(override, source_key)
            if value is not None:
                values[key] = value
    values["city_id"] = city.id if city else None
    values["service_zone_id"] = service_zone.id if service_zone else None
    values["request_type"] = request_type
    return values


def razorpay_client():
    if not settings.RAZORPAY_KEY_ID or not settings.RAZORPAY_KEY_SECRET:
        raise ValidationError({"error": "Emergency payment gateway is not configured.", "code": "payment_not_configured"})
    return razorpay.Client(auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET))


def serialize_charge(charge):
    prescription = charge.prescription
    prescription_data = None
    dispatch = {
        "sent_to_stores": charge.stores_notified_count,
        "opened_by_stores": 0,
        "responded_stores": 0,
        "valid_quotes": charge.valid_quotes_count,
        "current_batch": 0,
        "status": None,
    }
    if prescription:
        targets = list(prescription.target_stores.all())
        responses = list(prescription.responses.all())
        valid_responses = [item for item in responses if str(item.user_status or "").lower() not in {"rejected", "dismissed", "expired", "cancelled"}]
        dispatch = {
            "sent_to_stores": max(charge.stores_notified_count, len(targets)),
            "opened_by_stores": sum(1 for item in targets if item.opened_at),
            "responded_stores": sum(1 for item in targets if item.responded_at or item.status == "responded"),
            "valid_quotes": max(charge.valid_quotes_count, len(valid_responses)),
            "current_batch": prescription.dispatch_current_batch,
            "status": prescription.dispatch_status,
        }
        prescription_data = {
            "id": prescription.id,
            "medicine_name": prescription.medicine_name,
            "description": prescription.description,
            "image": prescription.image.url if prescription.image else None,
            "status": prescription.status,
            "created_at": prescription.uploaded_at,
            "cancelled_at": prescription.emergency_cancelled_at,
        }
    return {
        "id": str(charge.id),
        "kind": charge.kind,
        "status": charge.status,
        "amount_paise": charge.amount_paise,
        "amount_rupees": charge.amount_paise / 100,
        "currency": charge.currency,
        "razorpay_order_id": charge.razorpay_order_id,
        "razorpay_payment_id": charge.razorpay_payment_id,
        "razorpay_refund_id": charge.razorpay_refund_id,
        "provider_refund_status": charge.provider_refund_status,
        "refund_reason": charge.refund_reason,
        "last_refund_error": charge.last_refund_error,
        "authorized_at": charge.authorized_at,
        "broadcast_started_at": charge.broadcast_started_at,
        "refund_requested_at": charge.refund_requested_at,
        "service_delivered_at": charge.service_delivered_at,
        "refunded_at": charge.refunded_at,
        "created_at": charge.created_at,
        "prescription": prescription_data,
        "dispatch": dispatch,
    }


@transaction.atomic
def create_charge(user, idempotency_key):
    existing = EmergencyBroadcastCharge.objects.filter(
        user=user, idempotency_key=idempotency_key
    ).first()
    if existing:
        return existing

    policy = get_policy()
    entitlement, _ = UserEmergencyEntitlement.objects.select_for_update().get_or_create(user=user)
    now = timezone.now()
    expires_at = now + timedelta(minutes=policy.checkout_expiry_minutes)

    if entitlement.free_broadcasts_used < policy.free_broadcasts_per_user:
        entitlement.free_broadcasts_used = F("free_broadcasts_used") + 1
        entitlement.save(update_fields=["free_broadcasts_used", "updated_at"])
        return EmergencyBroadcastCharge.objects.create(
            user=user,
            kind=EmergencyBroadcastCharge.Kind.FREE,
            status=EmergencyBroadcastCharge.Status.AUTHORIZED,
            amount_paise=0,
            idempotency_key=idempotency_key,
            expires_at=expires_at,
            authorized_at=now,
        )

    charge = EmergencyBroadcastCharge.objects.create(
        user=user,
        kind=EmergencyBroadcastCharge.Kind.PAID,
        status=EmergencyBroadcastCharge.Status.PAYMENT_PENDING,
        amount_paise=policy.amount_paise,
        idempotency_key=idempotency_key,
        expires_at=expires_at,
    )
    order = razorpay_client().order.create(
        {
            "amount": policy.amount_paise,
            "currency": "INR",
            "receipt": f"emg_{str(charge.id)[:24]}",
            "notes": {"charge_id": str(charge.id), "user_id": str(user.id), "service": "emergency_broadcast"},
        }
    )
    charge.razorpay_order_id = order["id"]
    charge.save(update_fields=["razorpay_order_id", "updated_at"])
    return charge


@transaction.atomic
def verify_payment(user, charge_id, payment_id, signature):
    charge = EmergencyBroadcastCharge.objects.select_for_update().get(id=charge_id, user=user)
    if charge.status == EmergencyBroadcastCharge.Status.AUTHORIZED:
        return charge
    if charge.status != EmergencyBroadcastCharge.Status.PAYMENT_PENDING:
        raise ValidationError({"error": "This emergency payment cannot be verified.", "code": "invalid_charge_status"})
    expected = hmac.new(
        settings.RAZORPAY_KEY_SECRET.encode(),
        f"{charge.razorpay_order_id}|{payment_id}".encode(),
        hashlib.sha256,
    ).hexdigest()
    if not hmac.compare_digest(expected, signature):
        raise ValidationError({"error": "Payment signature is invalid.", "code": "invalid_payment_signature"})
    payment = razorpay_client().payment.fetch(payment_id)
    if payment.get("order_id") != charge.razorpay_order_id or int(payment.get("amount", 0)) != charge.amount_paise:
        raise ValidationError({"error": "Payment does not match this broadcast.", "code": "payment_mismatch"})
    if payment.get("status") == "authorized":
        razorpay_client().payment.capture(payment_id, charge.amount_paise, {"currency": charge.currency})
    elif payment.get("status") != "captured":
        raise ValidationError({"error": "Payment has not completed.", "code": "payment_not_captured"})
    charge.razorpay_payment_id = payment_id
    charge.status = EmergencyBroadcastCharge.Status.AUTHORIZED
    charge.authorized_at = timezone.now()
    charge.save(update_fields=["razorpay_payment_id", "status", "authorized_at", "updated_at"])
    return charge


def validate_charge_for_upload(user, charge_id):
    if not charge_id:
        raise ValidationError({"emergency_charge_id": "Emergency broadcast authorization is required.", "code": "emergency_charge_required"})
    try:
        charge = EmergencyBroadcastCharge.objects.get(id=charge_id, user=user)
    except (EmergencyBroadcastCharge.DoesNotExist, ValueError):
        raise ValidationError({"emergency_charge_id": "Emergency broadcast authorization was not found.", "code": "invalid_emergency_charge"})
    if not charge.is_usable:
        raise ValidationError({"emergency_charge_id": "Emergency broadcast authorization is used, expired, or unpaid.", "code": "emergency_charge_unavailable"})
    return charge


@transaction.atomic
def bind_charge(user, charge_id, prescription):
    charge = EmergencyBroadcastCharge.objects.select_for_update().get(id=charge_id, user=user)
    if not charge.is_usable:
        if prescription.pk:
            prescription.delete()
        raise ValidationError({"emergency_charge_id": "Emergency broadcast authorization is no longer available."})
    city, service_zone = prescription.city, prescription.service_zone
    if not city and prescription.location:
        city, service_zone = resolve_city_zone(prescription.location)
        prescription.city, prescription.service_zone = city, service_zone
        prescription.save(update_fields=["city", "service_zone"])
    policy_snapshot = get_effective_dispatch_policy(city, service_zone, "emergency")
    charge.prescription = prescription
    charge.city = city
    charge.service_zone = service_zone
    charge.policy_snapshot = policy_snapshot
    charge.status = EmergencyBroadcastCharge.Status.BROADCASTING
    charge.broadcast_started_at = timezone.now()
    charge.save(update_fields=["prescription", "city", "service_zone", "policy_snapshot", "status", "broadcast_started_at", "updated_at"])
    from .tasks import finalize_or_refund_charge_task
    delay = policy_snapshot["quote_wait_minutes"] * 60
    transaction.on_commit(lambda: finalize_or_refund_charge_task.apply_async(args=[str(charge.id)], countdown=delay))
    return charge


def record_stores_notified(prescription_id, count):
    if count <= 0:
        return
    EmergencyBroadcastCharge.objects.filter(
        prescription_id=prescription_id,
        status=EmergencyBroadcastCharge.Status.BROADCASTING,
    ).update(stores_notified_count=F("stores_notified_count") + count)


@transaction.atomic
def mark_valid_quote_received(response):
    if response.prescription.status != "emergency":
        return
    charge = EmergencyBroadcastCharge.objects.select_for_update().filter(
        prescription=response.prescription
    ).first()
    if not charge or charge.status in (
        EmergencyBroadcastCharge.Status.REFUND_PENDING,
        EmergencyBroadcastCharge.Status.REFUNDED,
    ):
        return
    charge.valid_quotes_count = F("valid_quotes_count") + 1
    if charge.status != EmergencyBroadcastCharge.Status.SERVICE_DELIVERED:
        charge.status = EmergencyBroadcastCharge.Status.SERVICE_DELIVERED
        charge.service_delivered_at = timezone.now()
    charge.save(update_fields=["valid_quotes_count", "status", "service_delivered_at", "updated_at"])

    from prescription.models import PrescriptionTargetStore
    target = PrescriptionTargetStore.objects.filter(
        prescription=response.prescription, store=response.store
    ).first()
    started = target.notified_at if target and target.notified_at else response.prescription.uploaded_at
    seconds = max(0, int((response.created_at - started).total_seconds()))
    points = 10 if seconds < 30 else 7 if seconds <= 60 else 4 if seconds <= 120 else 1
    ledger, created = EmergencyRewardLedger.objects.get_or_create(
        response=response,
        defaults={
            "store": response.store,
            "prescription": response.prescription,
            "points": points,
            "response_seconds": seconds,
        },
    )
    if created:
        profile, _ = EmergencyStoreRewardProfile.objects.select_for_update().get_or_create(store=response.store)
        profile.points += ledger.points
        profile.valid_quote_count += 1
        if seconds < 30:
            profile.fast_response_count += 1
        profile.tier = (
            EmergencyStoreRewardProfile.Tier.GOLD if profile.points >= 100
            else EmergencyStoreRewardProfile.Tier.SILVER if profile.points >= 50
            else EmergencyStoreRewardProfile.Tier.STANDARD
        )
        profile.save()


def restore_free_entitlement(charge):
    if charge.kind != EmergencyBroadcastCharge.Kind.FREE:
        return
    entitlement = UserEmergencyEntitlement.objects.select_for_update().filter(user=charge.user).first()
    if entitlement and entitlement.free_broadcasts_used:
        entitlement.free_broadcasts_used = F("free_broadcasts_used") - 1
        entitlement.save(update_fields=["free_broadcasts_used", "updated_at"])
