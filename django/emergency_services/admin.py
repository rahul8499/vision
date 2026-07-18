from django.contrib import admin
from django.contrib.gis.admin import GISModelAdmin

from .models import (
    City,
    CityEmergencyPolicy,
    EmergencyBroadcastCharge,
    EmergencyFeePolicy,
    EmergencyRewardLedger,
    EmergencyStoreRewardProfile,
    EmergencyWebhookEvent,
    UserEmergencyEntitlement,
    ServiceZone,
)
from .forms import CityAdminForm, ServiceZoneAdminForm


@admin.register(City)
class CityAdmin(GISModelAdmin):
    form = CityAdminForm
    gis_widget_kwargs = {
        "attrs": {
            "default_lon": 73.8567,
            "default_lat": 18.5204,
            "default_zoom": 10,
        },
    }
    list_display = ("name", "state", "timezone", "is_default", "is_active", "updated_at")
    list_filter = ("state", "is_default", "is_active")
    search_fields = ("name", "state")
    fieldsets = (
        ("City", {"fields": ("name", "state", "timezone", "is_active", "is_default")}),
        ("Simple automatic service area", {
            "fields": ("boundary_mode", "center_latitude", "center_longitude", "service_radius_km"),
            "description": "Choose Automatic radius, enter the city center coordinates and radius, then Save. The boundary is generated for you.",
        }),
        ("Advanced manual boundary", {
            "fields": ("boundary",),
            "classes": ("collapse",),
            "description": "Optional. Change Boundary mode to Advanced manual polygon before drawing a custom shape.",
        }),
    )

    def save_model(self, request, obj, form, change):
        super().save_model(request, obj, form, change)
        from .services import backfill_geo_assignments
        backfill_geo_assignments(city=obj)


@admin.register(ServiceZone)
class ServiceZoneAdmin(GISModelAdmin):
    form = ServiceZoneAdminForm
    gis_widget_kwargs = {
        "attrs": {
            "default_lon": 73.8567,
            "default_lat": 18.5204,
            "default_zoom": 12,
        },
    }
    list_display = ("name", "city", "is_active", "updated_at")
    list_filter = ("city", "is_active")
    search_fields = ("name", "city__name")
    fieldsets = (
        ("Zone", {"fields": ("city", "name", "is_active")}),
        ("Simple automatic service area", {
            "fields": ("boundary_mode", "center_latitude", "center_longitude", "service_radius_km"),
            "description": "Enter the zone center and radius. Saving generates the boundary automatically.",
        }),
        ("Advanced manual boundary", {
            "fields": ("boundary",),
            "classes": ("collapse",),
        }),
    )

    def save_model(self, request, obj, form, change):
        super().save_model(request, obj, form, change)
        from .services import backfill_geo_assignments
        backfill_geo_assignments(service_zone=obj)


@admin.register(CityEmergencyPolicy)
class CityEmergencyPolicyAdmin(admin.ModelAdmin):
    list_display = ("city", "service_zone", "first_store_reminder_seconds", "support_escalation_seconds", "is_active", "updated_at")
    list_filter = ("city", "is_active")


@admin.register(EmergencyFeePolicy)
class EmergencyFeePolicyAdmin(admin.ModelAdmin):
    list_display = ("id", "amount_paise", "quote_wait_minutes", "first_store_reminder_seconds", "support_escalation_seconds", "enabled", "updated_at")
    list_filter = ("enabled",)
    readonly_fields = ("updated_at",)


@admin.register(UserEmergencyEntitlement)
class UserEmergencyEntitlementAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "free_broadcasts_used", "created_at", "updated_at")
    search_fields = ("user__id", "user__mobile", "user__email")
    readonly_fields = ("created_at", "updated_at")
    list_select_related = ("user",)


@admin.register(EmergencyBroadcastCharge)
class EmergencyBroadcastChargeAdmin(admin.ModelAdmin):
    list_display = (
        "id", "user", "user_mobile", "prescription", "kind", "status",
        "amount_rupees", "razorpay_order_id", "razorpay_payment_id",
        "razorpay_refund_id", "stores_notified_count", "valid_quotes_count",
        "refund_attempts", "provider_refund_status", "authorized_at", "created_at", "refunded_at",
    )
    list_filter = ("kind", "status", "currency", "created_at", "refunded_at")
    search_fields = ("id", "user__id", "user__mobile", "user__email", "prescription__id", "idempotency_key", "razorpay_order_id", "razorpay_payment_id", "razorpay_refund_id")
    readonly_fields = ("id", "idempotency_key", "razorpay_order_id", "razorpay_payment_id", "razorpay_refund_id", "authorized_at", "broadcast_started_at", "service_delivered_at", "refund_requested_at", "refunded_at", "created_at", "updated_at")
    list_select_related = ("user", "prescription")
    date_hierarchy = "created_at"
    ordering = ("-created_at",)
    list_per_page = 50
    fieldsets = (
        ("User and emergency request", {"fields": ("id", "user", "prescription", "kind", "status")}),
        ("Payment history", {"fields": ("amount_paise", "currency", "razorpay_order_id", "razorpay_payment_id", "razorpay_refund_id", "idempotency_key")}),
        ("Broadcast result", {"fields": ("stores_notified_count", "valid_quotes_count", "failure_reason", "refund_reason", "refund_attempts", "provider_refund_status", "last_refund_error")}),
        ("Lifecycle timestamps", {"fields": ("expires_at", "authorized_at", "broadcast_started_at", "service_delivered_at", "refund_requested_at", "refunded_at", "created_at", "updated_at")}),
    )

    @admin.display(description="Mobile", ordering="user__mobile")
    def user_mobile(self, obj):
        return obj.user.mobile or "-"

    @admin.display(description="Amount (₹)", ordering="amount_paise")
    def amount_rupees(self, obj):
        return f"₹{obj.amount_paise / 100:.2f}"


@admin.register(EmergencyWebhookEvent)
class EmergencyWebhookEventAdmin(admin.ModelAdmin):
    list_display = ("event_id", "event_type", "processed_at")
    list_filter = ("event_type", "processed_at")
    search_fields = ("event_id", "event_type")
    readonly_fields = ("event_id", "event_type", "payload", "processed_at")
    date_hierarchy = "processed_at"
    ordering = ("-processed_at",)

    def has_add_permission(self, request):
        return False


@admin.register(EmergencyStoreRewardProfile)
class EmergencyStoreRewardProfileAdmin(admin.ModelAdmin):
    list_display = ("id", "store", "points", "tier", "fast_response_count", "valid_quote_count", "updated_at")
    list_filter = ("tier", "updated_at")
    search_fields = ("store__id", "store__name", "store__mobile", "store__email")
    readonly_fields = ("updated_at",)
    list_select_related = ("store",)
    ordering = ("-points",)


@admin.register(EmergencyRewardLedger)
class EmergencyRewardLedgerAdmin(admin.ModelAdmin):
    list_display = ("id", "store", "prescription", "response", "points", "response_seconds", "reason", "created_at")
    list_filter = ("points", "reason", "created_at")
    search_fields = ("store__id", "store__name", "prescription__id", "response__id", "reason")
    readonly_fields = ("store", "prescription", "response", "points", "response_seconds", "reason", "created_at")
    list_select_related = ("store", "prescription", "response")
    date_hierarchy = "created_at"
    ordering = ("-created_at",)

    def has_add_permission(self, request):
        return False
