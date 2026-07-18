from rest_framework import serializers

from core.services.s3_service import get_file_url

from .models import (
    Complaint,
    ComplaintAttachment,
    ComplaintMessage,
    ComplaintStatusHistory,
)


class ComplaintAttachmentSerializer(serializers.ModelSerializer):
    url = serializers.SerializerMethodField()

    class Meta:
        model = ComplaintAttachment
        fields = ['id', 'url', 'created_at']

    def _abs_url(self, obj):
        request = self.context.get('request')
        return get_file_url(obj.file, request)

    def get_url(self, obj):
        return self._abs_url(obj)


class ComplaintMessageSerializer(serializers.ModelSerializer):
    sender_name = serializers.SerializerMethodField()
    attachment_url = serializers.SerializerMethodField()

    class Meta:
        model = ComplaintMessage
        fields = [
            'id', 'sender_type', 'sender_name', 'visibility', 'text', 'attachment_url',
            'is_read', 'created_at',
        ]

    def _abs_url(self, obj):
        request = self.context.get('request')
        return get_file_url(obj.attachment, request)

    def get_attachment_url(self, obj):
        return self._abs_url(obj)

    def get_sender_name(self, obj):
        if obj.sender_store:
            return obj.sender_store.name
        if obj.sender_user:
            return obj.sender_user.name
        if obj.sender_type == 'platform':
            return 'Platform'
        return 'Unknown'


class ComplaintStatusHistorySerializer(serializers.ModelSerializer):
    class Meta:
        model = ComplaintStatusHistory
        fields = ['id', 'from_status', 'to_status', 'changed_by', 'note', 'created_at']


class _BaseComplaintSerializer(serializers.ModelSerializer):
    category_display = serializers.SerializerMethodField()
    status_display = serializers.SerializerMethodField()
    priority_display = serializers.SerializerMethodField()
    complainant_name = serializers.SerializerMethodField()
    respondent_name = serializers.SerializerMethodField()
    city_name = serializers.CharField(source='city.name', read_only=True, allow_null=True)

    def get_category_display(self, obj):
        return obj.get_category_display()

    def get_status_display(self, obj):
        return obj.get_status_display()

    def get_priority_display(self, obj):
        return obj.get_priority_display()

    def get_complainant_name(self, obj):
        if obj.complainant_store:
            return obj.complainant_store.name
        if obj.complainant_user:
            return obj.complainant_user.name
        return 'Unknown'

    def get_respondent_name(self, obj):
        if obj.respondent_store:
            return obj.respondent_store.name
        if obj.respondent_user:
            return obj.respondent_user.name
        return 'Unknown'


class ComplaintListSerializer(_BaseComplaintSerializer):
    order_id = serializers.IntegerField(source='order.id', read_only=True, allow_null=True)
    unread_count = serializers.SerializerMethodField()
    message_count = serializers.SerializerMethodField()
    attachment_count = serializers.SerializerMethodField()

    class Meta:
        model = Complaint
        fields = [
            'id', 'category', 'category_display', 'subject', 'status', 'status_display',
            'priority', 'priority_display', 'complainant_type', 'complainant_name',
            'respondent_type', 'respondent_name', 'order_id', 'created_at', 'updated_at',
            'scope', 'city', 'city_name', 'service_zone',
            'unread_count', 'message_count', 'attachment_count',
        ]

    def get_unread_count(self, obj):
        viewer = self.context.get('viewer')
        if not viewer:
            return 0
        qs = self._visible_messages(obj, viewer).filter(is_read=False).exclude(sender_type=viewer)
        if viewer == 'user':
            qs = qs.exclude(sender_user__isnull=False)
        elif viewer == 'store':
            qs = qs.exclude(sender_store__isnull=False)
        return qs.count()

    def get_message_count(self, obj):
        viewer = self.context.get('viewer')
        return self._visible_messages(obj, viewer).count()

    def _visible_messages(self, obj, viewer):
        qs = obj.messages.all()
        if viewer == 'user':
            return qs.filter(visibility__in=[
                ComplaintMessage.VISIBILITY_USER_SUPPORT,
                ComplaintMessage.VISIBILITY_SHARED,
            ])
        if viewer == 'store':
            return qs.filter(visibility__in=[
                ComplaintMessage.VISIBILITY_STORE_SUPPORT,
                ComplaintMessage.VISIBILITY_SHARED,
            ])
        return qs

    def get_attachment_count(self, obj):
        return obj.attachments.count()


