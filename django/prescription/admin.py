from django.contrib import admin, messages
from .models import (
    Store, User, ChatMessage, ChatThread,
    Prescription, PrescriptionResponse,
    PrescriptionResponseMedicine, PrescriptionTargetStore,
    WSEventLog, Rating, PrescriptionResponseStatusHistory, AppNotification
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
    list_display = ('id', 'name', 'mobile', 'is_active', 'is_verified', 'is_deleted', 'lifecycle_status', 'created_at')
    list_filter = ('is_active', 'is_verified', 'is_deleted')
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
