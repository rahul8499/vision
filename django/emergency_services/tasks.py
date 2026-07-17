import logging

from celery.exceptions import MaxRetriesExceededError
from celery import shared_task
from django.db import transaction
from django.db.models import F
from django.utils import timezone

from .models import EmergencyBroadcastCharge
from .services import razorpay_client, restore_free_entitlement

logger = logging.getLogger(__name__)
EXACT_EMERGENCY_FEE_PAISE = 500
INVALID_QUOTE_STATUSES = {"rejected", "dismissed", "expired", "cancelled"}


def _valid_quote_count(charge):
    if not charge.prescription_id:
        return 0
    return charge.prescription.responses.exclude(user_status__in=INVALID_QUOTE_STATUSES).count()


def _mark_provider_refund(charge_id, refund):
    provider_status = str(refund.get("status") or "pending").lower()
    with transaction.atomic():
        charge = EmergencyBroadcastCharge.objects.select_for_update().get(id=charge_id)
        charge.razorpay_refund_id = refund.get("id") or charge.razorpay_refund_id
        charge.provider_refund_status = provider_status
        charge.last_refund_error = ""
        if provider_status == "processed":
            charge.status = EmergencyBroadcastCharge.Status.REFUNDED
            charge.refunded_at = timezone.now()
        elif provider_status == "failed":
            charge.status = EmergencyBroadcastCharge.Status.REFUND_FAILED
        else:
            charge.status = EmergencyBroadcastCharge.Status.REFUND_PENDING
        charge.save(update_fields=["razorpay_refund_id", "provider_refund_status", "last_refund_error", "status", "refunded_at", "updated_at"])
    return provider_status


