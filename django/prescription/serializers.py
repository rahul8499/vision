# from rest_framework import serializers
from datetime import timedelta
from django.utils import timezone
# from .models import Prescription

# class PrescriptionSerializer(serializers.ModelSerializer):
#     class Meta:
#         model = Prescription
#         fields = ['id', 'image', 'uploaded_at']

from rest_framework import serializers
from .models import (
    Prescription, Store, User, PrescriptionResponse, PrescriptionResponseMedicine,
    StoreReportNote, ReportNote, PrescriptionTargetStore, Rating, UserStoreRelationship,
    StoreDeliverySettings, StoreDeliveryPerson, QuoteDeliveryOffer, OrderReplacementRequest
)
from core.services.safe_get import safe_get
from core.services.capability_service import get_cached_capability_flags, get_store_lifecycle_status, get_user_lifecycle_status
from core.services.s3_service import get_file_url


class PrescriptionSerializer(serializers.ModelSerializer):
    id = serializers.SerializerMethodField()
    image = serializers.ImageField(required=False, allow_null=True)
    user_name = serializers.SerializerMethodField()
    user_id = serializers.SerializerMethodField()
    user_mobile = serializers.SerializerMethodField()
    user_contact_note = serializers.SerializerMethodField()
    user_report_note = serializers.SerializerMethodField()
    user_report_count = serializers.SerializerMethodField()
    store_contact_note = serializers.SerializerMethodField()
    store_report_count = serializers.SerializerMethodField()
    chat_thread_id = serializers.IntegerField(read_only=True, required=False)
    is_locked = serializers.SerializerMethodField()
    is_unresponsive = serializers.SerializerMethodField()
    last_refresh_requested_at = serializers.SerializerMethodField()
    stock_verified_at = serializers.SerializerMethodField()
    response_id = serializers.SerializerMethodField()
    user_rating = serializers.SerializerMethodField()
    store_rating = serializers.SerializerMethodField()
    is_processing_started = serializers.SerializerMethodField()
    is_packed = serializers.SerializerMethodField()
    cancelled_by = serializers.SerializerMethodField()
    cancel_reason = serializers.SerializerMethodField()




    # user_address = serializers.SerializerMethodField()
    store_latitude = serializers.SerializerMethodField()
    store_longitude = serializers.SerializerMethodField()
    store_address = serializers.SerializerMethodField()
    distance_km = serializers.SerializerMethodField()
    user_address = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    has_responded = serializers.SerializerMethodField()
    user_status = serializers.SerializerMethodField()  # 👈 Add this line
    delivery_option = serializers.SerializerMethodField()
    target_stores = serializers.SerializerMethodField()  # ✅ ADDED
    capabilities = serializers.SerializerMethodField()
    repeat_customer = serializers.SerializerMethodField()
    repeat_order_count = serializers.SerializerMethodField()
    last_order_at = serializers.SerializerMethodField()
    preferred_store_id = serializers.SerializerMethodField()


    class Meta:
        model = Prescription
        fields = [
            'id', 'image', 'uploaded_at', 'latitude', 'longitude',
            'user_name', 'user_id', 'user_address',
            'store_latitude', 'store_longitude', 'store_address','user_mobile',
            'distance_km','has_responded','status','user_status','user_contact_note','user_report_note','user_report_count','store_contact_note','store_report_count','target_stores',
            'chat_thread_id', 'delivery_option', 'response_id',
            'is_locked', 'is_unresponsive', 'last_refresh_requested_at', 'stock_verified_at',
            'is_processing_started', 'is_packed', 'user_rating', 'store_rating',
            'cancelled_by', 'cancel_reason', 'capabilities',
            'repeat_customer', 'repeat_order_count', 'last_order_at', 'preferred_store_id',
            'repeat_customer', 'repeat_order_count', 'last_order_at', 'preferred_store_id',
            'medicine_name', 'description', 'user_upload_type', 'ai_classification', 'ai_score', 'ai_status', 'ai_reason', 'ocr_text'
        ]

    def validate(self, attrs):
        image = attrs.get('image')
        medicine_name = attrs.get('medicine_name')
        # If this is an update, we might not have them in attrs but on the instance, but for creation attrs has them
        # if image is None and not medicine_name:
        verified_image_key = self.context.get('verified_image_key')
        if not image and not verified_image_key and not medicine_name and not self.instance:
            raise serializers.ValidationError({"error": "Either prescription image or medicine name must be provided."})
        return super().validate(attrs)

    def _relationship_for_request_store(self, obj):
        request = self.context.get('request')
        store = getattr(request, 'user', None) if request else None
        user_id = getattr(obj, 'user_id', None)
        if not store or not getattr(store, 'is_store', False) or not user_id:
            return None
        cached = getattr(obj, '_repeat_relationship', None)
        if cached is not None:
            return cached
        rel = UserStoreRelationship.objects.filter(user_id=user_id, store=store).first()
        obj._repeat_relationship = rel
        return rel

    def get_repeat_customer(self, obj):
        rel = self._relationship_for_request_store(obj)
        return bool(rel and rel.completed_order_count > 0)

    def get_repeat_order_count(self, obj):
        rel = self._relationship_for_request_store(obj)
        return rel.completed_order_count if rel else 0

    def get_last_order_at(self, obj):
        rel = self._relationship_for_request_store(obj)
        return rel.last_order_at.isoformat() if rel and rel.last_order_at else None

    def get_preferred_store_id(self, obj):
        return getattr(obj, 'preferred_store_id', None)

    def get_capabilities(self, obj):
        request = self.context.get('request')
        actor = request.user if request else None
        return get_cached_capability_flags(self.context, actor=actor, resource=obj, action="view")
        
    def _is_verified_store(self):
        request = self.context.get('request')
        if request and request.user and hasattr(request.user, 'is_verified'):
            return request.user.is_verified
        return True  # If it's a user, not a store

    def get_id(self, obj):
        if not self._is_verified_store():
            return (obj.id * 97) + 1337 # Consistent scramble for FlatList key
        return obj.id

    def get_image(self, obj):
        if not self._is_verified_store():
            return None
        request = self.context.get('request')
        return get_file_url(obj.image, request)

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data['image'] = self.get_image(instance)
        data['user_address'] = self.get_user_address(instance)

        # 🛡️ SECURITY: Redact sensitive info if order is completed
        if data.get('user_status') == 'completed':
            sensitive_fields = [
                'user_name', 'user_mobile', 'user_address',
                'latitude', 'longitude', 'distance_km', 'image',
                'store_address', 'store_latitude', 'store_longitude'
            ]
            for field in sensitive_fields:
                if field in data:
                    data[field] = None

        return data

    def get_user_mobile(self, obj):
        if not self._is_verified_store():
            return None
        return safe_get(obj, "user.mobile", None)

    def get_user_id(self, obj):
        return safe_get(obj, "user.id", None)

    def get_cancelled_by(self, obj):
        return getattr(obj, 'cancelled_by', None)
    
    def get_cancel_reason(self, obj):
        if not self._is_verified_store():
            return None
        return getattr(obj, 'cancel_reason', None)

    def get_user_contact_note(self, obj):
        if not self._is_verified_store():
            return None
        return getattr(obj, 'user_contact_note', None)

    def get_user_report_note(self, obj):
        if not self._is_verified_store():
            return None
        note = getattr(obj, 'prefetched_user_report_note', None)
        if note:
            return note

        response_id = getattr(obj, 'response_id', None)
        if response_id:
            latest_report = ReportNote.objects.filter(response_id=response_id).order_by('-created_at').first()
            if latest_report:
                return latest_report.note

        return getattr(obj, 'user_contact_note', None)

    def get_user_report_count(self, obj):
        count = getattr(obj, 'prefetched_user_report_count', None)
        if count is not None:
            return count

        response_id = getattr(obj, 'response_id', None)
        if response_id:
            return ReportNote.objects.filter(response_id=response_id).count()
        return 0
    
    def get_delivery_option(self, obj):
        return getattr(obj, 'delivery_option', None)
    # def get_store_contact_note(self, obj):
    #     return getattr(obj, 'user_contact_note', None)
    def get_store_contact_note(self, obj):
        note = getattr(obj, 'prefetched_store_report_note', None) or getattr(obj, 'store_contact_note', None)
        if note:
            return note

        response_id = getattr(obj, 'response_id', None)
        if response_id:
            latest_note = StoreReportNote.objects.filter(response_id=response_id).order_by('-created_at').first()
            return latest_note.note if latest_note else None

        latest_note = StoreReportNote.objects.filter(response__prescription=obj).order_by('-created_at').first()
        return latest_note.note if latest_note else None

    def get_store_report_count(self, obj):
        count = getattr(obj, 'prefetched_store_report_count', None)
        if count is not None:
            return count

        response_id = getattr(obj, 'response_id', None)
        if response_id:
            return StoreReportNote.objects.filter(response_id=response_id).count()
        return 0

    # def get_target_stores(self, obj):
    #     return [
    #         {"id": pts.store.id, "name": pts.store.name} 
    #         for pts in obj.target_stores.all()
    #     ]
    def get_target_stores(self, obj):
        return [
            {
                "store_id": safe_get(ts, "store.id", None),
                "store_name": safe_get(ts, "store.name", ""),
                "store_mobile": safe_get(ts, "store.mobile", ""),
                "store_address": safe_get(ts, "store.address", ""),
                "store_latitude": safe_get(ts, "store.latitude", None),
                "store_longitude": safe_get(ts, "store.longitude", None),
            }
            for ts in obj.target_stores.all()
        ]

    def get_user_name(self, obj):
        return safe_get(obj, "user.name", None)
        
    def get_user_status(self, obj):
        return getattr(obj, 'user_status', None)

    def get_user_address(self, obj):
        raw = getattr(obj, 'user_address', None) or safe_get(obj, "user.address", None) or ''
        if not self._is_verified_store():
            if not raw:
                return 'xxxx xxxx, xxxx'
            parts = [p.strip() for p in raw.split(',')]
            if len(parts) >= 2:
                first = parts[0]
                masked_first = first[:4] + 'xxxx' if len(first) > 4 else first
                return f"{masked_first}, xxxx xxxx, {'x' * len(parts[-1].strip())}"
            else:
                return raw[:4] + 'xxxx xxxx'
        return raw



    def get_store_latitude(self, obj):
        return getattr(obj, 'store_lat', None)

    def get_store_longitude(self, obj):
        return getattr(obj, 'store_lon', None)

    def get_store_address(self, obj):
        raw = getattr(obj, 'store_address', None) 
        
    def get_has_responded(self, obj):
        return getattr(obj, 'has_responded', False)

    def get_response_id(self, obj):
        return getattr(obj, 'response_id', None)

    def get_is_locked(self, obj):
        return getattr(obj, 'is_locked', None)

    def get_is_unresponsive(self, obj):
        return getattr(obj, 'is_unresponsive', None)

    def get_is_processing_started(self, obj):
        return getattr(obj, 'is_processing_started', None)

    def get_is_packed(self, obj):
        return getattr(obj, 'is_packed', None)

    def get_last_refresh_requested_at(self, obj):
        return getattr(obj, 'last_refresh_requested_at', None)

    def get_user_rating(self, obj):
        rid = getattr(obj, 'response_id', None)
        if not rid: return None
        rating = Rating.objects.filter(order_id=rid, given_by='user').first()
        return RatingSerializer(rating).data if rating else None

    def get_store_rating(self, obj):
        rid = getattr(obj, 'response_id', None)
        if not rid: return None
        rating = Rating.objects.filter(order_id=rid, given_by='store').first()
        return RatingSerializer(rating).data if rating else None

    def get_stock_verified_at(self, obj):
        return getattr(obj, 'stock_verified_at', None)

    def get_distance_km(self, obj):
        distance = getattr(obj, 'distance', None)
        if distance is None:
            return None
        
        # 📏 Handle both Distance objects (from PostGIS) and legacy floats
        from django.contrib.gis.measure import Distance as DistanceObj
        val_km = distance.km if isinstance(distance, DistanceObj) else float(distance)
        
        if not self._is_verified_store():
            if val_km < 1: return "< 1 km"
            elif val_km <= 3: return "1-3 km"
            elif val_km <= 5: return "3-5 km"
            elif val_km <= 10: return "5-10 km"
            else: return "10+ km"
            
        if val_km < 1:
            return f"{round(val_km * 1000)} meters"
        return f"{round(val_km, 2)} km"


