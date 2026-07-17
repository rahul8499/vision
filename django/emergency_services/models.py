import uuid

from django.db import models
from django.utils import timezone


class EmergencyFeePolicy(models.Model):
    amount_paise = models.PositiveIntegerField(default=500)
    free_broadcasts_per_user = models.PositiveSmallIntegerField(default=1)
    quote_wait_minutes = models.PositiveSmallIntegerField(default=15)
    checkout_expiry_minutes = models.PositiveSmallIntegerField(default=30)
    enabled = models.BooleanField(default=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Emergency broadcast ₹{self.amount_paise / 100:.2f}"


class UserEmergencyEntitlement(models.Model):
    user = models.OneToOneField(
        "prescription.User", on_delete=models.CASCADE, related_name="emergency_entitlement"
    )
    free_broadcasts_used = models.PositiveSmallIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)


class EmergencyBroadcastCharge(models.Model):
    class Kind(models.TextChoices):
        FREE = "free", "Free"
        PAID = "paid", "Paid"

    class Status(models.TextChoices):
        PAYMENT_PENDING = "payment_pending", "Payment pending"
        AUTHORIZED = "authorized", "Authorized"
        BROADCASTING = "broadcasting", "Broadcasting"
        SERVICE_DELIVERED = "service_delivered", "Service delivered"
        REFUND_PENDING = "refund_pending", "Refund pending"
        REFUND_FAILED = "refund_failed", "Refund failed"
        REFUNDED = "refunded", "Refunded"
        FAILED = "failed", "Failed"
        EXPIRED = "expired", "Expired"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        "prescription.User", on_delete=models.PROTECT, related_name="emergency_charges"
    )
    prescription = models.OneToOneField(
        "prescription.Prescription",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="emergency_charge",
    )
    kind = models.CharField(max_length=8, choices=Kind.choices)
    status = models.CharField(max_length=24, choices=Status.choices)
    amount_paise = models.PositiveIntegerField(default=0)
    currency = models.CharField(max_length=3, default="INR")
    idempotency_key = models.CharField(max_length=100, unique=True)
    razorpay_order_id = models.CharField(max_length=100, null=True, blank=True, unique=True)
    razorpay_payment_id = models.CharField(max_length=100, null=True, blank=True, unique=True)
    razorpay_refund_id = models.CharField(max_length=100, null=True, blank=True, unique=True)
    stores_notified_count = models.PositiveIntegerField(default=0)
    valid_quotes_count = models.PositiveIntegerField(default=0)
    failure_reason = models.CharField(max_length=255, blank=True)
    refund_reason = models.CharField(max_length=255, blank=True)
    refund_attempts = models.PositiveSmallIntegerField(default=0)
    last_refund_error = models.CharField(max_length=500, blank=True)
    provider_refund_status = models.CharField(max_length=30, blank=True)
    refund_requested_at = models.DateTimeField(null=True, blank=True)
    expires_at = models.DateTimeField()
    authorized_at = models.DateTimeField(null=True, blank=True)
    broadcast_started_at = models.DateTimeField(null=True, blank=True)
    service_delivered_at = models.DateTimeField(null=True, blank=True)
    refunded_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=["user", "-created_at"], name="emergency_s_user_id_f0ddf8_idx"),
            models.Index(fields=["status", "expires_at"], name="emergency_s_status_ddf0df_idx"),
        ]

    @property
    def is_usable(self):
        return (
            self.status == self.Status.AUTHORIZED
            and self.prescription_id is None
            and self.expires_at > timezone.now()
        )


class EmergencyWebhookEvent(models.Model):
    event_id = models.CharField(max_length=150, unique=True)
    event_type = models.CharField(max_length=100)
    payload = models.JSONField(default=dict)
    processed_at = models.DateTimeField(auto_now_add=True)


class EmergencyStoreRewardProfile(models.Model):
    class Tier(models.TextChoices):
        STANDARD = "standard", "Standard"
        SILVER = "silver", "Silver Emergency Pharmacy"
        GOLD = "gold", "Gold Emergency Pharmacy"

    store = models.OneToOneField(
        "prescription.Store", on_delete=models.CASCADE, related_name="emergency_reward_profile"
    )
    points = models.PositiveIntegerField(default=0)
    tier = models.CharField(max_length=10, choices=Tier.choices, default=Tier.STANDARD)
    fast_response_count = models.PositiveIntegerField(default=0)
    valid_quote_count = models.PositiveIntegerField(default=0)
    updated_at = models.DateTimeField(auto_now=True)


class EmergencyRewardLedger(models.Model):
    store = models.ForeignKey(
        "prescription.Store", on_delete=models.CASCADE, related_name="emergency_reward_entries"
    )
    prescription = models.ForeignKey("prescription.Prescription", on_delete=models.CASCADE)
    response = models.OneToOneField(
        "prescription.PrescriptionResponse",
        on_delete=models.CASCADE,
        related_name="emergency_reward_entry",
    )
    points = models.PositiveSmallIntegerField()
    response_seconds = models.PositiveIntegerField()
    reason = models.CharField(max_length=100, default="valid_emergency_quote")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
