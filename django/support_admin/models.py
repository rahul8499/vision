import datetime
import uuid
from django.db import models
from django.db import transaction
from django.contrib.auth import get_user_model
from django.utils import timezone
from django.core.exceptions import ValidationError
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType

User = get_user_model()


class SupportStaff(models.Model):
    ROLE_AGENT = "agent"
    ROLE_SUPERVISOR = "supervisor"
    ROLE_ADMIN = "admin"

    ROLE_CHOICES = [
        (ROLE_AGENT, "Agent"),
        (ROLE_SUPERVISOR, "Supervisor"),
        (ROLE_ADMIN, "Admin"),
    ]

    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name="support_staff_profile",
    )
    role = models.CharField(max_length=20, choices=ROLE_CHOICES)
    is_active = models.BooleanField(default=True)
    employee_id = models.CharField(max_length=50, unique=True)
    department = models.CharField(max_length=100, blank=True)
    phone = models.CharField(max_length=20, blank=True)
    timezone = models.CharField(max_length=50, default="Asia/Kolkata")
    all_cities_access = models.BooleanField(default=False)
    cities = models.ManyToManyField("emergency_services.City", blank=True, related_name="support_staff")
    last_seen_at = models.DateTimeField(null=True, blank=True)
    created_by = models.ForeignKey(
        User,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="created_support_staff",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=["role", "is_active"]),
            models.Index(fields=["is_active", "created_at"]),
        ]

    def __str__(self):
        user = self.user
        display = getattr(user, "name", None) or getattr(user, "get_full_name", lambda: "")() or getattr(user, "username", "")
        return f"{display} ({self.role})"

    def clean(self):
        if not self.employee_id.strip():
            raise ValidationError({"employee_id": "Employee ID is required."})
        if SupportStaff.objects.filter(employee_id=self.employee_id).exclude(pk=self.pk).exists():
            raise ValidationError({"employee_id": "Employee ID already exists."})

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)


class SupportSession(models.Model):
    staff = models.ForeignKey(SupportStaff, on_delete=models.CASCADE, related_name="sessions")
    session_key = models.CharField(max_length=255, unique=True)
    expires_at = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)
    last_activity_at = models.DateTimeField(auto_now=True)

    def is_valid(self):
        return self.expires_at > timezone.now()

    def __str__(self):
        user = self.staff.user
        display = getattr(user, "name", None) or getattr(user, "get_full_name", lambda: "")() or getattr(user, "username", "")
        return f"Session {display}"


class SupportAssignment(models.Model):
    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE)
    object_id = models.PositiveBigIntegerField()
    content_object = GenericForeignKey("content_type", "object_id")

    assigned_to = models.ForeignKey(
        SupportStaff,
        on_delete=models.PROTECT,
        related_name="assignments",
    )
    assigned_by = models.ForeignKey(
        SupportStaff,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="assignments_created",
    )
    is_active = models.BooleanField(default=True)
    assigned_at = models.DateTimeField(auto_now_add=True)
    unassigned_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        indexes = [
            models.Index(fields=["content_type", "object_id", "is_active"]),
            models.Index(fields=["assigned_to", "is_active"]),
        ]

    def __str__(self):
        return f"{self.content_type} #{self.object_id} → {self.assigned_to}"


class InternalNote(models.Model):
    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE)
    object_id = models.PositiveBigIntegerField()
    content_object = GenericForeignKey("content_type", "object_id")

    body = models.TextField()
    created_by = models.ForeignKey(
        SupportStaff,
        on_delete=models.PROTECT,
        related_name="internal_notes",
    )
    is_pinned = models.BooleanField(default=False)
    is_edited = models.BooleanField(default=False)
    is_deleted = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=["content_type", "object_id", "is_deleted"]),
            models.Index(fields=["created_by", "created_at"]),
        ]

    def __str__(self):
        return f"Note on {self.content_type} #{self.object_id} by {self.created_by}"