class PrescriptionResponseMedicineSerializer(serializers.ModelSerializer):
    class Meta:
        model = PrescriptionResponseMedicine
        fields = ['medicine_name', 'price', 'is_available', 'medicine_brand', 'medicine_type']


class StoreDeliverySettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = StoreDeliverySettings
        exclude = ['store']

    def validate(self, attrs):
        instance = self.instance or StoreDeliverySettings(store=self.context['store'])
        for field, value in attrs.items():
            setattr(instance, field, value)
        try:
            instance.clean()
        except Exception as exc:
            detail = getattr(exc, 'message_dict', None) or {'non_field_errors': getattr(exc, 'messages', [str(exc)])}
            raise serializers.ValidationError(detail)
        return attrs


class StoreDeliveryPersonSerializer(serializers.ModelSerializer):
    class Meta:
        model = StoreDeliveryPerson
        fields = ['id', 'name', 'mobile', 'vehicle_type', 'vehicle_number', 'is_active', 'is_available', 'current_order_count', 'max_concurrent_orders', 'last_assigned_at', 'created_at', 'updated_at']
        read_only_fields = ['current_order_count', 'last_assigned_at', 'created_at', 'updated_at']

    def create(self, validated_data):
        return StoreDeliveryPerson.objects.create(store=self.context['store'], **validated_data)

    def validate(self, attrs):
        instance = self.instance or StoreDeliveryPerson(store=self.context['store'], **attrs)
        if self.instance:
            for field, value in attrs.items():
                setattr(instance, field, value)
        try:
            instance.clean()
        except Exception as exc:
            detail = getattr(exc, 'message_dict', None) or {'non_field_errors': getattr(exc, 'messages', [str(exc)])}
            raise serializers.ValidationError(detail)
        return attrs


