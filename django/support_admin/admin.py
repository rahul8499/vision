from django.contrib import admin
from .models import (
    SupportStaff,
    SupportSession,
    SupportAssignment,
    InternalNote,
    RefundRequest,
    SafetyReportAction,
    SupportAuditLog,
    SLAConfiguration,
    SupportNotification,
    ContactLog,
    SavedReplyTemplate,
    SupportHoliday,
    CaseSLAClock,
    CaseEscalation,
    CaseRelation,
    EngineeringIssue,
    SensitiveActionRequest,
)


@admin.register(SupportStaff)
class SupportStaffAdmin(admin.ModelAdmin):
    list_display = ("user", "role", "employee_id", "all_cities_access", "is_active", "last_seen_at", "created_at")
    list_filter = ("role", "is_active", "created_at")
    search_fields = ("user__email", "employee_id", "phone")
    readonly_fields = ("created_at", "updated_at")
    filter_horizontal = ("cities",)


@admin.register(SupportSession)
class SupportSessionAdmin(admin.ModelAdmin):
    list_display = ("staff", "session_key", "expires_at", "created_at")
    list_filter = ("staff", "expires_at")
    search_fields = ("staff__user__email", "staff__user__username", "session_key")
    readonly_fields = ("created_at", "last_activity_at")


@admin.register(SupportAssignment)
class SupportAssignmentAdmin(admin.ModelAdmin):
    list_display = ("content_object", "assigned_to", "assigned_by", "is_active", "assigned_at")
    list_filter = ("is_active", "content_type")
    search_fields = ("object_id", "assigned_to__user__email", "assigned_by__user__email")
    readonly_fields = ("assigned_at", "unassigned_at")


@admin.register(InternalNote)
class InternalNoteAdmin(admin.ModelAdmin):
    list_display = ("content_object", "created_by", "is_pinned", "is_deleted", "created_at")
    list_filter = ("is_pinned", "is_deleted", "content_type")
    search_fields = ("body", "created_by__user__email")
    readonly_fields = ("created_at", "updated_at")


@admin.register(RefundRequest)
class RefundRequestAdmin(admin.ModelAdmin):
    list_display = ("id", "charge", "amount", "status", "requested_by", "assigned_to", "created_at")
    list_filter = ("status", "created_at")
    search_fields = ("charge__id", "reason", "payment_reference")
    readonly_fields = ("created_at", "updated_at", "approved_at", "processed_at")


@admin.register(SafetyReportAction)
class SafetyReportActionAdmin(admin.ModelAdmin):
    list_display = ("report", "action", "admin", "target_user", "target_store", "created_at")
    list_filter = ("action", "created_at")
    search_fields = ("report__id", "note", "admin__user__email")
    readonly_fields = ("created_at",)


@admin.register(SupportAuditLog)
class SupportAuditLogAdmin(admin.ModelAdmin):
    list_display = ("actor", "action", "entity_type", "entity_id", "ip_address", "created_at")
    list_filter = ("action", "entity_type", "created_at")
    search_fields = ("entity_id", "actor__user__email", "ip_address")
    readonly_fields = ("created_at",)


@admin.register(SLAConfiguration)
class SLAConfigurationAdmin(admin.ModelAdmin):
    list_display = ("entity_type", "priority", "first_response_minutes", "resolution_minutes", "working_hours_only", "pause_when_waiting", "auto_escalate", "auto_assign", "is_active")
    list_filter = ("entity_type", "is_active", "working_hours_only", "auto_escalate", "auto_assign")
    search_fields = ("priority",)


@admin.register(SupportHoliday)
class SupportHolidayAdmin(admin.ModelAdmin):
    list_display = ("date", "name", "is_active")
    list_filter = ("is_active",)
    search_fields = ("name",)


@admin.register(CaseSLAClock)
class CaseSLAClockAdmin(admin.ModelAdmin):
    list_display = ("content_type", "object_id", "paused_at", "paused_business_seconds", "warning_stage", "breached_stage", "updated_at")
    list_filter = ("content_type",)
    readonly_fields = ("updated_at",)


@admin.register(SupportNotification)
class SupportNotificationAdmin(admin.ModelAdmin):
    list_display = ("recipient", "notification_type", "title", "is_read", "created_at")
    list_filter = ("notification_type", "is_read", "created_at")
    search_fields = ("title", "message", "recipient__user__email")
    readonly_fields = ("created_at",)


@admin.register(ContactLog)
class ContactLogAdmin(admin.ModelAdmin):
    list_display = ("content_type", "object_id", "channel", "outcome", "status", "created_by", "follow_up_at", "created_at")
    list_filter = ("channel", "outcome", "status", "created_at")


@admin.register(SavedReplyTemplate)
class SavedReplyTemplateAdmin(admin.ModelAdmin):
    list_display = ("title", "category", "visibility", "is_active", "created_by", "updated_at")
    list_filter = ("visibility", "is_active", "category")
    search_fields = ("title", "body", "category")
    readonly_fields = ("created_at", "updated_at")


@admin.register(CaseEscalation)
class CaseEscalationAdmin(admin.ModelAdmin):
    list_display = ("entity_type", "entity_id", "destination", "status", "escalated_by", "created_at")
    list_filter = ("destination", "status", "entity_type")
    search_fields = ("entity_id", "reason", "handover_note")


@admin.register(CaseRelation)
class CaseRelationAdmin(admin.ModelAdmin):
    list_display = ("source_type", "source_id", "relation", "target_type", "target_id", "created_by")
    list_filter = ("relation", "source_type", "target_type")


@admin.register(EngineeringIssue)
class EngineeringIssueAdmin(admin.ModelAdmin):
    list_display = ("title", "entity_type", "entity_id", "priority", "status", "owner", "updated_at")
    list_filter = ("priority", "status", "entity_type")
    search_fields = ("title", "description", "owner", "external_reference")


@admin.register(SensitiveActionRequest)
class SensitiveActionRequestAdmin(admin.ModelAdmin):
    list_display = ("action_type", "entity_type", "entity_id", "status", "requested_by", "reviewed_by", "created_at")
    list_filter = ("action_type", "status", "entity_type")
    search_fields = ("entity_id", "reason", "verification_reference")
