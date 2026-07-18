import uuid
import math

from django.contrib.gis.db import models
from django.contrib.gis.geos import MultiPolygon, Polygon
from django.utils import timezone


class City(models.Model):
    BOUNDARY_MODE_CHOICES = (("radius", "Automatic radius"), ("manual", "Advanced manual polygon"))
    name = models.CharField(max_length=120)
    state = models.CharField(max_length=120)
    timezone = models.CharField(max_length=50, default="Asia/Kolkata")
    boundary = models.MultiPolygonField(srid=4326, geography=True, null=True, blank=True)
    boundary_mode = models.CharField(max_length=10, choices=BOUNDARY_MODE_CHOICES, default="radius")
    center_latitude = models.FloatField(null=True, blank=True)
    center_longitude = models.FloatField(null=True, blank=True)
    service_radius_km = models.PositiveSmallIntegerField(default=40)
    is_active = models.BooleanField(default=True, db_index=True)
    is_default = models.BooleanField(default=False, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("name", "state")
        ordering = ("state", "name")
        constraints = [
            models.UniqueConstraint(
                fields=("is_default",),
                condition=models.Q(is_default=True),
                name="single_default_service_city",
            ),
        ]

    def __str__(self):
        return f"{self.name}, {self.state}"

    def save(self, *args, **kwargs):
        if self.boundary_mode == "radius" and self.center_latitude is not None and self.center_longitude is not None:
            self.boundary = _radius_boundary(self.center_latitude, self.center_longitude, self.service_radius_km)
        super().save(*args, **kwargs)


class ServiceZone(models.Model):
    city = models.ForeignKey(City, on_delete=models.CASCADE, related_name="service_zones")
    name = models.CharField(max_length=120)
    boundary = models.MultiPolygonField(srid=4326, geography=True, null=True, blank=True)
    boundary_mode = models.CharField(max_length=10, choices=City.BOUNDARY_MODE_CHOICES, default="radius")
    center_latitude = models.FloatField(null=True, blank=True)
    center_longitude = models.FloatField(null=True, blank=True)
    service_radius_km = models.PositiveSmallIntegerField(default=5)
    is_active = models.BooleanField(default=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("city", "name")
        ordering = ("city__name", "name")

    def __str__(self):
        return f"{self.city.name} / {self.name}"

    def save(self, *args, **kwargs):
        if self.boundary_mode == "radius" and self.center_latitude is not None and self.center_longitude is not None:
            self.boundary = _radius_boundary(self.center_latitude, self.center_longitude, self.service_radius_km)
        super().save(*args, **kwargs)


def _radius_boundary(latitude, longitude, radius_km, points=72):
    """Build a WGS84 geodesic circle approximation suitable for PostGIS."""
    earth_radius_km = 6371.0088
    angular_distance = float(radius_km) / earth_radius_km
    latitude_radians = math.radians(float(latitude))
    longitude_radians = math.radians(float(longitude))
    coordinates = []
    for index in range(points):
        bearing = math.radians((360 / points) * index)
        destination_latitude = math.asin(
            math.sin(latitude_radians) * math.cos(angular_distance)
            + math.cos(latitude_radians) * math.sin(angular_distance) * math.cos(bearing)
        )
        destination_longitude = longitude_radians + math.atan2(
            math.sin(bearing) * math.sin(angular_distance) * math.cos(latitude_radians),
            math.cos(angular_distance) - math.sin(latitude_radians) * math.sin(destination_latitude),
        )
        coordinates.append((math.degrees(destination_longitude), math.degrees(destination_latitude)))
    coordinates.append(coordinates[0])
    return MultiPolygon(Polygon(coordinates), srid=4326)


class EmergencyFeePolicy(models.Model):
    amount_paise = models.PositiveIntegerField(default=500)
    free_broadcasts_per_user = models.PositiveSmallIntegerField(default=1)
    quote_wait_minutes = models.PositiveSmallIntegerField(default=15)
    checkout_expiry_minutes = models.PositiveSmallIntegerField(default=30)
    first_store_reminder_seconds = models.PositiveIntegerField(default=60)
    second_store_reminder_seconds = models.PositiveIntegerField(default=120)
    support_escalation_seconds = models.PositiveIntegerField(default=180)
    normal_first_store_reminder_seconds = models.PositiveIntegerField(default=180)
    normal_second_store_reminder_seconds = models.PositiveIntegerField(default=300)
    normal_support_escalation_seconds = models.PositiveIntegerField(default=420)
    manual_reminder_cooldown_seconds = models.PositiveIntegerField(default=120)
    manual_reminder_daily_limit = models.PositiveSmallIntegerField(default=10)
    max_store_reminders = models.PositiveSmallIntegerField(default=2)
    reminders_enabled = models.BooleanField(default=True)
    support_escalation_enabled = models.BooleanField(default=True)
    enabled = models.BooleanField(default=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Emergency broadcast ₹{self.amount_paise / 100:.2f}"


class CityEmergencyPolicy(models.Model):
    city = models.ForeignKey(City, on_delete=models.CASCADE, related_name="emergency_policies")
    service_zone = models.OneToOneField(
        ServiceZone, on_delete=models.CASCADE, null=True, blank=True,
        related_name="emergency_policy",
    )
    first_store_reminder_seconds = models.PositiveIntegerField(null=True, blank=True)
    second_store_reminder_seconds = models.PositiveIntegerField(null=True, blank=True)
    support_escalation_seconds = models.PositiveIntegerField(null=True, blank=True)
    normal_first_store_reminder_seconds = models.PositiveIntegerField(null=True, blank=True)
    normal_second_store_reminder_seconds = models.PositiveIntegerField(null=True, blank=True)
    normal_support_escalation_seconds = models.PositiveIntegerField(null=True, blank=True)
    manual_reminder_cooldown_seconds = models.PositiveIntegerField(null=True, blank=True)
    manual_reminder_daily_limit = models.PositiveSmallIntegerField(null=True, blank=True)
    max_store_reminders = models.PositiveSmallIntegerField(null=True, blank=True)
    reminders_enabled = models.BooleanField(null=True, blank=True)
    support_escalation_enabled = models.BooleanField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=("city",),
                condition=models.Q(service_zone__isnull=True),
                name="unique_city_emergency_policy",
            ),
        ]

    def __str__(self):
        return f"Emergency policy: {self.service_zone or self.city}"


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
    city = models.ForeignKey(City, on_delete=models.SET_NULL, null=True, blank=True, related_name="emergency_charges")
    service_zone = models.ForeignKey(ServiceZone, on_delete=models.SET_NULL, null=True, blank=True, related_name="emergency_charges")
    policy_snapshot = models.JSONField(default=dict, blank=True)
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