class QuoteDeliveryOfferSerializer(serializers.ModelSerializer):
    assigned_delivery_person = serializers.SerializerMethodField()

    class Meta:
        model = QuoteDeliveryOffer
        fields = ['distance_km', 'pickup_available', 'home_delivery_available', 'eligibility_code', 'unavailable_reason', 'delivery_charge', 'estimated_delivery_minutes', 'delivery_message', 'assigned_delivery_person']

    def get_assigned_delivery_person(self, obj):
        if not obj.assigned_delivery_person_id:
            return None
        person = obj.assigned_delivery_person
        return {
            'id': person.id,
            'name': person.name,
            'vehicle_type': person.vehicle_type,
            'vehicle_number': person.vehicle_number,
        }


class PrescriptionResponseSerializer(serializers.ModelSerializer):
    image = serializers.SerializerMethodField()
    store_contact_note = serializers.SerializerMethodField()  # ✅ use this instead of CharField
    store_report_count = serializers.SerializerMethodField()
    user_report_note = serializers.SerializerMethodField()
    user_report_count = serializers.SerializerMethodField()
    chat_thread_id = serializers.IntegerField(read_only=True, required=False)
    prescription_medicine_name = serializers.SerializerMethodField()
    prescription_description = serializers.SerializerMethodField()
    prescription_upload_type = serializers.SerializerMethodField()
    prescription_ai_classification = serializers.SerializerMethodField()
    prescription_ai_score = serializers.SerializerMethodField()
    prescription_ai_status = serializers.SerializerMethodField()
    prescription_ai_reason = serializers.SerializerMethodField()
    prescription_is_emergency = serializers.SerializerMethodField()

    distance_km = serializers.SerializerMethodField()
    medicines = PrescriptionResponseMedicineSerializer(many=True, read_only=True)
    user_name = serializers.SerializerMethodField()
    user_address = serializers.SerializerMethodField()
    user_contact = serializers.SerializerMethodField()
    is_store_verified = serializers.SerializerMethodField()
    is_store_active = serializers.SerializerMethodField()
    is_ratable = serializers.BooleanField(read_only=True)
    user_rating = serializers.SerializerMethodField()
    store_rating = serializers.SerializerMethodField()
    smart_tags    = serializers.SerializerMethodField()
    store_badges   = serializers.SerializerMethodField()
    quality_score = serializers.SerializerMethodField()
    trust_signal   = serializers.SerializerMethodField()
    medicine_breakdown = serializers.SerializerMethodField()
    best_deal = serializers.SerializerMethodField()
    completion_otp = serializers.SerializerMethodField()
    completion_otp_requested = serializers.SerializerMethodField()
    completion_otp_expires_at = serializers.SerializerMethodField()
    capabilities = serializers.SerializerMethodField()
    can_order_again = serializers.SerializerMethodField()
    repeat_customer = serializers.SerializerMethodField()
    repeat_order_count = serializers.SerializerMethodField()
    last_order_at = serializers.SerializerMethodField()
    delivery_offer = QuoteDeliveryOfferSerializer(read_only=True)
    payable_amount = serializers.SerializerMethodField()
    can_request_replacement = serializers.SerializerMethodField()
    replacement_status = serializers.SerializerMethodField()
    replacement_id = serializers.SerializerMethodField()

    def _replacement_for_order(self, obj):
        try:
            return obj.replacement_request
        except OrderReplacementRequest.DoesNotExist:
            return None

    def get_can_request_replacement(self, obj):
        return bool(obj.user_status == 'completed' and obj.completed_at and timezone.now() <= obj.completed_at + timedelta(hours=48) and self._replacement_for_order(obj) is None)

    def get_replacement_status(self, obj):
        replacement = self._replacement_for_order(obj)
        return replacement.status if replacement else None

    def get_replacement_id(self, obj):
        replacement = self._replacement_for_order(obj)
        return replacement.id if replacement else None

    def get_image(self, obj):
        image = obj.image or getattr(obj.prescription, 'image', None)
        if not image:
            return None
        request = self.context.get('request')
        return get_file_url(image, request)

    class Meta:
        model = PrescriptionResponse
        fields = [
            'id', 'total_amount', 'prescription', 'prescription_medicine_name', 'prescription_description', 'prescription_upload_type', 'prescription_ai_classification', 'prescription_ai_score', 'prescription_ai_status', 'prescription_ai_reason', 'prescription_is_emergency', 'user', 'response_text', 'image',
            'store', 'store_name', 'store_contact', 'created_at', 'updated_at',
            'store_latitude', 'store_longitude', 'store_address', 'distance_km','user_name', 'user_address', 'user_contact',
            'medicines', 'is_store_verified', 'is_store_active',  'user_status', 'store_contact_note', 'store_report_count', 'user_report_note', 'user_report_count',
            'chat_thread_id', 'delivery_option', 'stock_verified_at', 'quotation_scenario',
            'is_locked', 'is_unresponsive', 'response_version', 'last_refresh_requested_at',
            'is_processing_started', 'is_packed',
            'is_ratable', 'user_rating', 'store_rating',
            'store_overall_rating', 'store_total_ratings',
            'cancelled_by', 'cancel_reason',
            'quality_score', 'smart_tags', 'store_badges', 'trust_signal',
            'medicine_breakdown', 'best_deal',
            'completion_otp', 'completion_otp_requested', 'completion_otp_expires_at',
            'completed_by_store', 'capabilities',
            'can_order_again', 'repeat_customer', 'repeat_order_count', 'last_order_at',
            'delivery_offer', 'payable_amount', 'completed_at',
            'can_request_replacement', 'replacement_status', 'replacement_id'
        ]

    def get_payable_amount(self, obj):
        try:
            offer = obj.delivery_offer
        except Exception:
            offer = None
        medicine_total = obj.total_amount or 0
        if offer and obj.delivery_option == 'online':
            return str(medicine_total + offer.delivery_charge)
        return str(medicine_total)

    def _relationship_for_response(self, obj):
        if not obj.user_id or not obj.store_id:
            return None
        cached = getattr(obj, '_repeat_relationship', None)
        if cached is not None:
            return cached
        rel = UserStoreRelationship.objects.filter(user_id=obj.user_id, store_id=obj.store_id).first()
        obj._repeat_relationship = rel
        return rel

    def get_can_order_again(self, obj):
        request = self.context.get('request')
        return bool(
            obj.user_status == 'completed'
            and request
            and getattr(request, 'user', None) == obj.user
        )

    def get_repeat_customer(self, obj):
        rel = self._relationship_for_response(obj)
        return bool(rel and rel.completed_order_count > 1)

    def get_repeat_order_count(self, obj):
        rel = self._relationship_for_response(obj)
        return rel.completed_order_count if rel else 0

    def get_last_order_at(self, obj):
        rel = self._relationship_for_response(obj)
        return rel.last_order_at.isoformat() if rel and rel.last_order_at else None

    store_overall_rating = serializers.SerializerMethodField()
    store_total_ratings = serializers.SerializerMethodField()

    def _active_delivery_otp(self, obj):
        try:
            otp = obj.delivery_otp
        except Exception:
            otp = None
        if otp and otp.is_active:
            return otp
        return None

    def _request_user_is_owner(self, obj):
        request = self.context.get('request')
        return bool(request and getattr(request, 'user', None) == obj.user)

    def _request_store_is_verified(self):
        request = self.context.get('request')
        request_user = getattr(request, 'user', None) if request else None
        if request_user and getattr(request_user, 'is_store', False):
            return bool(getattr(request_user, 'is_verified', False))
        return True

    def get_user_name(self, obj):
        if not self._request_store_is_verified():
            return "Patient"
        return safe_get(obj, "prescription.user.name", safe_get(obj, "user.name", None))

    def get_prescription_is_emergency(self, obj):
        return bool(obj.prescription_id and obj.prescription.status == 'emergency')

    def get_prescription_medicine_name(self, obj):
        return getattr(obj.prescription, 'medicine_name', None)

    def get_prescription_description(self, obj):
        return getattr(obj.prescription, 'description', None)

    def get_prescription_upload_type(self, obj):
        return getattr(obj.prescription, 'user_upload_type', None)
        
    def get_prescription_ai_classification(self, obj):
        return getattr(obj.prescription, 'ai_classification', None)
        
    def get_prescription_ai_score(self, obj):
        return getattr(obj.prescription, 'ai_score', None)
        
    def get_prescription_ai_status(self, obj):
        return getattr(obj.prescription, 'ai_status', None)
        
    def get_prescription_ai_reason(self, obj):
        return getattr(obj.prescription, 'ai_reason', None)

    def get_user_address(self, obj):
        if not self._request_store_is_verified():
            return "xxxx xxxx, xxxx"
        return safe_get(obj, "prescription.user_address", "")

    def get_user_contact(self, obj):
        if not self._request_store_is_verified():
            return None
        return safe_get(obj, "prescription.user.mobile", safe_get(obj, "user.mobile", None))

    def get_completion_otp(self, obj):
        otp = self._active_delivery_otp(obj)
        if otp and self._request_user_is_owner(obj):
            return otp.otp_code
        return None

    def get_completion_otp_requested(self, obj):
        return self._active_delivery_otp(obj) is not None

    def get_completion_otp_expires_at(self, obj):
        otp = self._active_delivery_otp(obj)
        return otp.expires_at.isoformat() if otp else None


    def validate(self, data):
        # 🛡️ Layer 2 Protection: Serializer Level Guard
        if self.instance and self.instance.is_locked:
            # Check if any "deal-breaking" fields are being changed
            # In a bulletproof system, once locked, we block all general updates via this serializer
            deal_breaking_fields = ['total_amount', 'medicines', 'response_text']
            for field in deal_breaking_fields:
                if field in data:
                    raise serializers.ValidationError(f"Cannot modify {field} on a LOCKED order.")
        return data

    def to_representation(self, instance):
        data = super().to_representation(instance)
        
        # SECURITY: unverified stores may see records, but not patient-sensitive details.
        if not self._request_store_is_verified():
            data['user_name'] = 'Patient'
            data['user_address'] = 'xxxx xxxx, xxxx'
            data['user_contact'] = None
            data['image'] = None

        # 🛡️ SECURITY: Redact sensitive info if order is completed
        if data.get('user_status') == 'completed':
            sensitive_fields = [
                'store_name', 'store_contact', 'store_address',
                'store_latitude', 'store_longitude', 'distance_km',
                'user_name', 'user_address', 'user_contact', 'image'
            ]
            for field in sensitive_fields:
                if field in data:
                    data[field] = None

        return data

    def get_capabilities(self, obj):
        request = self.context.get('request')
        actor = request.user if request else None
        # For store requests: use the live authenticated store (request.user) as the
        # store subject, not obj.store which is a stale select_related cached copy.
        if actor and getattr(actor, 'is_store', False):
            return get_cached_capability_flags(self.context, actor=actor, store=actor, action="view")
        return get_cached_capability_flags(self.context, actor=actor, resource=obj, action="view")

    def get_store_contact_note(self, obj):
        # 🚀 Production Optimization: Use prefetched note if available
        note = getattr(obj, 'prefetched_store_note', None)
        if note:
            return note
            
        try:
            note_obj = StoreReportNote.objects.filter(response=obj).last()
            if note_obj:
                return note_obj.note
            return None
        except Exception as e:
            return None

    def get_store_report_count(self, obj):
        count = getattr(obj, 'prefetched_store_report_count', None)
        if count is not None:
            return count

        try:
            return StoreReportNote.objects.filter(response=obj).count()
        except Exception:
            return 0

    def get_user_report_note(self, obj):
        note = getattr(obj, 'prefetched_user_report_note', None)
        if note:
            return note

        try:
            note_obj = ReportNote.objects.filter(response=obj).order_by('-created_at').first()
            if note_obj:
                return note_obj.note
            return getattr(obj, 'user_contact_note', None)
        except Exception:
            return getattr(obj, 'user_contact_note', None)

    def get_user_report_count(self, obj):
        count = getattr(obj, 'prefetched_user_report_count', None)
        if count is not None:
            return count

        try:
            return ReportNote.objects.filter(response=obj).count()
        except Exception:
            return 0
        #     def get_store_contact_notes(self, obj): //sgle note distil store pathvlele
        # notes = StoreReportNote.objects.filter(response=obj)
        # return StoreReportNoteSerializer(notes, many=True).data
    def get_distance_km(self, obj):
        distance_val = getattr(obj, 'distance_km', None)
        if distance_val is None:
            return None
        elif distance_val < 1:
            return f"{round(distance_val * 1000)} meters"
        else:
            return f"{round(distance_val, 2)} km"

    def get_is_store_verified(self, obj):
        return safe_get(obj, "store.is_verified", False)

    def get_is_store_active(self, obj):
        return safe_get(obj, "store.is_active", False)

    def get_user_rating(self, obj):
        rating = obj.ratings.filter(given_by='user').first()
        if rating:
            return RatingSerializer(rating).data
        return None

    def get_store_rating(self, obj):
        rating = obj.ratings.filter(given_by='store').first()
        if rating:
            return RatingSerializer(rating).data
        return None

    def get_store_overall_rating(self, obj):
        rating = safe_get(obj, "store.average_rating", 0.0)
        return round(float(rating), 1)

    def get_store_total_ratings(self, obj):
        store = safe_get(obj, "store")
        if not store: return 0
        return Rating.objects.filter(target_type='store', order__store=store).count()

    def get_quotation_scenario(self, obj):
        if not obj.quotation_scenario:
            return "NOT SPECIFIED"
        
        mapping = {
            'exact_brand': 'PRESCRIBED BRANDS',
            'all_generic': 'ALL GENERICS',
            'mixed': 'BRANDS + GENERICS',
            'substitutes': 'ALT. BRAND OPTIONS',
            'partial': 'SOME ITEMS AVAILABLE',
        }
        return mapping.get(obj.quotation_scenario, str(obj.quotation_scenario).upper().replace('_', ' '))

    def get_quality_score(self, obj):
        return getattr(obj, 'quality_score', 0.0)
        
    def get_trust_signal(self, obj):
        return safe_get(obj, "store.social_proof", None)

    def get_smart_tags(self, obj):
        return getattr(obj, 'smart_tags', [])

    def get_store_badges(self, obj):
        store = safe_get(obj, "store")
        if not store: return []
        from .utils.ranking import get_store_badges
        return get_store_badges(store)

    def get_medicine_breakdown(self, obj):
        medicines = obj.medicines.all()
        total = medicines.count()
        if total == 0:
            return None
        
        brand_count    = medicines.filter(medicine_type='brand', is_available=True).count()
        generic_count  = medicines.filter(medicine_type='generic', is_available=True).count()
        substitute_count = medicines.filter(medicine_type='substitute', is_available=True).count()
        unavailable    = medicines.filter(is_available=False).count()
        available      = total - unavailable

        return {
            "total": total,
            "available": available,
            "unavailable": unavailable,
            "brand": brand_count,
            "generic": generic_count,
            "substitute": substitute_count,
            "brand_pct": round((brand_count / total) * 100) if total else 0,
            "generic_pct": round((generic_count / total) * 100) if total else 0,
            "substitute_pct": round((substitute_count / total) * 100) if total else 0,
            "unavailable_pct": round((unavailable / total) * 100) if total else 0,
            "unavailable_names": list(
                medicines.filter(is_available=False).values_list('medicine_name', flat=True)
            )
        }

    def get_best_deal(self, obj):
        inactive_statuses = ['cancelled', 'rejected', 'dismissed', 'expired']

        if obj.total_amount is None or obj.user_status in inactive_statuses:
            return None
        
        # Get competing active quotes for the EXACT SAME prescription
        competing_quotes = PrescriptionResponse.objects.filter(
            prescription=obj.prescription,
            total_amount__isnull=False
        ).exclude(
            user_status__in=inactive_statuses
        ).values_list('total_amount', flat=True)

        if len(competing_quotes) < 2:
            return None
            
        sorted_quotes = sorted([float(q) for q in competing_quotes])
        lowest = sorted_quotes[0]
        second_lowest = sorted_quotes[1]
        
        if float(obj.total_amount) == lowest:
            return {
                'is_best': True,
                'savings': int(round(second_lowest - lowest))
            }
        return None