class ComplaintDetailSerializer(_BaseComplaintSerializer):
    order_id = serializers.IntegerField(source='order.id', read_only=True, allow_null=True)
    description = serializers.CharField(read_only=True)
    attachments = ComplaintAttachmentSerializer(many=True, read_only=True)
    messages = serializers.SerializerMethodField()
    status_history = ComplaintStatusHistorySerializer(many=True, read_only=True)
    can_withdraw = serializers.SerializerMethodField()

    class Meta:
        model = Complaint
        fields = [
            'id', 'category', 'category_display', 'subject', 'description', 'status',
            'status_display', 'priority', 'priority_display', 'complainant_type',
            'complainant_name', 'respondent_type', 'respondent_name', 'order_id',
            'scope', 'city', 'city_name', 'service_zone',
            'assigned_to', 'resolution_notes', 'resolved_at', 'created_at', 'updated_at',
            'attachments', 'messages', 'status_history', 'can_withdraw',
        ]

    def get_can_withdraw(self, obj):
        viewer = self.context.get('viewer')
        if viewer != obj.complainant_type:
            return False
        return obj.status in ('open', 'under_review', 'awaiting_info')

    def get_messages(self, obj):
        viewer = self.context.get('viewer')
        messages = obj.messages.select_related('sender_user', 'sender_store').all()
        if viewer == 'user':
            messages = messages.filter(visibility__in=[
                ComplaintMessage.VISIBILITY_USER_SUPPORT,
                ComplaintMessage.VISIBILITY_SHARED,
            ])
        elif viewer == 'store':
            messages = messages.filter(visibility__in=[
                ComplaintMessage.VISIBILITY_STORE_SUPPORT,
                ComplaintMessage.VISIBILITY_SHARED,
            ])
        return ComplaintMessageSerializer(messages, many=True, context=self.context).data


class ComplaintCreateSerializer(serializers.Serializer):
    respondent_type = serializers.ChoiceField(choices=['user', 'store'])
    respondent_id = serializers.IntegerField()
    category = serializers.ChoiceField(choices=Complaint.CATEGORY_CHOICES)
    subject = serializers.CharField(max_length=200)
    description = serializers.CharField()
    priority = serializers.ChoiceField(choices=Complaint.PRIORITY_CHOICES, required=False, default='medium')
    order_id = serializers.IntegerField(required=False, allow_null=True)

    def validate(self, data):
        request = self.context.get('request')
        actor_type = self.context.get('actor_type')
        actor = self.context.get('actor')

        # Prevent complaining against yourself
        if data['respondent_type'] == actor_type and data['respondent_id'] == actor.id:
            raise serializers.ValidationError("You cannot file a complaint against yourself.")

        # Validate respondent exists
        from prescription.models import Store, User
        if data['respondent_type'] == 'user':
            if not User.objects.filter(id=data['respondent_id'], is_deleted=False).exists():
                raise serializers.ValidationError("Target user not found.")
        else:
            if not Store.objects.filter(id=data['respondent_id'], is_deleted=False).exists():
                raise serializers.ValidationError("Target store not found.")

        # Validate order (if provided) belongs to the actor
        order_id = data.get("order_id")
        if order_id:
            from prescription.models import PrescriptionResponse
            order = PrescriptionResponse.objects.filter(id=order_id).first()
            if not order:
                raise serializers.ValidationError("Order not found.")
            if actor_type == "user" and order.user_id != actor.id:
                raise serializers.ValidationError("Order does not belong to you.")
            if actor_type == "store" and order.store_id != actor.id:
                raise serializers.ValidationError("Order does not belong to your store.")

        return data