class RefundRequest(models.Model):
    STATUS_PENDING = "pending"
    STATUS_APPROVED = "approved"
    STATUS_REJECTED = "rejected"
    STATUS_PROCESSED = "processed"
    STATUS_FAILED = "failed"
    STATUS_CANCELLED = "cancelled"

    STATUS_CHOICES = [
        (STATUS_PENDING, "Pending"),
        (STATUS_APPROVED, "Approved"),
        (STATUS_REJECTED, "Rejected"),
        (STATUS_PROCESSED, "Processed"),
        (STATUS_FAILED, "Failed"),
        (STATUS_CANCELLED, "Cancelled"),
    ]

    charge = models.ForeignKey(
        "emergency_services.EmergencyBroadcastCharge",
        on_delete=models.PROTECT,
        related_name="admin_refund_requests",
    )
    prescription_response = models.ForeignKey(
        "prescription.PrescriptionResponse",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="admin_refund_requests",
    )
    requested_by = models.ForeignKey(
        SupportStaff,
        on_delete=models.PROTECT,
        related_name="requested_refunds",
    )
    assigned_to = models.ForeignKey(
        SupportStaff,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="assigned_refunds",
    )
    reviewed_by = models.ForeignKey(
        SupportStaff,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="reviewed_refunds",
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_PENDING)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    reason = models.TextField()
    rejection_reason = models.TextField(blank=True)
    payment_gateway = models.CharField(max_length=50, blank=True)
    payment_reference = models.CharField(max_length=255, blank=True)
    processed_at = models.DateTimeField(null=True, blank=True)
    approved_at = models.DateTimeField(null=True, blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=["status", "created_at"]),
            models.Index(fields=["assigned_to", "status"]),
            models.Index(fields=["charge", "status"]),
        ]

    def __str__(self):
        return f"Refund #{self.pk} — {self.amount} ({self.status})"


class SafetyReportAction(models.Model):
    ACTION_CHOICES = [
        ("reviewed", "Reviewed"),
        ("warning_sent", "Warning Sent"),
        ("account_suspended", "Account Suspended"),
        ("account_restored", "Account Restored"),
        ("escalated", "Escalated"),
        ("closed", "Closed"),
        ("assigned", "Assigned"),
    ]

    report = models.ForeignKey(
        "prescription.SafetyReport",
        on_delete=models.CASCADE,
        related_name="admin_actions",
    )
    action = models.CharField(max_length=30, choices=ACTION_CHOICES)
    admin = models.ForeignKey(SupportStaff, on_delete=models.CASCADE)
    note = models.TextField()
    target_user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    target_store = models.ForeignKey("prescription.Store", on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=["report", "created_at"]),
            models.Index(fields=["admin", "created_at"]),
        ]

    def __str__(self):
        return f"Action {self.action} on Report #{self.report_id}"


class SupportAuditLog(models.Model):
    actor = models.ForeignKey(
        SupportStaff,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="audit_logs",
    )
    action = models.CharField(max_length=100)
    entity_type = models.CharField(max_length=100)
    entity_id = models.CharField(max_length=100)
    old_data = models.JSONField(default=dict, blank=True)
    new_data = models.JSONField(default=dict, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=["actor", "created_at"]),
            models.Index(fields=["entity_type", "entity_id", "created_at"]),
            models.Index(fields=["action", "created_at"]),
        ]

    def __str__(self):
        return f"{self.action} {self.entity_type} #{self.entity_id} by {self.actor}"


class SLAConfiguration(models.Model):
    ENTITY_CHOICES = [
        ("complaint", "Complaint"),
        ("ticket", "Support Ticket"),
        ("refund", "Refund Request"),
        ("safety_report", "Safety Report"),
    ]

    entity_type = models.CharField(max_length=50, choices=ENTITY_CHOICES)
    priority = models.CharField(max_length=20)
    first_response_minutes = models.PositiveIntegerField()
    resolution_minutes = models.PositiveIntegerField()
    is_active = models.BooleanField(default=True)
    working_hours_only = models.BooleanField(default=False)
    workday_start = models.TimeField(default=datetime.time(9, 0))
    workday_end = models.TimeField(default=datetime.time(18, 0))
    working_days = models.JSONField(default=list, blank=True, help_text="Weekdays: Monday=0 through Sunday=6")
    pause_when_waiting = models.BooleanField(default=True)
    warning_minutes = models.PositiveIntegerField(default=30)
    auto_escalate = models.BooleanField(default=False)
    auto_assign = models.BooleanField(default=False)

    class Meta:
        unique_together = ("entity_type", "priority")
        indexes = [models.Index(fields=["entity_type", "is_active"])]

    def __str__(self):
        return f"SLA {self.entity_type} {self.priority}"