class RatingSerializer(serializers.ModelSerializer):
    class Meta:
        model = Rating
        fields = ['id', 'order', 'given_by', 'target_type', 'rating', 'review', 'tags', 'is_edited', 'created_at', 'updated_at']
        read_only_fields = ['is_edited', 'created_at', 'updated_at']

    def validate(self, data):
        # Only validate on create
        if not self.instance:
            order = data.get('order')
            given_by = data.get('given_by')
            
            # Check if order is ratable
            if not order.is_ratable:
                raise serializers.ValidationError("Order is not eligible for rating (must be completed/cancelled and within 48h).")
            
            # Check if already rated by this side
            if Rating.objects.filter(order=order, given_by=given_by).exists():
                raise serializers.ValidationError("You have already rated this order.")
        
        return data



class StoreSerializer(serializers.ModelSerializer):
    class Meta:
        model = Store
        # fields = ['id', 'name', 'owner_name', 'mobile', 'email', 'address', 'pincode']
        fields = [
            'id', 'name', 'owner_name', 'mobile', 'email', 'address', 'pincode',
            'gst_number', 'drug_license_number', 'store_license_document',
            'owner_id_proof', 'store_image', 'is_verified', 'is_active', 'latitude', 'longitude'
        ]

class StoreLoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField()


