from django.contrib.contenttypes.models import ContentType
from rest_framework import serializers
from prescription.models import SafetyReport, User, Store, Prescription, PrescriptionResponse, PrescriptionTargetStore
from complaints.models import Complaint, PlatformSupportTicket
from .models import SupportStaff, SupportAssignment, InternalNote, RefundRequest, SafetyReportAction, SupportAuditLog, SLAConfiguration, SupportNotification


class SupportStaffSerializer(serializers.ModelSerializer):
    name = serializers.SerializerMethodField()
    email = serializers.CharField(source="user.email", read_only=True)

    class Meta:
        model = SupportStaff
        fields = ["id", "user", "name", "email", "role", "is_active", "employee_id", "department", "phone", "timezone", "last_seen_at", "created_at"]
        read_only_fields = ["id", "created_at"]

    def get_name(self, obj):
        return obj.user.get_full_name() or obj.user.username


class SupportStaffCreateSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=100)
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, min_length=8)
    role = serializers.ChoiceField(choices=SupportStaff.ROLE_CHOICES, default=SupportStaff.ROLE_AGENT)
    employee_id = serializers.CharField(max_length=50)
    department = serializers.CharField(required=False, allow_blank=True)
    phone = serializers.CharField(required=False, allow_blank=True)


class SupportAssignmentSerializer(serializers.ModelSerializer):
    assigned_to_name = serializers.CharField(source="assigned_to.user.name", read_only=True)
    assigned_by_name = serializers.CharField(source="assigned_by.user.name", read_only=True)

    class Meta:
        model = SupportAssignment
        fields = ["id", "content_type", "object_id", "assigned_to", "assigned_to_name", "assigned_by", "assigned_by_name", "is_active", "assigned_at", "unassigned_at"]
        read_only_fields = ["id", "assigned_at", "unassigned_at"]


class InternalNoteSerializer(serializers.ModelSerializer):
    created_by_name = serializers.CharField(source="created_by.user.name", read_only=True)

    class Meta:
        model = InternalNote
        fields = ["id", "content_type", "object_id", "body", "created_by", "created_by_name", "is_pinned", "is_edited", "is_deleted", "created_at", "updated_at"]
        read_only_fields = ["id", "created_by", "created_at", "updated_at"]


class InternalNoteCreateSerializer(serializers.Serializer):
    body = serializers.CharField()
    is_pinned = serializers.BooleanField(default=False)


