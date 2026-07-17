# Generated manually for the isolated user emergency-broadcast service.
import django.db.models.deletion
import uuid
from django.db import migrations, models


def create_default_policy(apps, schema_editor):
    Policy = apps.get_model("emergency_services", "EmergencyFeePolicy")
    Policy.objects.get_or_create(
        pk=1,
        defaults={
            "amount_paise": 500,
            "free_broadcasts_per_user": 1,
            "quote_wait_minutes": 10,
            "checkout_expiry_minutes": 30,
            "enabled": True,
        },
    )


class Migration(migrations.Migration):
    initial = True
    dependencies = [("prescription", "0103_emergency_request_lifecycle")]
    operations = [
        migrations.CreateModel(
            name="EmergencyFeePolicy",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("amount_paise", models.PositiveIntegerField(default=500)),
                ("free_broadcasts_per_user", models.PositiveSmallIntegerField(default=1)),
                ("quote_wait_minutes", models.PositiveSmallIntegerField(default=10)),
                ("checkout_expiry_minutes", models.PositiveSmallIntegerField(default=30)),
                ("enabled", models.BooleanField(default=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
        ),
        migrations.CreateModel(
            name="EmergencyBroadcastCharge",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("kind", models.CharField(choices=[("free", "Free"), ("paid", "Paid")], max_length=8)),
                ("status", models.CharField(choices=[("payment_pending", "Payment pending"), ("authorized", "Authorized"), ("broadcasting", "Broadcasting"), ("service_delivered", "Service delivered"), ("refund_pending", "Refund pending"), ("refunded", "Refunded"), ("failed", "Failed"), ("expired", "Expired")], max_length=24)),
                ("amount_paise", models.PositiveIntegerField(default=0)),
                ("currency", models.CharField(default="INR", max_length=3)),
                ("idempotency_key", models.CharField(max_length=100, unique=True)),
                ("razorpay_order_id", models.CharField(blank=True, max_length=100, null=True, unique=True)),
                ("razorpay_payment_id", models.CharField(blank=True, max_length=100, null=True, unique=True)),
                ("razorpay_refund_id", models.CharField(blank=True, max_length=100, null=True, unique=True)),
                ("stores_notified_count", models.PositiveIntegerField(default=0)),
                ("valid_quotes_count", models.PositiveIntegerField(default=0)),
                ("failure_reason", models.CharField(blank=True, max_length=255)),
                ("refund_reason", models.CharField(blank=True, max_length=255)),
                ("expires_at", models.DateTimeField()),
                ("authorized_at", models.DateTimeField(blank=True, null=True)),
                ("broadcast_started_at", models.DateTimeField(blank=True, null=True)),
                ("service_delivered_at", models.DateTimeField(blank=True, null=True)),
                ("refunded_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("prescription", models.OneToOneField(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="emergency_charge", to="prescription.prescription")),
                ("user", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="emergency_charges", to="prescription.user")),
            ],
            options={"indexes": [models.Index(fields=["user", "-created_at"], name="emergency_s_user_id_f0ddf8_idx"), models.Index(fields=["status", "expires_at"], name="emergency_s_status_ddf0df_idx")]},
        ),
        migrations.CreateModel(
            name="EmergencyStoreRewardProfile",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("points", models.PositiveIntegerField(default=0)),
                ("tier", models.CharField(choices=[("standard", "Standard"), ("silver", "Silver Emergency Pharmacy"), ("gold", "Gold Emergency Pharmacy")], default="standard", max_length=10)),
                ("fast_response_count", models.PositiveIntegerField(default=0)),
                ("valid_quote_count", models.PositiveIntegerField(default=0)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("store", models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name="emergency_reward_profile", to="prescription.store")),
            ],
        ),
        migrations.CreateModel(
            name="EmergencyWebhookEvent",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("event_id", models.CharField(max_length=150, unique=True)),
                ("event_type", models.CharField(max_length=100)),
                ("payload", models.JSONField(default=dict)),
                ("processed_at", models.DateTimeField(auto_now_add=True)),
            ],
        ),
        migrations.CreateModel(
            name="UserEmergencyEntitlement",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("free_broadcasts_used", models.PositiveSmallIntegerField(default=0)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("user", models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name="emergency_entitlement", to="prescription.user")),
            ],
        ),
        migrations.CreateModel(
            name="EmergencyRewardLedger",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("points", models.PositiveSmallIntegerField()),
                ("response_seconds", models.PositiveIntegerField()),
                ("reason", models.CharField(default="valid_emergency_quote", max_length=100)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("prescription", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to="prescription.prescription")),
                ("response", models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name="emergency_reward_entry", to="prescription.prescriptionresponse")),
                ("store", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="emergency_reward_entries", to="prescription.store")),
            ],
            options={"ordering": ["-created_at"]},
        ),
        migrations.RunPython(create_default_policy, migrations.RunPython.noop),
    ]