# class UserSerializer(serializers.ModelSerializer):
#     class Meta:
#         model = User
#         fields = ['id', 'name', 'mobile', 'email', 'address', 'pincode']
class UserSerializer(serializers.ModelSerializer):
    profile_completion_percent = serializers.SerializerMethodField()
    lifecycle_status = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'id',
            'name',
            'mobile',
            'email',
            'address',
            'pincode',
            'is_active',
            'is_verified',
            'is_deleted',
            'lifecycle_status',
            'profile_completion_percent',  # ✅ Add this line
            'preferred_language',
        ]

    def get_lifecycle_status(self, obj):
        return get_user_lifecycle_status(obj).value

    def get_profile_completion_percent(self, obj):
        total_fields = 4  # Fields we want to consider
        filled = 0

        if obj.name: filled += 1
        if obj.mobile: filled += 1
        if obj.email: filled += 1
        if obj.address: filled += 1

        return int((filled / total_fields) * 100)

class UserLoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField()



class StoreMeSerializer(serializers.ModelSerializer):
    store_license_document = serializers.SerializerMethodField()
    owner_id_proof         = serializers.SerializerMethodField()
    store_image            = serializers.SerializerMethodField()
    store_document         = serializers.SerializerMethodField()
    profile_completion_percent = serializers.SerializerMethodField()
    badges = serializers.SerializerMethodField()
    fulfillment_rate = serializers.SerializerMethodField()
    win_rate = serializers.SerializerMethodField()
    avg_delivery_time = serializers.IntegerField(source='avg_delivery_time_mins', read_only=True)
    badge_progress = serializers.SerializerMethodField()
    lifecycle_status = serializers.SerializerMethodField()

    class Meta:
        model  = Store
        fields = [
            "id",
            "name",
            "owner_name",
            "mobile",
            "email",
            "address",
            "pincode",
            "gst_number",
            "drug_license_number",
            "store_license_document",
            "owner_id_proof",
            "store_image",
            "store_document",
            "is_verified",
            "is_active",
            "is_deleted",
            "lifecycle_status",
            "profile_completion_percent",
            "quality_score",
            "badges",
            "fulfillment_rate",
            "win_rate",
            "avg_delivery_time",
            "badge_progress",
            "auto_accept_prescription",
            "preferred_language",
        ]

    def get_lifecycle_status(self, obj):
        return get_store_lifecycle_status(obj).value

    def _abs_url(self, obj, field_name):
        file_field = getattr(obj, field_name)
        request    = self.context.get("request")
        return get_file_url(file_field, request)

    def get_store_license_document(self, obj):
        return self._abs_url(obj, "store_license_document")

    def get_owner_id_proof(self, obj):
        return self._abs_url(obj, "owner_id_proof")

    def get_store_image(self, obj):
        return self._abs_url(obj, "store_image")

    def get_store_document(self, obj):
        return self._abs_url(obj, "document")

    def get_profile_completion_percent(self, obj):
        # ✅ Required fields
        fields_to_check = [
            obj.name,
            obj.owner_name,
            obj.mobile,
            obj.email,
            obj.address,
            obj.pincode,
            obj.gst_number if obj.gst_number and obj.gst_number != 'NA' else None,
            obj.drug_license_number if obj.drug_license_number and obj.drug_license_number != 'UNKNOWN' else None,
            obj.store_license_document.name if obj.store_license_document else None,
            obj.owner_id_proof.name if obj.owner_id_proof else None,
            obj.store_image.name if obj.store_image else None,  # ✅ included
        ]

        filled = len([f for f in fields_to_check if f])
        total_required = len(fields_to_check)

        percent = int((filled / total_required) * 100)
        return percent

    def get_badges(self, obj):
        from .utils.ranking import get_store_badges
        return get_store_badges(obj)

    def get_fulfillment_rate(self, obj):
        return obj.fulfillment_rate
        
    def get_win_rate(self, obj):
        return obj.get_win_rate()
        
    def get_badge_progress(self, obj):
        progress = []
        # Reliable Badge Progress
        progress.append({
            "name": "Reliable",
            "current": obj.fulfillment_rate,
            "target": 90,
            "unit": "%"
        })
        # Top Seller Progress
        progress.append({
            "name": "Top Seller",
            "current": obj.repeat_order_count,
            "target": 10,
            "unit": "repeats"
        })
        return progress



