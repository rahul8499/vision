from django.db import models
from django.utils import timezone

from prescription.models import Store, User, PrescriptionResponse


class Complaint(models.Model):
    PARTY_CHOICES = [
        ('user', 'User'),
        ('store', 'Store'),
    ]

    CATEGORY_CHOICES = [
        ('delivery_issue', 'Delivery Issue'),
        ('wrong_or_expired_medicine', 'Wrong / Expired Medicine'),
        ('overcharging', 'Overcharging / Billing'),
        ('rude_behavior', 'Rude Behavior'),
        ('fake_order', 'Fake / Spam Order'),
        ('non_delivery', 'Non-Delivery'),
        ('product_quality', 'Product Quality'),
        ('payment_issue', 'Payment Issue'),
        ('other', 'Other'),
    ]

    STATUS_CHOICES = [
        ('open', 'Open'),
        ('under_review', 'Under Review'),
        ('awaiting_info', 'Awaiting Info'),
        ('resolved', 'Resolved'),
        ('rejected', 'Rejected'),
        ('withdrawn', 'Withdrawn'),
        ('closed', 'Closed'),
    ]

    # Allowed state transitions (mirrors the PrescriptionResponse FSM pattern)
    STATUS_TRANSITIONS = {
        'open': ['under_review', 'awaiting_info', 'resolved', 'rejected', 'withdrawn', 'closed'],
        'under_review': ['awaiting_info', 'resolved', 'rejected', 'withdrawn', 'closed'],
        'awaiting_info': ['under_review', 'resolved', 'rejected', 'withdrawn', 'closed'],
        'resolved': ['closed', 'under_review'],
        'rejected': ['closed'],
        'withdrawn': ['closed', 'open'],
        'closed': [],
    }

    PRIORITY_CHOICES = [
        ('low', 'Low'),
        ('medium', 'Medium'),
        ('high', 'High'),
        ('urgent', 'Urgent'),
    ]

    # Complainant (the one raising the complaint)
    complainant_type = models.CharField(max_length=10, choices=PARTY_CHOICES)
    complainant_user = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True, related_name='complaints_filed'
    )
    complainant_store = models.ForeignKey(
        Store, on_delete=models.SET_NULL, null=True, blank=True, related_name='complaints_filed'
    )

    # Respondent (the one being complained about)
    respondent_type = models.CharField(max_length=10, choices=PARTY_CHOICES)
    respondent_user = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True, related_name='complaints_against'
    )
    respondent_store = models.ForeignKey(
        Store, on_delete=models.SET_NULL, null=True, blank=True, related_name='complaints_against'
    )

    # Optional order context
    order = models.ForeignKey(
        PrescriptionResponse, on_delete=models.SET_NULL, null=True, blank=True, related_name='complaints'
    )

    category = models.CharField(max_length=40, choices=CATEGORY_CHOICES)
    subject = models.CharField(max_length=200)
    description = models.TextField()
    priority = models.CharField(max_length=10, choices=PRIORITY_CHOICES, default='medium')

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='open')
    assigned_to = models.CharField(max_length=100, null=True, blank=True)
    resolution_notes = models.TextField(null=True, blank=True)
    resolved_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['complainant_type', 'status']),
            models.Index(fields=['respondent_type', 'status']),
            models.Index(fields=['created_at']),
        ]

    def __str__(self):
        who = self.complainant_store.name if self.complainant_store else (self.complainant_user.name if self.complainant_user else '?')
        against = self.respondent_store.name if self.respondent_store else (self.respondent_user.name if self.respondent_user else '?')
        return f"Complaint #{self.id} {who} -> {against} ({self.get_status_display()})"

    # ---- Convenience accessors ----
    @property
    def complainant(self):
        return self.complainant_store or self.complainant_user

    @property
    def respondent(self):
        return self.respondent_store or self.respondent_user

    @property
    def is_terminal(self):
        return self.status in ('resolved', 'rejected', 'withdrawn', 'closed')


class ComplaintAttachment(models.Model):
    complaint = models.ForeignKey(Complaint, on_delete=models.CASCADE, related_name='attachments')
    file = models.FileField(upload_to='complaints/')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Attachment #{self.id} for Complaint {self.complaint_id}"


class ComplaintMessage(models.Model):
    SENDER_CHOICES = [
        ('user', 'User'),
        ('store', 'Store'),
        ('platform', 'Platform'),
    ]

    complaint = models.ForeignKey(Complaint, on_delete=models.CASCADE, related_name='messages')
    sender_type = models.CharField(max_length=10, choices=SENDER_CHOICES)
    sender_user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    sender_store = models.ForeignKey(Store, on_delete=models.SET_NULL, null=True, blank=True)
    text = models.TextField(null=True, blank=True)
    attachment = models.FileField(upload_to='complaints/', null=True, blank=True)
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f"Message #{self.id} on Complaint {self.complaint_id} by {self.sender_type}"


class ComplaintStatusHistory(models.Model):
    complaint = models.ForeignKey(Complaint, on_delete=models.CASCADE, related_name='status_history')
    from_status = models.CharField(max_length=20)
    to_status = models.CharField(max_length=20)
    changed_by = models.CharField(max_length=20, default='platform')
    note = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Complaint {self.complaint_id}: {self.from_status} -> {self.to_status}"


class PlatformSupportTicket(models.Model):
    CATEGORY_CHOICES = [
        ('app_bug', 'App bug'), ('account', 'Account access'),
        ('verification', 'Verification'), ('subscription', 'Subscription & billing'),
        ('technical', 'Technical problem'), ('feature', 'Feature request'), ('other', 'Other'),
    ]
    STATUS_CHOICES = [
        ('open', 'Open'), ('in_progress', 'In progress'),
        ('waiting_for_user', 'Waiting for you'), ('resolved', 'Resolved'), ('closed', 'Closed'),
    ]
    PRIORITY_CHOICES = [('low', 'Low'), ('medium', 'Medium'), ('high', 'High'), ('urgent', 'Urgent')]
    REQUESTER_CHOICES = [('user', 'User'), ('store', 'Store')]

    requester_type = models.CharField(max_length=10, choices=REQUESTER_CHOICES)
    requester_user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='platform_support_tickets')
    requester_store = models.ForeignKey(Store, on_delete=models.SET_NULL, null=True, blank=True, related_name='platform_support_tickets')
    category = models.CharField(max_length=30, choices=CATEGORY_CHOICES)
    subject = models.CharField(max_length=200)
    description = models.TextField()
    priority = models.CharField(max_length=10, choices=PRIORITY_CHOICES, default='medium')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='open')
    assigned_to = models.CharField(max_length=100, blank=True)
    resolution_note = models.TextField(blank=True)
    resolved_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-updated_at']
        indexes = [models.Index(fields=['requester_type', 'status', 'updated_at'])]

    def __str__(self):
        return f"Support #{self.id}: {self.subject}"


class PlatformSupportMessage(models.Model):
    SENDER_CHOICES = [('user', 'User'), ('store', 'Store'), ('platform', 'AARX Support')]
    ticket = models.ForeignKey(PlatformSupportTicket, on_delete=models.CASCADE, related_name='messages')
    sender_type = models.CharField(max_length=10, choices=SENDER_CHOICES)
    sender_user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    sender_store = models.ForeignKey(Store, on_delete=models.SET_NULL, null=True, blank=True)
    text = models.TextField(blank=True)
    attachment = models.FileField(upload_to='platform_support/', null=True, blank=True)
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f"Support message #{self.id} on ticket {self.ticket_id}"