class RefundRequestSerializer(serializers.ModelSerializer):
    requested_by_name = serializers.CharField(source="requested_by.user.name", read_only=True)
    assigned_to_name = serializers.CharField(source="assigned_to.user.name", read_only=True)
    reviewed_by_name = serializers.CharField(source="reviewed_by.user.name", read_only=True)

    class Meta:
        model = RefundRequest
        fields = [
            "id", "charge", "prescription_response", "requested_by", "requested_by_name",
            "assigned_to", "assigned_to_name", "reviewed_by", "reviewed_by_name",
            "status", "amount", "reason", "rejection_reason", "payment_gateway",
            "payment_reference", "processed_at", "approved_at", "metadata", "created_at", "updated_at"
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class RefundRequestCreateSerializer(serializers.Serializer):
    charge_id = serializers.UUIDField()
    prescription_response_id = serializers.IntegerField(required=False, allow_null=True)
    amount = serializers.DecimalField(max_digits=12, decimal_places=2)
    reason = serializers.CharField()


class RefundReviewSerializer(serializers.Serializer):
    action = serializers.ChoiceField(choices=["approve", "reject", "process", "retry"])
    admin_note = serializers.CharField(required=False, allow_blank=True)
    payment_reference = serializers.CharField(required=False, allow_blank=True)


class SafetyReportActionSerializer(serializers.ModelSerializer):
    admin_name = serializers.SerializerMethodField()

    class Meta:
        model = SafetyReportAction
        fields = ["id", "report", "action", "admin", "admin_name", "note", "target_user", "target_store", "created_at"]
        read_only_fields = ["id", "created_at"]

    def get_admin_name(self, obj):
        return obj.admin.user.get_full_name() or obj.admin.user.username


class SafetyReportActionCreateSerializer(serializers.Serializer):
    action = serializers.ChoiceField(choices=SafetyReportAction.ACTION_CHOICES)
    note = serializers.CharField()
    target_user_id = serializers.IntegerField(required=False, allow_null=True)
    target_store_id = serializers.IntegerField(required=False, allow_null=True)


class SafetyReportSerializer(serializers.ModelSerializer):
    reporter_name = serializers.SerializerMethodField()
    reported_name = serializers.SerializerMethodField()
    assigned_to_name = serializers.SerializerMethodField()
    action_history = serializers.SerializerMethodField()
    internal_notes = serializers.SerializerMethodField()

    class Meta:
        model = SafetyReport
        fields = [
            "id", "reporter_type", "reporter_name", "target_type", "reported_name",
            "reported_user", "reported_store", "category", "severity", "scope",
            "city", "city_name", "service_zone", "description", "status", "resolution_note",
            "prescription", "response", "assigned_to_id", "assigned_to_name",
            "action_history", "internal_notes",
            "created_at", "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def get_reporter_name(self, obj):
        if obj.reporter_user:
            return getattr(obj.reporter_user, "name", None) or obj.reporter_user.get_full_name() or obj.reporter_user.username
        if obj.reporter_store:
            return obj.reporter_store.name
        return "Unknown"

    def get_reported_name(self, obj):
        if obj.reported_user:
            return getattr(obj.reported_user, "name", None) or obj.reported_user.get_full_name() or obj.reported_user.username
        if obj.reported_store:
            return obj.reported_store.name
        return "Unknown"

    def get_assigned_to_name(self, obj):
        if not obj.assigned_to_id:
            return None
        staff = SupportStaff.objects.select_related("user").filter(id=obj.assigned_to_id).first()
        return (staff.user.get_full_name() or staff.user.username) if staff else "Former staff member"

    city_name = serializers.CharField(source="city.name", read_only=True, allow_null=True)

    def get_action_history(self, obj):
        actions = SafetyReportAction.objects.filter(report=obj).select_related("admin__user").order_by("-created_at")
        return SafetyReportActionSerializer(actions, many=True).data

    def get_internal_notes(self, obj):
        ct = ContentType.objects.get_for_model(SafetyReport)
        notes = InternalNote.objects.filter(content_type=ct, object_id=obj.id, is_deleted=False).select_related("created_by__user").order_by("-created_at")
        return InternalNoteSerializer(notes, many=True).data


class SupportAuditLogSerializer(serializers.ModelSerializer):
    actor_name = serializers.CharField(source="actor.user.name", read_only=True)

    class Meta:
        model = SupportAuditLog
        fields = ["id", "actor", "actor_name", "action", "entity_type", "entity_id", "old_data", "new_data", "ip_address", "user_agent", "created_at"]
        read_only_fields = ["id", "created_at"]


class SLAConfigurationSerializer(serializers.ModelSerializer):
    class Meta:
        model = SLAConfiguration
        fields = ["id", "entity_type", "priority", "first_response_minutes", "resolution_minutes", "is_active"]
        read_only_fields = ["id"]


class SupportNotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = SupportNotification
        fields = ["id", "recipient", "notification_type", "title", "message", "entity_type", "entity_id", "is_read", "created_at"]
        read_only_fields = ["id", "created_at"]


class UserOrderSerializer(serializers.ModelSerializer):
    store_name = serializers.CharField(source="store.name", read_only=True)
    prescription_id = serializers.IntegerField(source="prescription.id", read_only=True)

    class Meta:
        model = PrescriptionResponse
        fields = ["id", "prescription_id", "store_name", "total_amount", "user_status", "delivery_option", "created_at"]
        read_only_fields = ["id", "created_at"]


class UserPrescriptionSerializer(serializers.ModelSerializer):
    target_stores = serializers.SerializerMethodField()
    created_at = serializers.DateTimeField(source="uploaded_at", read_only=True)

    class Meta:
        model = Prescription
        fields = ["id", "medicine_name", "description", "created_at", "target_stores"]
        read_only_fields = ["id", "created_at"]

    def get_target_stores(self, obj):
        targets = obj.target_stores.select_related("store").all()
        return [{"id": t.store.id, "name": t.store.name} for t in targets]


class UserComplaintSerializer(serializers.ModelSerializer):
    against = serializers.SerializerMethodField()

    class Meta:
        model = Complaint
        fields = ["id", "category", "subject", "status", "priority", "created_at", "against"]
        read_only_fields = ["id", "created_at"]

    def get_against(self, obj):
        if obj.respondent_store:
            return {"type": "store", "id": obj.respondent_store.id, "name": obj.respondent_store.name}
        if obj.respondent_user:
            return {"type": "user", "id": obj.respondent_user.id, "name": obj.respondent_user.name}
        return None


class UserTicketSerializer(serializers.ModelSerializer):
    class Meta:
        model = PlatformSupportTicket
        fields = ["id", "category", "subject", "status", "priority", "created_at", "updated_at"]
        read_only_fields = ["id", "created_at", "updated_at"]


class UserRefundSerializer(serializers.ModelSerializer):
    class Meta:
        model = RefundRequest
        fields = ["id", "amount", "status", "reason", "created_at", "processed_at"]
        read_only_fields = ["id", "created_at"]


class UserSafetyReportSerializer(serializers.ModelSerializer):
    reason = serializers.CharField(source="description", read_only=True)
    reported_by = serializers.SerializerMethodField()
    reported_against = serializers.SerializerMethodField()

    class Meta:
        model = SafetyReport
        fields = ["id", "reason", "status", "created_at", "reported_by", "reported_against"]
        read_only_fields = ["id", "created_at"]

    def get_reported_by(self, obj):
        if obj.reporter_user:
            return {"type": "user", "id": obj.reporter_user.id, "name": obj.reporter_user.name}
        if obj.reporter_store:
            return {"type": "store", "id": obj.reporter_store.id, "name": obj.reporter_store.name}
        return None

    def get_reported_against(self, obj):
        if obj.reported_user:
            return {"type": "user", "id": obj.reported_user.id, "name": obj.reported_user.name}
        if obj.reported_store:
            return {"type": "store", "id": obj.reported_store.id, "name": obj.reported_store.name}
        return None


class UserProfileSerializer(serializers.ModelSerializer):
    orders = serializers.SerializerMethodField()
    prescriptions = serializers.SerializerMethodField()
    complaints = serializers.SerializerMethodField()
    tickets = serializers.SerializerMethodField()
    refunds = serializers.SerializerMethodField()
    safety_reports_filed = serializers.SerializerMethodField()
    safety_reports_against = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id", "name", "mobile", "email", "address", "pincode",
            "is_active", "is_verified", "is_deleted", "preferred_language",
            "orders", "prescriptions", "complaints", "tickets",
            "refunds", "safety_reports_filed", "safety_reports_against",
        ]
        read_only_fields = ["id"]

    def get_orders(self, obj):
        qs = PrescriptionResponse.objects.filter(user=obj).select_related("store", "prescription").order_by("-created_at")[:50]
        allowed = self.context.get("allowed_city_ids")
        if allowed is not None:
            qs = PrescriptionResponse.objects.filter(user=obj, prescription__city_id__in=allowed).select_related("store", "prescription").order_by("-created_at")[:50]
        return UserOrderSerializer(qs, many=True).data

    def get_prescriptions(self, obj):
        qs = Prescription.objects.filter(user=obj).prefetch_related("target_stores__store").order_by("-uploaded_at")
        allowed = self.context.get("allowed_city_ids")
        if allowed is not None:
            qs = qs.filter(city_id__in=allowed)
        return UserPrescriptionSerializer(qs[:50], many=True).data

    def get_complaints(self, obj):
        qs = Complaint.objects.filter(complainant_user=obj).select_related("respondent_user", "respondent_store").order_by("-created_at")
        allowed = self.context.get("allowed_city_ids")
        if allowed is not None:
            qs = qs.filter(Q(scope="GLOBAL") | Q(city_id__in=allowed))
        return UserComplaintSerializer(qs[:50], many=True).data

    def get_tickets(self, obj):
        qs = PlatformSupportTicket.objects.filter(requester_user=obj).order_by("-created_at")
        allowed = self.context.get("allowed_city_ids")
        if allowed is not None:
            qs = qs.filter(Q(scope="GLOBAL") | Q(city_id__in=allowed))
        return UserTicketSerializer(qs[:50], many=True).data

    def get_refunds(self, obj):
        qs = RefundRequest.objects.filter(prescription_response__user=obj).select_related("prescription_response").order_by("-created_at")
        allowed = self.context.get("allowed_city_ids")
        if allowed is not None:
            qs = qs.filter(prescription_response__prescription__city_id__in=allowed)
        return UserRefundSerializer(qs[:50], many=True).data

    def get_safety_reports_filed(self, obj):
        qs = SafetyReport.objects.filter(reporter_user=obj).order_by("-created_at")
        allowed = self.context.get("allowed_city_ids")
        if allowed is not None:
            qs = qs.filter(Q(scope="GLOBAL") | Q(city_id__in=allowed))
        return UserSafetyReportSerializer(qs[:50], many=True).data

    def get_safety_reports_against(self, obj):
        qs = SafetyReport.objects.filter(reported_user=obj).order_by("-created_at")
        allowed = self.context.get("allowed_city_ids")
        if allowed is not None:
            qs = qs.filter(Q(scope="GLOBAL") | Q(city_id__in=allowed))
        return UserSafetyReportSerializer(qs[:50], many=True).data


class StoreOrderSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source="user.name", read_only=True)
    prescription_id = serializers.IntegerField(source="prescription.id", read_only=True)

    class Meta:
        model = PrescriptionResponse
        fields = ["id", "prescription_id", "user_name", "total_amount", "user_status", "delivery_option", "created_at"]
        read_only_fields = ["id", "created_at"]


class StorePrescriptionSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source="user.name", read_only=True)

    class Meta:
        model = Prescription
        fields = ["id", "user_name", "medicine_name", "description", "created_at"]
        read_only_fields = ["id", "created_at"]


class StoreComplaintSerializer(serializers.ModelSerializer):
    by = serializers.SerializerMethodField()

    class Meta:
        model = Complaint
        fields = ["id", "category", "subject", "status", "priority", "created_at", "by"]
        read_only_fields = ["id", "created_at"]

    def get_by(self, obj):
        if obj.complainant_store:
            return {"type": "store", "id": obj.complainant_store.id, "name": obj.complainant_store.name}
        if obj.complainant_user:
            return {"type": "user", "id": obj.complainant_user.id, "name": obj.complainant_user.name}
        return None


class StoreSafetyReportSerializer(serializers.ModelSerializer):
    reason = serializers.CharField(source="description", read_only=True)
    reported_by = serializers.SerializerMethodField()
    reported_against = serializers.SerializerMethodField()

    class Meta:
        model = SafetyReport
        fields = ["id", "reason", "status", "created_at", "reported_by", "reported_against"]
        read_only_fields = ["id", "created_at"]

    def get_reported_by(self, obj):
        if obj.reporter_user:
            return {"type": "user", "id": obj.reporter_user.id, "name": obj.reporter_user.name}
        if obj.reporter_store:
            return {"type": "store", "id": obj.reporter_store.id, "name": obj.reporter_store.name}
        return None

    def get_reported_against(self, obj):
        if obj.reported_user:
            return {"type": "user", "id": obj.reported_user.id, "name": obj.reported_user.name}
        if obj.reported_store:
            return {"type": "store", "id": obj.reported_store.id, "name": obj.reported_store.name}
        return None