class SupportHoliday(models.Model):
    date = models.DateField(unique=True)
    name = models.CharField(max_length=120)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["date"]

    def __str__(self):
        return f"{self.name} ({self.date})"


class CaseSLAClock(models.Model):
    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE)
    object_id = models.PositiveBigIntegerField()
    content_object = GenericForeignKey("content_type", "object_id")
    paused_at = models.DateTimeField(null=True, blank=True)
    paused_seconds = models.PositiveBigIntegerField(default=0)
    paused_business_seconds = models.PositiveBigIntegerField(default=0)
    warning_stage = models.CharField(max_length=30, blank=True)
    breached_stage = models.CharField(max_length=30, blank=True)
    escalated_stage = models.CharField(max_length=30, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["content_type", "object_id"], name="unique_case_sla_clock")]


class SupportNotification(models.Model):
    recipient = models.ForeignKey(SupportStaff, on_delete=models.CASCADE, related_name="notifications")
    notification_type = models.CharField(max_length=100)
    title = models.CharField(max_length=255)
    message = models.TextField()
    entity_type = models.CharField(max_length=100, blank=True)
    entity_id = models.CharField(max_length=100, blank=True)
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=["recipient", "is_read", "created_at"]),
            models.Index(fields=["entity_type", "entity_id"]),
        ]

    def __str__(self):
        return f"{self.title} → {self.recipient}"

    def save(self, *args, **kwargs):
        is_new = self.pk is None
        super().save(*args, **kwargs)
        if is_new:
            notification_id = self.id
            recipient_id = self.recipient_id
            data = {
                "id": self.id, "title": self.title, "message": self.message,
                "entity_type": self.entity_type, "entity_id": self.entity_id,
                "notification_type": self.notification_type,
            }

            def publish():
                try:
                    from asgiref.sync import async_to_sync
                    from channels.layers import get_channel_layer
                    channel_layer = get_channel_layer()
                    if channel_layer:
                        async_to_sync(channel_layer.group_send)("support_admin_dashboard", {
                            "type": "notification_created", "recipient_id": recipient_id,
                            "data": {**data, "id": notification_id},
                        })
                except Exception:
                    # Persistence remains authoritative if realtime is unavailable.
                    pass

            transaction.on_commit(publish)


class ContactLog(models.Model):
    CHANNEL_CHOICES = [("call", "Call"), ("sms", "SMS"), ("whatsapp", "WhatsApp"), ("email", "Email"), ("other", "Other")]
    OUTCOME_CHOICES = [("contacted", "Contacted"), ("no_answer", "No answer"), ("callback", "Callback requested"), ("message_sent", "Message sent"), ("resolved", "Resolved")]
    STATUS_CHOICES = [("scheduled", "Scheduled"), ("completed", "Completed"), ("cancelled", "Cancelled")]
    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE)
    object_id = models.PositiveBigIntegerField()
    content_object = GenericForeignKey("content_type", "object_id")
    channel = models.CharField(max_length=20, choices=CHANNEL_CHOICES)
    outcome = models.CharField(max_length=30, choices=OUTCOME_CHOICES)
    note = models.TextField(blank=True)
    follow_up_at = models.DateTimeField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="scheduled")
    completed_at = models.DateTimeField(null=True, blank=True)
    created_by = models.ForeignKey(SupportStaff, on_delete=models.PROTECT, related_name="contact_logs")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [models.Index(fields=["content_type", "object_id", "created_at"]), models.Index(fields=["follow_up_at"])]


class SavedReplyTemplate(models.Model):
    VISIBILITY_CHOICES = [("user", "User"), ("store", "Store"), ("shared", "Shared"), ("internal", "Internal")]
    title = models.CharField(max_length=120)
    body = models.TextField()
    category = models.CharField(max_length=50, blank=True)
    visibility = models.CharField(max_length=20, choices=VISIBILITY_CHOICES, default="shared")
    is_active = models.BooleanField(default=True)
    created_by = models.ForeignKey(SupportStaff, on_delete=models.PROTECT, related_name="saved_replies")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["category", "title"]
        indexes = [models.Index(fields=["is_active", "category"])]


