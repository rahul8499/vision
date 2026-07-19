from django.contrib import admin
from django.utils import timezone

from .models import (
    Complaint,
    ComplaintAttachment,
    ComplaintMessage,
    ComplaintStatusHistory,
    PlatformSupportTicket,
    PlatformSupportMessage,
    PlatformSupportTicketStatusHistory,
    SupportCaseRating,
)


@admin.register(Complaint)
class ComplaintAdmin(admin.ModelAdmin):
    list_display = (
        'id', 'subject', 'category', 'status', 'priority',
        'complainant_type', 'complainant_name', 'respondent_type', 'respondent_name',
        'order', 'assigned_to', 'created_at',
    )
    list_filter = ('status', 'category', 'priority', 'complainant_type', 'respondent_type', 'created_at')
    search_fields = ('subject', 'description', 'assigned_to')
    readonly_fields = ('created_at', 'updated_at', 'resolved_at')
    ordering = ('-created_at',)
    actions = ['mark_resolved', 'mark_rejected', 'mark_under_review', 'mark_closed']

    def complainant_name(self, obj):
        return obj.complainant_store.name if obj.complainant_store else (obj.complainant_user.name if obj.complainant_user else '-')
    complainant_name.short_description = 'Complainant'

    def respondent_name(self, obj):
        return obj.respondent_store.name if obj.respondent_store else (obj.respondent_user.name if obj.respondent_user else '-')
    respondent_name.short_description = 'Respondent'

    @admin.action(description='Mark selected as Resolved')
    def mark_resolved(self, request, queryset):
        for c in queryset.exclude(status__in=['resolved', 'closed']):
            old = c.status
            c.status = 'resolved'
            c.resolved_at = c.resolved_at or timezone.now()
            c.save()
            ComplaintStatusHistory.objects.create(
                complaint=c, from_status=old, to_status='resolved',
                changed_by='platform', note='Resolved via admin'
            )
        self.message_user(request, f"{queryset.count()} complaint(s) marked resolved.")

    @admin.action(description='Mark selected as Rejected')
    def mark_rejected(self, request, queryset):
        for c in queryset.exclude(status__in=['rejected', 'closed']):
            old = c.status
            c.status = 'rejected'
            c.resolved_at = c.resolved_at or timezone.now()
            c.save()
            ComplaintStatusHistory.objects.create(
                complaint=c, from_status=old, to_status='rejected',
                changed_by='platform', note='Rejected via admin'
            )
        self.message_user(request, f"{queryset.count()} complaint(s) marked rejected.")

    @admin.action(description='Mark selected as Under Review')
    def mark_under_review(self, request, queryset):
        for c in queryset.exclude(status__in=['resolved', 'rejected', 'closed', 'withdrawn']):
            old = c.status
            c.status = 'under_review'
            c.save()
            ComplaintStatusHistory.objects.create(
                complaint=c, from_status=old, to_status='under_review',
                changed_by='platform', note='Under review via admin'
            )
        self.message_user(request, f"{queryset.count()} complaint(s) marked under review.")

    @admin.action(description='Mark selected as Closed')
    def mark_closed(self, request, queryset):
        for c in queryset.exclude(status='closed'):
            old = c.status
            c.status = 'closed'
            c.resolved_at = c.resolved_at or timezone.now()
            c.save()
            ComplaintStatusHistory.objects.create(
                complaint=c, from_status=old, to_status='closed',
                changed_by='platform', note='Closed via admin'
            )
        self.message_user(request, f"{queryset.count()} complaint(s) marked closed.")


@admin.register(ComplaintMessage)
class ComplaintMessageAdmin(admin.ModelAdmin):
    list_display = ('id', 'complaint', 'sender_type', 'sender_name', 'text', 'is_read', 'created_at')
    list_filter = ('sender_type', 'is_read', 'created_at')
    search_fields = ('text',)
    readonly_fields = ('created_at',)

    def sender_name(self, obj):
        return obj.sender_store.name if obj.sender_store else (obj.sender_user.name if obj.sender_user else obj.sender_type)
    sender_name.short_description = 'Sender'