class StoreProfileSerializer(serializers.ModelSerializer):
    performance_metrics = serializers.SerializerMethodField()
    orders = serializers.SerializerMethodField()
    prescriptions_received = serializers.SerializerMethodField()
    quotes_submitted = serializers.SerializerMethodField()
    complaints = serializers.SerializerMethodField()
    safety_reports = serializers.SerializerMethodField()
    refunds = serializers.SerializerMethodField()

    class Meta:
        model = Store
        fields = [
            "id", "name", "owner_name", "mobile", "email", "address", "pincode",
            "is_active", "is_verified", "auto_accept_prescription",
            "average_rating", "total_ratings", "avg_response_time_mins",
            "completed_orders_count", "cancelled_orders_count",
            "quotes_sent_count", "orders_won_count",
            "performance_metrics", "orders", "prescriptions_received",
            "quotes_submitted", "complaints", "safety_reports", "refunds",
        ]
        read_only_fields = ["id"]

    def get_performance_metrics(self, obj):
        total_orders = PrescriptionResponse.objects.filter(store=obj).count()
        completed_orders = obj.completed_orders_count
        cancelled_orders = obj.cancelled_orders_count
        cancellation_rate = (cancelled_orders / total_orders * 100) if total_orders > 0 else 0
        prescription_acceptance_rate = 0
        quoted = PrescriptionResponse.objects.filter(store=obj, user_status="quoted").count()
        accepted = PrescriptionResponse.objects.filter(store=obj, user_status__in=["accepted", "processing", "locked", "out_for_delivery", "completed"]).count()
        if quoted > 0:
            prescription_acceptance_rate = (accepted / quoted * 100)
        complaint_count = Complaint.objects.filter(respondent_store=obj).count()
        refund_count = RefundRequest.objects.filter(prescription_response__store=obj).count()
        return {
            "total_orders": total_orders,
            "completed_orders": completed_orders,
            "cancellation_rate": round(cancellation_rate, 2),
            "average_response_time_mins": obj.avg_response_time_mins,
            "prescription_acceptance_rate": round(prescription_acceptance_rate, 2),
            "complaint_count": complaint_count,
            "refund_count": refund_count,
            "average_rating": float(obj.average_rating),
        }

    def get_orders(self, obj):
        qs = PrescriptionResponse.objects.filter(store=obj).select_related("user", "prescription").order_by("-created_at")[:50]
        return StoreOrderSerializer(qs, many=True).data

    def get_prescriptions_received(self, obj):
        qs = PrescriptionTargetStore.objects.filter(store=obj).select_related("prescription__user").order_by("-created_at")[:50]
        return [
            {
                "id": t.id,
                "prescription_id": t.prescription.id,
                "user_name": t.prescription.user.name if t.prescription.user else None,
                "created_at": t.created_at,
            }
            for t in qs
        ]

    def get_quotes_submitted(self, obj):
        qs = PrescriptionResponse.objects.filter(store=obj).select_related("user", "prescription").order_by("-created_at")[:50]
        return StoreOrderSerializer(qs, many=True).data

    def get_complaints(self, obj):
        qs = Complaint.objects.filter(respondent_store=obj).select_related("complainant_user", "complainant_store").order_by("-created_at")[:50]
        return StoreComplaintSerializer(qs, many=True).data

    def get_safety_reports(self, obj):
        qs = SafetyReport.objects.filter(reported_store=obj).order_by("-created_at")[:50]
        return StoreSafetyReportSerializer(qs, many=True).data

    def get_refunds(self, obj):
        qs = RefundRequest.objects.filter(prescription_response__store=obj).select_related("prescription_response").order_by("-created_at")[:50]
        return UserRefundSerializer(qs, many=True).data