@shared_task(bind=True, max_retries=96, queue="default")
def finalize_or_refund_charge_task(self, charge_id):
    with transaction.atomic():
        charge = EmergencyBroadcastCharge.objects.select_for_update(of=("self",)).select_related("user").get(id=charge_id)
        if charge.status in (EmergencyBroadcastCharge.Status.SERVICE_DELIVERED, EmergencyBroadcastCharge.Status.REFUNDED):
            return {"status": charge.status}
        valid_count = _valid_quote_count(charge)
        if valid_count:
            charge.valid_quotes_count = max(charge.valid_quotes_count, valid_count)
            charge.status = EmergencyBroadcastCharge.Status.SERVICE_DELIVERED
            charge.service_delivered_at = timezone.now()
            charge.save(update_fields=["valid_quotes_count", "status", "service_delivered_at", "updated_at"])
            return {"status": "service_delivered", "quotes": valid_count}

        charge.status = EmergencyBroadcastCharge.Status.REFUND_PENDING
        charge.refund_reason = "No pharmacy could be notified." if charge.stores_notified_count == 0 else "No valid pharmacy quote was received."
        charge.refund_requested_at = charge.refund_requested_at or timezone.now()
        charge.refund_attempts = F("refund_attempts") + 1
        charge.save(update_fields=["status", "refund_reason", "refund_requested_at", "refund_attempts", "updated_at"])

    if charge.kind == EmergencyBroadcastCharge.Kind.FREE:
        with transaction.atomic():
            charge = EmergencyBroadcastCharge.objects.select_for_update(of=("self",)).select_related("user").get(id=charge_id)
            restore_free_entitlement(charge)
            charge.status = EmergencyBroadcastCharge.Status.REFUNDED
            charge.provider_refund_status = "free_benefit_restored"
            charge.refunded_at = timezone.now()
            charge.last_refund_error = ""
            charge.save(update_fields=["status", "provider_refund_status", "refunded_at", "last_refund_error", "updated_at"])
        return {"status": "refunded", "amount_paise": 0, "free_benefit_restored": True}

    try:
        if charge.amount_paise != EXACT_EMERGENCY_FEE_PAISE:
            raise RuntimeError(f"Safety stop: expected exactly 500 paise, found {charge.amount_paise}.")
        if not charge.razorpay_payment_id or not charge.razorpay_order_id:
            raise RuntimeError("Safety stop: verified Razorpay payment/order reference is missing.")

        api = razorpay_client()
        if charge.razorpay_refund_id:
            refund = api.refund.fetch(charge.razorpay_refund_id)
            provider_status = _mark_provider_refund(charge_id, refund)
            if provider_status == "pending":
                raise self.retry(countdown=900)
            return {"status": provider_status, "refund_id": refund.get("id"), "amount_paise": refund.get("amount")}

        payment = api.payment.fetch(charge.razorpay_payment_id)
        if payment.get("order_id") != charge.razorpay_order_id:
            raise RuntimeError("Safety stop: Razorpay order does not match this emergency charge.")
        if int(payment.get("amount", 0)) != EXACT_EMERGENCY_FEE_PAISE:
            raise RuntimeError("Safety stop: captured Razorpay amount is not exactly ₹5.")
        if payment.get("status") != "captured" or not payment.get("captured"):
            raise RuntimeError("Refund deferred: Razorpay payment is not captured.")

        already_refunded = int(payment.get("amount_refunded", 0) or 0)
        if already_refunded > EXACT_EMERGENCY_FEE_PAISE:
            raise RuntimeError("Safety stop: provider reports an over-refunded payment.")
        remaining = EXACT_EMERGENCY_FEE_PAISE - already_refunded
        if remaining == 0:
            refunds = api.payment.fetch_multiple_refund(charge.razorpay_payment_id).get("items", [])
            if not refunds:
                raise RuntimeError("Provider reports ₹5 refunded but no refund record was returned.")
            refund = refunds[0]
        else:
            refund = api.payment.refund(charge.razorpay_payment_id, {
                "amount": remaining,
                "speed": "normal",
                "receipt": f"emg_{str(charge.id)[:24]}",
                "notes": {"charge_id": str(charge.id), "reason": "zero_valid_emergency_quotes"},
            })
        provider_status = _mark_provider_refund(charge_id, refund)
        if provider_status == "pending":
            raise self.retry(countdown=900)
        return {"status": provider_status, "refund_id": refund.get("id"), "amount_paise": refund.get("amount")}
    except MaxRetriesExceededError:
        EmergencyBroadcastCharge.objects.filter(id=charge_id).update(status=EmergencyBroadcastCharge.Status.REFUND_FAILED, last_refund_error="Automatic refund retry limit reached.")
        raise
    except Exception as exc:
        if exc.__class__.__name__ == "Retry":
            raise
        message = str(exc)[:500]
        EmergencyBroadcastCharge.objects.filter(id=charge_id).update(last_refund_error=message, status=EmergencyBroadcastCharge.Status.REFUND_PENDING)
        logger.exception("Emergency refund attempt failed charge=%s", charge_id)
        countdown = min(3600, 60 * (2 ** min(self.request.retries, 6)))
        raise self.retry(exc=exc, countdown=countdown)


@shared_task
def expire_unused_emergency_charge_task(charge_id):
    with transaction.atomic():
        charge = EmergencyBroadcastCharge.objects.select_for_update().get(id=charge_id)
        if charge.prescription_id or charge.status not in (EmergencyBroadcastCharge.Status.AUTHORIZED, EmergencyBroadcastCharge.Status.PAYMENT_PENDING):
            return {"status": charge.status}
        if charge.status == EmergencyBroadcastCharge.Status.AUTHORIZED:
            charge.status = EmergencyBroadcastCharge.Status.REFUND_PENDING
            charge.refund_reason = "Emergency broadcast was not started."
            charge.save(update_fields=["status", "refund_reason", "updated_at"])
    if charge.status == EmergencyBroadcastCharge.Status.REFUND_PENDING:
        return finalize_or_refund_charge_task.delay(str(charge.id)).id
    charge.status = EmergencyBroadcastCharge.Status.EXPIRED
    charge.save(update_fields=["status", "updated_at"])
    return {"status": "expired"}
