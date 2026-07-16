from django.contrib import admin, messages
from .models import (
    Store, User, ChatMessage, ChatThread,
    Prescription, PrescriptionResponse,
    PrescriptionResponseMedicine, PrescriptionTargetStore,
    WSEventLog, Rating, PrescriptionResponseStatusHistory, AppNotification,
    ReportNote, StoreReportNote, SafetyReport, PharmacistConsultation, PharmacistConsultationMessage
)
from rest_framework.authtoken.models import Token
from core.services.capability_service import (
    activate_store,
    activate_user,
    deactivate_store,
    deactivate_user,
    delete_user_account,
    get_store_lifecycle_status,
    get_user_lifecycle_status,
    unverify_store,
    verify_store,
    verify_user,
)

# --- Basic Registrations ---
from django.contrib.gis.admin import GISModelAdmin

admin.site.register(Rating)
admin.site.register(Token)


@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display = ('id', 'name', 'mobile', 'email', 'is_active', 'is_verified', 'is_deleted', 'lifecycle_status')
    list_filter = ('is_active', 'is_verified', 'is_deleted')
    search_fields = ('name', 'mobile', 'email')
    actions = ('activate_selected', 'deactivate_selected', 'verify_selected', 'soft_delete_selected')

    def lifecycle_status(self, obj):
        return get_user_lifecycle_status(obj)
    lifecycle_status.short_description = 'Status'

    def get_actions(self, request):
        actions = super().get_actions(request)
        actions.pop('delete_selected', None)
        return actions

    def _apply_lifecycle_action(self, request, queryset, mutator, reason):
        changed = 0
        for user in queryset.iterator():
            if mutator(user, reason=reason, changed_by=request.user):
                changed += 1
        self.message_user(request, f'{changed} user(s) updated.', messages.SUCCESS)

    @admin.action(description='Activate selected users')
    def activate_selected(self, request, queryset):
        self._apply_lifecycle_action(request, queryset, activate_user, 'admin_user_activate')

    @admin.action(description='Deactivate selected users')
    def deactivate_selected(self, request, queryset):
        self._apply_lifecycle_action(request, queryset, deactivate_user, 'admin_user_deactivate')

    @admin.action(description='Verify selected users')
    def verify_selected(self, request, queryset):
        self._apply_lifecycle_action(request, queryset, verify_user, 'admin_user_verify')

    @admin.action(description='Delete selected users safely')
    def soft_delete_selected(self, request, queryset):
        self._apply_lifecycle_action(request, queryset, delete_user_account, 'admin_user_delete')

    def delete_model(self, request, obj):
        delete_user_account(obj, reason='admin_delete_replaced_by_soft_delete', changed_by=request.user)
        self.message_user(
            request,
            'User was deactivated instead of hard deleted.',
            messages.WARNING,
        )

    def delete_queryset(self, request, queryset):
        self._apply_lifecycle_action(
            request,
            queryset,
            delete_user_account,
            'admin_bulk_delete_replaced_by_soft_delete',
        )