class CaseEscalation(models.Model):
    DESTINATION_CHOICES = [(value, label) for value, label in [
        ("supervisor", "Supervisor"), ("technical", "Technical team"),
        ("emergency", "Emergency team"), ("legal", "Legal team"),
    ]]
    STATUS_CHOICES = [("open", "Open"), ("accepted", "Accepted"), ("resolved", "Resolved"), ("cancelled", "Cancelled")]
    entity_type = models.CharField(max_length=30, db_index=True)
    entity_id = models.PositiveBigIntegerField(db_index=True)
    destination = models.CharField(max_length=20, choices=DESTINATION_CHOICES)
    reason = models.TextField()
    handover_note = models.TextField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="open", db_index=True)
    escalated_by = models.ForeignKey(SupportStaff, on_delete=models.PROTECT, related_name="case_escalations")
    resolved_by = models.ForeignKey(SupportStaff, null=True, blank=True, on_delete=models.SET_NULL, related_name="resolved_case_escalations")
    resolved_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [models.Index(fields=["entity_type", "entity_id", "status"])]


class CaseRelation(models.Model):
    RELATION_CHOICES = [("related", "Related"), ("duplicate", "Duplicate"), ("caused_by", "Caused by")]
    source_type = models.CharField(max_length=30)
    source_id = models.PositiveBigIntegerField()
    target_type = models.CharField(max_length=30)
    target_id = models.PositiveBigIntegerField()
    relation = models.CharField(max_length=20, choices=RELATION_CHOICES, default="related")
    reason = models.TextField(blank=True)
    created_by = models.ForeignKey(SupportStaff, on_delete=models.PROTECT, related_name="case_relations")
    merged_by = models.ForeignKey(SupportStaff, null=True, blank=True, on_delete=models.SET_NULL, related_name="duplicate_case_merges")
    merged_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["source_type", "source_id", "target_type", "target_id"], name="unique_support_case_relation")]
        indexes = [models.Index(fields=["source_type", "source_id"]), models.Index(fields=["target_type", "target_id"])]


class EngineeringIssue(models.Model):
    STATUS_CHOICES = [("open", "Open"), ("triaged", "Triaged"), ("in_progress", "In progress"), ("fixed", "Fixed"), ("closed", "Closed")]
    PRIORITY_CHOICES = [("low", "Low"), ("medium", "Medium"), ("high", "High"), ("urgent", "Urgent")]
    entity_type = models.CharField(max_length=30, db_index=True)
    entity_id = models.PositiveBigIntegerField(db_index=True)
    title = models.CharField(max_length=200)
    description = models.TextField()
    priority = models.CharField(max_length=10, choices=PRIORITY_CHOICES, default="medium")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="open")
    owner = models.CharField(max_length=120, blank=True)
    external_reference = models.CharField(max_length=200, blank=True)
    created_by = models.ForeignKey(SupportStaff, on_delete=models.PROTECT, related_name="engineering_issues")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)


class SensitiveActionRequest(models.Model):
    ACTION_CHOICES = [("account_suspend", "Suspend account"), ("account_restore", "Restore account"), ("personal_data_change", "Change personal data"), ("high_value_refund", "High-value refund")]
    STATUS_CHOICES = [("pending", "Pending"), ("approved", "Approved"), ("rejected", "Rejected"), ("executed", "Executed"), ("cancelled", "Cancelled")]
    entity_type = models.CharField(max_length=30, db_index=True)
    entity_id = models.PositiveBigIntegerField(db_index=True)
    action_type = models.CharField(max_length=30, choices=ACTION_CHOICES)
    reason = models.TextField()
    verification_method = models.CharField(max_length=50)
    verification_reference = models.CharField(max_length=200)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="pending", db_index=True)
    requested_by = models.ForeignKey(SupportStaff, on_delete=models.PROTECT, related_name="sensitive_action_requests")
    reviewed_by = models.ForeignKey(SupportStaff, null=True, blank=True, on_delete=models.SET_NULL, related_name="reviewed_sensitive_actions")
    review_note = models.TextField(blank=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
