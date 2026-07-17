import hashlib
import hmac
import json

from django.conf import settings
from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from prescription.authentication import StoreTokenAuthentication, UserTokenAuthentication

from .models import (
    EmergencyBroadcastCharge,
    EmergencyStoreRewardProfile,
    EmergencyWebhookEvent,
    UserEmergencyEntitlement,
)
from .services import create_charge, get_policy, serialize_charge, verify_payment


class EmergencyEligibilityView(APIView):
    authentication_classes = [UserTokenAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        policy = get_policy()
        entitlement, _ = UserEmergencyEntitlement.objects.get_or_create(user=request.user)
        free_remaining = max(0, policy.free_broadcasts_per_user - entitlement.free_broadcasts_used)
        return Response({
            "first_emergency_free": True,
            "free_broadcasts_remaining": free_remaining,
            "next_broadcast_amount_paise": policy.amount_paise,
            "next_broadcast_amount_rupees": policy.amount_paise / 100,
            "currency": "INR",
            "quote_wait_minutes": policy.quote_wait_minutes,
            "refund_policy": "Automatic refund if no valid pharmacy quote is received.",
            "store_emergency_fee": 0,
            "razorpay_key_id": settings.RAZORPAY_KEY_ID,
        })


class EmergencyChargeCreateView(APIView):
    authentication_classes = [UserTokenAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request):
        key = str(request.data.get("idempotency_key", "")).strip()
        if not key or len(key) > 100:
            return Response({"error": "A valid idempotency_key is required."}, status=400)
        charge = create_charge(request.user, key)
        from .tasks import expire_unused_emergency_charge_task
        delay = max(1, int((charge.expires_at - timezone.now()).total_seconds()))
        expire_unused_emergency_charge_task.apply_async(args=[str(charge.id)], countdown=delay)
        return Response({
            "charge": serialize_charge(charge),
            "razorpay_key_id": settings.RAZORPAY_KEY_ID,
        }, status=201)


class EmergencyChargeVerifyView(APIView):
    authentication_classes = [UserTokenAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request, charge_id):
        payment_id = request.data.get("razorpay_payment_id")
        signature = request.data.get("razorpay_signature")
        if not payment_id or not signature:
            return Response({"error": "Payment id and signature are required."}, status=400)
        charge = verify_payment(request.user, charge_id, payment_id, signature)
        return Response({"charge": serialize_charge(charge)})


class EmergencyChargeHistoryView(APIView):
    authentication_classes = [UserTokenAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        charges = EmergencyBroadcastCharge.objects.filter(user=request.user).select_related("prescription").prefetch_related("prescription__target_stores", "prescription__responses").order_by("-created_at")[:100]
        return Response({"charges": [serialize_charge(charge) for charge in charges]})


class StoreEmergencyRewardView(APIView):
    authentication_classes = [StoreTokenAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        profile, _ = EmergencyStoreRewardProfile.objects.get_or_create(store=request.user)
        recent = profile.store.emergency_reward_entries.all()[:20]
        return Response({
            "points": profile.points,
            "tier": profile.tier,
            "tier_label": profile.get_tier_display(),
            "fast_responder": profile.fast_response_count > 0,
            "fast_response_count": profile.fast_response_count,
            "valid_quote_count": profile.valid_quote_count,
            "next_gold_at": 100,
            "points_to_gold": max(0, 100 - profile.points),
            "recent_rewards": [{
                "id": item.id,
                "prescription_id": item.prescription_id,
                "points": item.points,
                "response_seconds": item.response_seconds,
                "created_at": item.created_at,
            } for item in recent],
        })


class EmergencyRazorpayWebhookView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request):
        secret = getattr(settings, "EMERGENCY_RAZORPAY_WEBHOOK_SECRET", "")
        if not secret:
            return Response({"error": "Webhook is not configured."}, status=503)
        raw = request.body
        signature = request.headers.get("X-Razorpay-Signature", "")
        expected = hmac.new(secret.encode(), raw, hashlib.sha256).hexdigest()
        if not hmac.compare_digest(expected, signature):
            return Response({"error": "Invalid signature."}, status=400)
        payload = json.loads(raw.decode("utf-8"))
        event_id = request.headers.get("X-Razorpay-Event-Id") or hashlib.sha256(raw).hexdigest()
        with transaction.atomic():
            _, created = EmergencyWebhookEvent.objects.get_or_create(
                event_id=event_id,
                defaults={"event_type": payload.get("event", ""), "payload": payload},
            )
            if not created:
                return Response({"status": "duplicate"})
            event_type = payload.get("event", "")
            if event_type in {"refund.created", "refund.processed", "refund.failed"}:
                entity = payload.get("payload", {}).get("refund", {}).get("entity", {})
                refund_id = entity.get("id")
                payment_id = entity.get("payment_id")
                notes = entity.get("notes") or {}
                charge_id = notes.get("charge_id") if isinstance(notes, dict) else None
                lookup = Q(razorpay_refund_id=refund_id)
                if payment_id:
                    lookup |= Q(razorpay_payment_id=payment_id)
                if charge_id:
                    lookup |= Q(id=charge_id)
                charge = EmergencyBroadcastCharge.objects.select_for_update().filter(lookup).first()
                if charge:
                    provider_amount = int(entity.get("amount", 0) or 0)
                    if charge.kind != EmergencyBroadcastCharge.Kind.PAID or charge.amount_paise != 500 or provider_amount != 500:
                        charge.status = EmergencyBroadcastCharge.Status.REFUND_FAILED
                        charge.last_refund_error = "Webhook safety stop: refund amount is not exactly ₹5."
                    else:
                        charge.razorpay_refund_id = refund_id or charge.razorpay_refund_id
                        charge.provider_refund_status = str(entity.get("status") or event_type.split(".")[-1])
                        if event_type == "refund.processed":
                            charge.status = EmergencyBroadcastCharge.Status.REFUNDED
                            charge.refunded_at = timezone.now()
                            charge.last_refund_error = ""
                        elif event_type == "refund.failed":
                            charge.status = EmergencyBroadcastCharge.Status.REFUND_FAILED
                            charge.last_refund_error = str(entity.get("error_description") or "Razorpay refund failed.")[:500]
                        else:
                            charge.status = EmergencyBroadcastCharge.Status.REFUND_PENDING
                    charge.save(update_fields=["razorpay_refund_id", "provider_refund_status", "status", "refunded_at", "last_refund_error", "updated_at"])
        return Response({"status": "ok"})