@admin.register(ComplaintAttachment)
class ComplaintAttachmentAdmin(admin.ModelAdmin):
    list_display = ('id', 'complaint', 'file', 'created_at')
    readonly_fields = ('created_at',)


@admin.register(ComplaintStatusHistory)
class ComplaintStatusHistoryAdmin(admin.ModelAdmin):
    list_display = ('id', 'complaint', 'from_status', 'to_status', 'changed_by', 'created_at')
    list_filter = ('changed_by', 'from_status', 'to_status')
    readonly_fields = ('created_at',)


class PlatformSupportMessageInline(admin.TabularInline):
    model = PlatformSupportMessage
    extra = 0
    fields = ('sender_type', 'sender_user', 'sender_store', 'text', 'attachment', 'is_read', 'created_at')
    readonly_fields = ('created_at',)


@admin.register(PlatformSupportTicket)
class PlatformSupportTicketAdmin(admin.ModelAdmin):
    list_display = ('id', 'subject', 'category', 'requester_type', 'requester_name', 'status', 'priority', 'assigned_to', 'updated_at')
    list_filter = ('status', 'category', 'priority', 'requester_type', 'created_at')
    search_fields = ('subject', 'description', 'requester_user__name', 'requester_store__name', 'assigned_to')
    readonly_fields = ('created_at', 'updated_at', 'resolved_at')
    ordering = ('-updated_at',)
    inlines = (PlatformSupportMessageInline,)
    actions = ('mark_in_progress', 'mark_waiting', 'mark_resolved', 'mark_closed')

    def requester_name(self, obj):
        return obj.requester_store.name if obj.requester_store else (obj.requester_user.name if obj.requester_user else '-')

    def _set_status(self, queryset, value):
        updates = {'status': value}
        if value in ('resolved', 'closed'):
            updates['resolved_at'] = timezone.now()
        elif value in ('open', 'in_progress', 'waiting_for_user'):
            updates['resolved_at'] = None
        return queryset.update(**updates)

    @admin.action(description='Mark selected in progress')
    def mark_in_progress(self, request, queryset):
        self.message_user(request, f"{self._set_status(queryset, 'in_progress')} ticket(s) updated.")

    @admin.action(description='Mark selected waiting for user')
    def mark_waiting(self, request, queryset):
        self.message_user(request, f"{self._set_status(queryset, 'waiting_for_user')} ticket(s) updated.")

    @admin.action(description='Mark selected resolved')
    def mark_resolved(self, request, queryset):
        self.message_user(request, f"{self._set_status(queryset, 'resolved')} ticket(s) updated.")

    @admin.action(description='Mark selected closed')
    def mark_closed(self, request, queryset):
        self.message_user(request, f"{self._set_status(queryset, 'closed')} ticket(s) updated.")


@admin.register(PlatformSupportMessage)
class PlatformSupportMessageAdmin(admin.ModelAdmin):
    list_display = ('id', 'ticket', 'sender_type', 'text', 'is_read', 'created_at')
    list_filter = ('sender_type', 'is_read', 'created_at')
    search_fields = ('ticket__subject', 'text')
    readonly_fields = ('created_at',)


@admin.register(PlatformSupportTicketStatusHistory)
class PlatformSupportTicketStatusHistoryAdmin(admin.ModelAdmin):
    list_display = ('ticket', 'from_status', 'to_status', 'changed_by_staff', 'created_at')
    list_filter = ('to_status', 'created_at')
    search_fields = ('ticket__subject', 'note')
    readonly_fields = ('created_at',)


@admin.register(SupportCaseRating)
class SupportCaseRatingAdmin(admin.ModelAdmin):
    list_display = ('id', 'complaint', 'ticket', 'rating', 'credited_staff', 'created_at')
    list_filter = ('rating', 'created_at')
    search_fields = ('feedback',)
    readonly_fields = ('created_at', 'updated_at')