# ✅ PATCH में इस्तेमाल करें
class StoreMeUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Store
        fields = [
            "name", "owner_name", "mobile", "email", "address", "pincode",
            "gst_number", "drug_license_number",
            "store_license_document", "owner_id_proof", "store_image", "document",
            "auto_accept_prescription"
        ]

from .models import ChatThread, ChatMessage

class ChatMessageSerializer(serializers.ModelSerializer):
    reply_to_text = serializers.SerializerMethodField()
    
    class Meta:
        model = ChatMessage
        fields = [
            'id', 'sender_type', 'text', 'audio', 'image', 'video', 'is_read', 'created_at',
            'is_edited', 'is_deleted_for_everyone', 'deleted_by_user', 'deleted_by_store',
            'reply_to', 'reply_to_text'
        ]

    def get_reply_to_text(self, obj):
        if obj.reply_to:
            return obj.reply_to.text[:50] + "..." if obj.reply_to.text and len(obj.reply_to.text) > 50 else obj.reply_to.text
        return None

class ChatThreadSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source='user.name', read_only=True)
    store_name = serializers.CharField(source='store.name', read_only=True)
    latest_message = serializers.SerializerMethodField()
    unread_count = serializers.SerializerMethodField()
    prescription_id = serializers.IntegerField(source='prescription.id', read_only=True)
    prescription_image = serializers.SerializerMethodField()
    
    # Other participant status
    other_online = serializers.SerializerMethodField()
    other_last_seen = serializers.SerializerMethodField()

    order_status = serializers.SerializerMethodField()
    is_chat_locked = serializers.SerializerMethodField()

    class Meta:
        model = ChatThread
        fields = [
            'id', 'user_id', 'user_name', 'store_id', 'store_name', 
            'prescription_id', 'prescription_image', 'updated_at', 'latest_message',
            'unread_count', 'other_online', 'other_last_seen',
            'order_status', 'is_chat_locked'
        ]

    def get_order_status(self, obj):
        if not obj.prescription_id:
            return None

        if 'order_status_value' in getattr(obj, '__dict__', {}):
            return obj.order_status_value

        response = (
            obj.prescription.responses
            .filter(store=obj.store, user=obj.user)
            .exclude(user_status__in=['rejected', 'dismissed', 'expired'])
            .order_by('-created_at')
            .first()
        )
        return response.user_status if response else None

    def get_is_chat_locked(self, obj):
        status = self.get_order_status(obj)
        return status in ['completed', 'cancelled', 'dismissed', 'expired', 'rejected']

    def get_latest_message(self, obj):
        # 🚀 Production Optimization: Use prefetched message if available
        latest = getattr(obj, 'prefetched_latest_message', None)
        if not latest:
            latest = obj.messages.order_by('-created_at').first()
            
        if latest:
            return ChatMessageSerializer(latest).data
        return None

    def get_unread_count(self, obj):
        return getattr(obj, 'unread_count', 0) or 0

    def get_prescription_image(self, obj):
        request = self.context.get('request')
        return get_file_url(getattr(obj, 'prescription', None) and obj.prescription.image, request)

    def _get_other_participant(self, obj):
        request = self.context.get('request')
        if not request: return None
        user = request.user
        # Stores have owner_name, Users do not.
        if hasattr(user, 'owner_name'):
            # I am the store, the "other" is the user
            return obj.user
        else:
            # I am the user, the "other" is the store
            return obj.store

    def get_other_online(self, obj):
        other = self._get_other_participant(obj)
        return other.is_online if other else False

    def get_other_last_seen(self, obj):
        other = self._get_other_participant(obj)
        return other.last_seen.isoformat() if other else None