@admin.register(Store)
class StoreAdmin(GISModelAdmin):
    list_display = ('id', 'name', 'mobile', 'is_active', 'is_verified', 'is_pharmacist_verified', 'pharmacist_available', 'is_deleted', 'lifecycle_status', 'created_at')
    list_filter = ('is_active', 'is_verified', 'is_pharmacist_verified', 'pharmacist_available', 'is_deleted')
    search_fields = ('name', 'owner_name', 'mobile', 'email', 'drug_license_number', 'gst_number')
    readonly_fields = ('created_at', 'last_seen')
    actions = ('activate_selected', 'deactivate_selected', 'verify_selected', 'unverify_selected')

    def lifecycle_status(self, obj):
        return get_store_lifecycle_status(obj)
    lifecycle_status.short_description = 'Status'

    def get_actions(self, request):
        actions = super().get_actions(request)
        actions.pop('delete_selected', None)
        return actions

    def _apply_lifecycle_action(self, request, queryset, mutator, reason):
        changed = 0
        for store in queryset.iterator():
            if mutator(store, reason=reason, changed_by=request.user):
                changed += 1
        self.message_user(request, f'{changed} store(s) updated.', messages.SUCCESS)

    @admin.action(description='Activate selected stores')
    def activate_selected(self, request, queryset):
        self._apply_lifecycle_action(request, queryset, activate_store, 'admin_activate')

    @admin.action(description='Deactivate selected stores')
    def deactivate_selected(self, request, queryset):
        self._apply_lifecycle_action(request, queryset, deactivate_store, 'admin_deactivate')

    @admin.action(description='Verify selected stores')
    def verify_selected(self, request, queryset):
        self._apply_lifecycle_action(request, queryset, verify_store, 'admin_verify')

    @admin.action(description='Unverify selected stores')
    def unverify_selected(self, request, queryset):
        self._apply_lifecycle_action(request, queryset, unverify_store, 'admin_unverify')

    def delete_model(self, request, obj):
        deactivate_store(obj, reason='admin_delete_replaced_by_deactivate', changed_by=request.user)
        self.message_user(
            request,
            'Store was deactivated instead of hard deleted.',
            messages.WARNING,
        )

    def delete_queryset(self, request, queryset):
        self._apply_lifecycle_action(
            request,
            queryset,
            deactivate_store,
            'admin_bulk_delete_replaced_by_deactivate',
        )


@admin.register(Prescription)
class PrescriptionAdmin(GISModelAdmin):
    pass
admin.site.register(PrescriptionResponseMedicine)
admin.site.register(PrescriptionTargetStore)
admin.site.register(ChatThread)
admin.site.register(ChatMessage)
admin.site.register(AppNotification)

# --- Advanced Registrations ---

class StatusHistoryInline(admin.TabularInline):
    model = PrescriptionResponseStatusHistory
    extra = 0
    readonly_fields = ('from_status', 'to_status', 'reason', 'changed_by_name', 'created_at')
    can_delete = False
    verbose_name = "FSM Audit History"
    verbose_name_plural = "FSM Audit Histories"

@admin.register(PrescriptionResponse)
class PrescriptionResponseAdmin(admin.ModelAdmin):
    list_display = ('id', 'user', 'store_name', 'user_status', 'is_locked', 'created_at')
    list_filter = ('user_status', 'is_locked', 'is_unresponsive')
    search_fields = ('id', 'store_name', 'user__name', 'user__mobile')
    readonly_fields = ('created_at', 'updated_at', 'accepted_at', 'processing_at', 'locked_at')
    inlines = [StatusHistoryInline]
    ordering = ('-created_at',)

@admin.register(PrescriptionResponseStatusHistory)
class PrescriptionResponseStatusHistoryAdmin(admin.ModelAdmin):
    list_display = ('response_id', 'from_status', 'to_status', 'changed_by_name', 'created_at')
    list_filter = ('from_status', 'to_status')
    readonly_fields = ('response', 'from_status', 'to_status', 'reason', 'changed_by_name', 'created_at')
    ordering = ('-created_at',)

@admin.register(WSEventLog)
class WSEventLogAdmin(admin.ModelAdmin):
    list_display   = ('event_id_short', 'event_type', 'user_id', 'response_id', 'created_at')
    list_filter    = ('event_type',)
    search_fields  = ('event_id', 'user_id', 'response_id')
    readonly_fields = ('event_id', 'event_type', 'user_id', 'response_id', 'payload', 'created_at')
    ordering       = ('-created_at',)

    def event_id_short(self, obj):
        return obj.event_id[:8] + '…'
    event_id_short.short_description = 'Event ID'


class LegacyUserReportAdmin(admin.ModelAdmin):
    list_display = ('id', 'response_id', 'user', 'reported_store', 'note_preview', 'created_at')
    list_filter = ('created_at',)
    search_fields = ('id', 'response__id', 'user__name', 'user__mobile', 'response__store__name', 'note')
    readonly_fields = ('response', 'user', 'note', 'created_at')
    ordering = ('-created_at',)
    list_select_related = ('response', 'response__store', 'user')

    @admin.display(description='Store')
    def reported_store(self, obj):
        return obj.response.store.name if obj.response and obj.response.store else '—'

    @admin.display(description='Report')
    def note_preview(self, obj):
        return obj.note[:80] + ('…' if len(obj.note) > 80 else '')

    def has_add_permission(self, request):
        return False


class LegacyStoreReportAdmin(admin.ModelAdmin):
    list_display = ('id', 'context_type', 'context_id', 'store', 'reported_user', 'note_preview', 'created_at')
    list_filter = ('created_at',)
    search_fields = ('id', 'response__id', 'prescription__id', 'store__name', 'store__mobile', 'response__user__name', 'prescription__user__name', 'note')
    readonly_fields = ('response', 'prescription', 'store', 'note', 'created_at')
    ordering = ('-created_at',)
    list_select_related = ('response', 'response__user', 'prescription', 'prescription__user', 'store')

    @admin.display(description='Context')
    def context_type(self, obj):
        return 'Order' if obj.response_id else 'Enquiry'

    @admin.display(description='Context ID')
    def context_id(self, obj):
        return obj.response_id or obj.prescription_id

    @admin.display(description='Reported user')
    def reported_user(self, obj):
        prescription = obj.prescription or (obj.response.prescription if obj.response else None)
        return prescription.user if prescription else '—'

    @admin.display(description='Report')
    def note_preview(self, obj):
        return obj.note[:80] + ('…' if len(obj.note) > 80 else '')

    def has_add_permission(self, request):
        return False


@admin.register(SafetyReport)
class SafetyReportAdmin(admin.ModelAdmin):
    list_display = ("id", "reporter_type", "reporter_name", "target_type", "target_name", "category", "status", "context_id", "created_at")
    list_filter = ("reporter_type", "target_type", "category", "status", "created_at")
    search_fields = ("id", "description", "reporter_user__name", "reporter_store__name", "reported_user__name", "reported_store__name", "prescription__id", "response__id")
    readonly_fields = ("reporter_type", "reporter_user", "reporter_store", "target_type", "reported_user", "reported_store", "prescription", "response", "category", "description", "created_at", "updated_at")
    ordering = ("-created_at",)
    list_select_related = ("reporter_user", "reporter_store", "reported_user", "reported_store")

    @admin.display(description="Reporter")
    def reporter_name(self, obj):
        return obj.reporter_store or obj.reporter_user or "—"

    @admin.display(description="Reported account")
    def target_name(self, obj):
        return obj.reported_store or obj.reported_user or "—"

    @admin.display(description="Context ID")
    def context_id(self, obj):
        return obj.response_id or obj.prescription_id or "—"

    def has_add_permission(self, request):
        return False


class PharmacistConsultationMessageInline(admin.TabularInline):
    model = PharmacistConsultationMessage
    extra = 0
    readonly_fields = ('sender_type', 'text', 'attachment', 'pharmacist_name_snapshot', 'pharmacist_license_snapshot', 'is_read', 'created_at')
    can_delete = False


@admin.register(PharmacistConsultation)
class PharmacistConsultationAdmin(admin.ModelAdmin):
    list_display = ('id', 'order', 'store', 'user', 'medicine_name', 'category', 'status', 'callback_requested', 'updated_at')
    list_filter = ('status', 'category', 'callback_requested', 'store', 'created_at')
    search_fields = ('medicine_name', 'question', 'store__name', 'user__name', 'order__id')
    readonly_fields = ('order', 'store', 'user', 'category', 'medicine_name', 'question', 'callback_phone', 'callback_preferred_time', 'user_consent_at', 'created_at', 'updated_at')
    inlines = (PharmacistConsultationMessageInline,)
    ordering = ('-updated_at',)


@admin.register(PharmacistConsultationMessage)
class PharmacistConsultationMessageAdmin(admin.ModelAdmin):
    list_display = ('id', 'consultation', 'sender_type', 'pharmacist_name_snapshot', 'created_at')
    list_filter = ('sender_type', 'created_at')
    search_fields = ('text', 'consultation__medicine_name')
    readonly_fields = ('consultation', 'sender_type', 'text', 'attachment', 'pharmacist_name_snapshot', 'pharmacist_license_snapshot', 'is_read', 'created_at')

    def has_add_permission(self, request):
        return False