class OrderReplacementRequestSerializer(serializers.ModelSerializer):
    proof_image_url = serializers.SerializerMethodField()
    store_name = serializers.CharField(source='store.name', read_only=True)
    store_contact = serializers.CharField(source='store.mobile', read_only=True)
    user_name = serializers.CharField(source='user.name', read_only=True)
    user_mobile = serializers.CharField(source='user.mobile', read_only=True)
    reason_display = serializers.CharField(source='get_reason_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    delivery_option = serializers.CharField(source='order.delivery_option', read_only=True)
    delivery_person = serializers.SerializerMethodField()
    original_order = serializers.SerializerMethodField()

    class Meta:
        model = OrderReplacementRequest
        fields = [
            'id', 'order', 'user', 'store', 'reason', 'description',
            'proof_image_url', 'status', 'store_note', 'is_walk_in',
            'created_at', 'updated_at', 'store_name', 'store_contact',
            'user_name', 'user_mobile', 'reason_display', 'status_display',
            'delivery_option', 'approved_at', 'rejected_at', 'in_transit_at',
            'completed_at', 'cancelled_at', 'delivery_person',
            'estimated_delivery_minutes', 'estimated_arrival_at', 'original_order'
        ]
        read_only_fields = ['id', 'user', 'store', 'status', 'store_note', 'is_walk_in', 'created_at', 'updated_at']

    def get_proof_image_url(self, obj):
        request = self.context.get('request')
        return get_file_url(obj.proof_image, request) if obj.proof_image else None

    def get_delivery_person(self, obj):
        person = obj.assigned_delivery_person
        if not person:
            return None
        request = self.context.get('request')
        actor = getattr(request, 'user', None) if request else None
        is_store_view = bool(actor and getattr(actor, 'is_store', False))
        contact_visible = bool(
            is_store_view
            or obj.status != 'completed'
            or not obj.completed_at
            or timezone.now() <= obj.completed_at + timedelta(hours=2)
        )
        data = {'id': person.id, 'name': person.name, 'contact_visible': contact_visible}
        if contact_visible:
            data.update({
                'mobile': person.mobile,
                'vehicle_type': person.get_vehicle_type_display(),
                'vehicle_number': person.vehicle_number,
            })
        return data

    def get_original_order(self, obj):
        order = obj.order
        prescription = order.prescription
        request = self.context.get('request')
        image = order.image or (prescription.image if prescription else None)
        try:
            offer_distance = order.delivery_offer.distance_km
        except QuoteDeliveryOffer.DoesNotExist:
            offer_distance = None
        distance = offer_distance if offer_distance is not None else order.distance_km
        medicines = [{
            'name': medicine.medicine_name,
            'brand': medicine.medicine_brand,
            'type': medicine.get_medicine_type_display(),
            'price': str(medicine.price) if medicine.price is not None else None,
            'is_available': medicine.is_available,
        } for medicine in order.medicines.all()]
        timeline = [{
            'from_status': entry.from_status, 'to_status': entry.to_status,
            'reason': entry.reason, 'changed_by': entry.changed_by_name,
            'created_at': entry.created_at.isoformat(),
        } for entry in reversed(list(order.status_history.all()))]
        return {
            'id': order.id, 'status': order.user_status,
            'delivery_option': order.delivery_option,
            'distance_km': str(distance) if distance is not None else None,
            'customer_address': (prescription.user_address if prescription and prescription.user_address else order.user.address),
            'prescription_image_url': get_file_url(image, request) if image else None,
            'prescription_medicine_name': getattr(prescription, 'medicine_name', None),
            'prescription_description': getattr(prescription, 'description', None),
            'response_text': order.response_text,
            'total_amount': str(order.total_amount) if order.total_amount is not None else None,
            'created_at': order.created_at.isoformat() if order.created_at else None,
            'completed_at': order.completed_at.isoformat() if order.completed_at else None,
            'medicines': medicines, 'timeline': timeline,
        }
