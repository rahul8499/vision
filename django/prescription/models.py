# from django.db import models

# class Prescription(models.Model):
#     image = models.ImageField(upload_to='prescriptions/')
#     uploaded_at = models.DateTimeField(auto_now_add=True)

#     def __str__(self):
#         return f"Prescription {self.id}"
    # null=True,
    #     blank=True
from django.contrib.gis.db import models
from django.contrib.gis.geos import Point
from django.contrib.auth.hashers import make_password, check_password
import uuid
import geohash
from datetime import timedelta
from decimal import Decimal
from django.utils import timezone
from django.core.exceptions import ValidationError

from rest_framework.authtoken.models import Token

from django.contrib.auth.hashers import make_password, check_password
# from .models import User  # Import your custom User model


class Store(models.Model):
    name = models.CharField(max_length=100)
    owner_name = models.CharField(max_length=100)
    mobile = models.CharField(max_length=15, unique=True)
    email = models.EmailField(unique=True)
    password = models.CharField(max_length=255)

    address = models.TextField()
    pincode = models.CharField(max_length=10)


    store_license_document = models.FileField(upload_to="documents/licenses/", null=True, blank=True)
    owner_id_proof = models.FileField(upload_to="documents/id_proof/", null=True, blank=True)
    # store_image = models.ImageField(upload_to="documents/store_images/", null=True, blank=True)

    # # ✅ Token for auth
    token = models.CharField(max_length=255, blank=True, null=True, unique=True)
    expo_push_token = models.CharField(max_length=255, blank=True, null=True)  # 👈 Add this


    # # ✅ Trust & status flags
    # is_verified = models.BooleanField(default=False)  # Admin will mark this True after verifying documents
    is_active = models.BooleanField(default=True)

    # created_at = models.DateTimeField(auto_now_add=True)
    created_at = models.DateTimeField(default=timezone.now)
    drug_license_number = models.CharField(max_length=100, blank=True, null=True)
    gst_number = models.CharField(max_length=100, blank=True, null=True)
    store_image = models.ImageField(upload_to='store_images/', blank=True, null=True)
    document = models.FileField(upload_to='store_documents/', blank=True, null=True)
    is_verified = models.BooleanField(default=False)
    pharmacist_name = models.CharField(max_length=120, blank=True)
    pharmacist_license_number = models.CharField(max_length=100, blank=True)
    is_pharmacist_verified = models.BooleanField(default=False, db_index=True)
    pharmacist_available = models.BooleanField(default=False, db_index=True)
    pharmacist_verified_at = models.DateTimeField(null=True, blank=True)
    is_deleted = models.BooleanField(default=False)
    auto_accept_prescription = models.BooleanField(default=False)  # 👈 Added for emergency mode
    latitude = models.FloatField(null=True, blank=True)  # ⭐ Keep for migration
    longitude = models.FloatField(null=True, blank=True) # ⭐ Keep for migration
    location = models.PointField(null=True, blank=True, srid=4326, geography=True, db_index=True) # 🌍 Real-world Geography
    geohash = models.CharField(max_length=12, db_index=True, blank=True, null=True) # 🔑 For O(log N) spatial scaling
    is_online = models.BooleanField(default=False)
    last_seen = models.DateTimeField(default=timezone.now)
    preferred_language = models.CharField(max_length=2, choices=[('en', 'English'), ('hi', 'Hindi'), ('mr', 'Marathi')], default='en', db_index=True)
    city = models.ForeignKey('emergency_services.City', on_delete=models.SET_NULL, null=True, blank=True, related_name='stores')
    service_zone = models.ForeignKey('emergency_services.ServiceZone', on_delete=models.SET_NULL, null=True, blank=True, related_name='stores')

    # 📊 Store Performance Tracking (For Elite Ranking)
    average_rating = models.DecimalField(max_digits=3, decimal_places=2, default=0.0)
    total_ratings = models.IntegerField(default=0)
    avg_response_time_mins = models.IntegerField(default=30) # How fast they quote
    avg_delivery_time_mins = models.IntegerField(default=60) # How fast they deliver
    
    # 🏅 New Performance Metrics
    repeat_order_count = models.IntegerField(default=0)
    completed_orders_count = models.IntegerField(default=0)
    cancelled_orders_count = models.IntegerField(default=0)
    
    # 📈 Conversion Metrics
    quotes_sent_count = models.IntegerField(default=0)
    orders_won_count = models.IntegerField(default=0)
    exposure_count = models.IntegerField(default=0) # How many times shown to users
    
    # 💰 Commercial Stability
    total_completed_value = models.DecimalField(max_digits=12, decimal_places=2, default=0.0)
    
    quality_score = models.DecimalField(max_digits=5, decimal_places=2, default=0.0)

    @property
    def fulfillment_rate(self):
        total = self.completed_orders_count + self.cancelled_orders_count
        if total == 0: return 100.0
        return round((self.completed_orders_count / total) * 100, 2)

    def get_win_rate(self):
        if self.quotes_sent_count == 0: return 0.0
        return round((self.orders_won_count / self.quotes_sent_count) * 100, 2)

    @property
    def social_proof(self):
        count = self.completed_orders_count
        # Consistent 1-decimal rating
        formatted_rating = round(float(self.average_rating), 1)
        rating_part = f" • {formatted_rating}★ rating" if self.total_ratings >= 5 else ""
        
        if count < 5: return f"New growing pharmacy{rating_part}"
        # Round to nearest 10 or 50 for elite feel
        if count < 50: rounded = (count // 10) * 10
        else: rounded = (count // 50) * 50
        return f"{rounded}+ orders delivered{rating_part}"

    @property
    def is_user(self):
        return False

    @property
    def is_store(self):
        return True

    @property
    def is_authenticated(self):
        return True

    def save(self, *args, **kwargs):
        if self.is_pharmacist_verified:
            if not self.pharmacist_name or not self.pharmacist_license_number:
                raise ValidationError('Pharmacist name and registration number are required for verification.')
            self.pharmacist_verified_at = self.pharmacist_verified_at or timezone.now()
        else:
            self.pharmacist_available = False
            self.pharmacist_verified_at = None
        if self.latitude and self.longitude:
            self.location = Point(float(self.longitude), float(self.latitude), srid=4326)
            self.geohash = geohash.encode(float(self.latitude), float(self.longitude), precision=12)
            from emergency_services.models import City
            if not self.city_id or City.objects.filter(id=self.city_id, is_default=True).exists():
                from emergency_services.services import resolve_city_zone
                self.city, self.service_zone = resolve_city_zone(self.location)
        if not self.pk:
            self.password = make_password(self.password)
        super().save(*args, **kwargs)

    def check_password(self, raw_password):
        return check_password(raw_password, self.password)

    def __str__(self):
        return self.name


class StoreDeliverySettings(models.Model):
    store = models.OneToOneField(Store, on_delete=models.CASCADE, related_name='delivery_settings')
    pickup_enabled = models.BooleanField(default=True)
    home_delivery_enabled = models.BooleanField(default=False)
    maximum_delivery_radius_km = models.DecimalField(max_digits=6, decimal_places=2, default=Decimal('5.00'))
    free_delivery_distance_km = models.DecimalField(max_digits=6, decimal_places=2, default=Decimal('0.00'))
    base_delivery_charge = models.DecimalField(max_digits=8, decimal_places=2, default=Decimal('0.00'))
    per_km_charge = models.DecimalField(max_digits=8, decimal_places=2, default=Decimal('0.00'))
    minimum_delivery_charge = models.DecimalField(max_digits=8, decimal_places=2, default=Decimal('0.00'))
    maximum_delivery_charge = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)
    default_estimated_delivery_minutes = models.PositiveIntegerField(default=45)
    delivery_time_per_km_minutes = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('0.00'))
    delivery_message_template = models.CharField(max_length=240, default='We can deliver to your location in approximately {eta} minutes.')
    delivery_unavailable_message = models.CharField(max_length=240, default='Home delivery is currently unavailable. You can pick up your order from the store.')
    is_active = models.BooleanField(default=True)
    updated_at = models.DateTimeField(auto_now=True)

    def clean(self):
        errors = {}
        for field in ('maximum_delivery_radius_km', 'free_delivery_distance_km', 'base_delivery_charge', 'per_km_charge', 'minimum_delivery_charge', 'delivery_time_per_km_minutes'):
            if getattr(self, field) is not None and getattr(self, field) < 0:
                errors[field] = 'Value cannot be negative.'
        if self.maximum_delivery_charge is not None and self.maximum_delivery_charge < 0:
            errors['maximum_delivery_charge'] = 'Value cannot be negative.'
        if self.home_delivery_enabled and self.maximum_delivery_radius_km <= 0:
            errors['maximum_delivery_radius_km'] = 'A positive radius is required for home delivery.'
        if self.free_delivery_distance_km > self.maximum_delivery_radius_km:
            errors['free_delivery_distance_km'] = 'Free distance cannot exceed maximum radius.'
        if self.maximum_delivery_charge is not None and self.maximum_delivery_charge < self.minimum_delivery_charge:
            errors['maximum_delivery_charge'] = 'Maximum charge cannot be lower than minimum charge.'
        if not 5 <= self.default_estimated_delivery_minutes <= 240:
            errors['default_estimated_delivery_minutes'] = 'Estimated time must be between 5 and 240 minutes.'
        if not self.pickup_enabled and not self.home_delivery_enabled:
            errors['pickup_enabled'] = 'At least one fulfillment method must remain enabled.'
        if self.home_delivery_enabled and not self.store.location:
            errors['home_delivery_enabled'] = 'Add the store location before enabling home delivery.'
        if errors:
            raise ValidationError(errors)

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)


class StoreDeliveryPerson(models.Model):
    VEHICLE_CHOICES = [('walk', 'On Foot'), ('bicycle', 'Bicycle'), ('bike', 'Motorbike'), ('scooter', 'Scooter'), ('car', 'Car'), ('other', 'Other')]
    store = models.ForeignKey(Store, on_delete=models.CASCADE, related_name='delivery_people')
    name = models.CharField(max_length=120)
    mobile = models.CharField(max_length=15)
    vehicle_type = models.CharField(max_length=20, choices=VEHICLE_CHOICES, default='bike')
    vehicle_number = models.CharField(max_length=30, blank=True)
    is_active = models.BooleanField(default=True, db_index=True)
    is_available = models.BooleanField(default=True, db_index=True)
    current_order_count = models.PositiveIntegerField(default=0)
    max_concurrent_orders = models.PositiveIntegerField(default=1)
    last_assigned_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-is_available', 'current_order_count', 'name']
        constraints = [models.UniqueConstraint(fields=['store', 'mobile'], name='unique_delivery_person_mobile_per_store')]

    def clean(self):
        errors = {}
        if not self.name.strip():
            errors['name'] = 'Name is required.'
        if len(''.join(character for character in self.mobile if character.isdigit())) < 10:
            errors['mobile'] = 'Enter a valid mobile number.'
        if self.max_concurrent_orders < 1:
            errors['max_concurrent_orders'] = 'Must be at least 1.'
        if errors:
            raise ValidationError(errors)

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)


# class Prescription(models.Model):
#     user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='prescriptions', null=True, blank=True)

#     image = models.ImageField(upload_to='prescriptions/')
#     uploaded_at = models.DateTimeField(auto_now_add=True)
#     latitude = models.FloatField(null=True, blank=True)
#     longitude = models.FloatField(null=True, blank=True)
#     # store = models.ForeignKey(Store, on_delete=models.CASCADE, related_name='prescriptions' , null=True, blank=True)
#     def __str__(self):
#         return f"Prescription {self.id}"
class User(models.Model):
    name = models.CharField(max_length=100)
    mobile = models.CharField(max_length=15, unique=True)
    email = models.EmailField(unique=True)
    password = models.CharField(max_length=255)
    address = models.TextField()
    pincode = models.CharField(max_length=10)
    token = models.CharField(max_length=255, blank=True, null=True, unique=True)
    expo_push_token = models.CharField(max_length=255, blank=True, null=True)
    is_active = models.BooleanField(default=True)
    is_verified = models.BooleanField(default=True)
    is_deleted = models.BooleanField(default=False)
    is_online = models.BooleanField(default=False)
    last_seen = models.DateTimeField(default=timezone.now)
    preferred_language = models.CharField(max_length=2, choices=[('en', 'English'), ('hi', 'Hindi'), ('mr', 'Marathi')], default='en', db_index=True)

    @property
    def is_user(self):
        return True

    @property
    def is_store(self):
        return False

    @property
    def is_authenticated(self):
        return True

    def save(self, *args, **kwargs):
        if not self.pk:
            self.password = make_password(self.password)
        super().save(*args, **kwargs)

    def check_password(self, raw_password):
        return check_password(raw_password, self.password)

    def __str__(self):
        return self.name

class Prescription(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='prescriptions', null=True, blank=True)
    image = models.ImageField(upload_to='prescriptions/', null=True, blank=True)
    medicine_name = models.CharField(max_length=255, null=True, blank=True)
    description = models.TextField(null=True, blank=True)

    UPLOAD_TYPE_CHOICES = [
        ('prescription', 'Prescription Image'),
        ('medicine', 'Medicine Box Photo'),
        ('text_only', 'Text Only'),
    ]
    user_upload_type = models.CharField(max_length=20, choices=UPLOAD_TYPE_CHOICES, default='text_only')
    
    AI_CLASS_CHOICES = [
        ('prescription', 'Prescription'),
        ('medicine', 'Medicine'),
        ('unknown', 'Unknown'),
    ]
    ai_classification = models.CharField(max_length=20, choices=AI_CLASS_CHOICES, default='unknown')
    ai_score = models.FloatField(null=True, blank=True)
    
    AI_STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('processing', 'Processing'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
    ]
    ai_status = models.CharField(max_length=20, choices=AI_STATUS_CHOICES, default='pending')
    ai_reason = models.TextField(null=True, blank=True)
    ocr_text = models.TextField(null=True, blank=True)

    uploaded_at = models.DateTimeField(auto_now_add=True, db_index=True)
    latitude = models.FloatField(null=True, blank=True)
    longitude = models.FloatField(null=True, blank=True)
    location = models.PointField(null=True, blank=True, srid=4326, geography=True, db_index=True) # 🌍 Real-world Geography
    geohash = models.CharField(max_length=12, db_index=True, blank=True, null=True) # 🔑 High-speed shortlisting
    user_address = models.TextField(null=True, blank=True)  # <-- Add this field
    STATUS_CHOICES = [
          ('normal', 'Normal'),
          ('emergency', 'Emergency'),
    ]
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='normal')
    DISPATCH_STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('active', 'Active'),
        ('completed', 'Completed'),
        ('exhausted', 'Exhausted'),
    ]
    dispatch_status = models.CharField(max_length=20, choices=DISPATCH_STATUS_CHOICES, default='pending', db_index=True)
    dispatch_current_batch = models.IntegerField(default=0)
    dispatch_batch_size = models.IntegerField(default=20)
    dispatch_min_quotes = models.IntegerField(default=3)
    dispatch_next_check_at = models.DateTimeField(null=True, blank=True)
    dispatch_completed_at = models.DateTimeField(null=True, blank=True)
    emergency_cancelled_at = models.DateTimeField(null=True, blank=True, db_index=True)
    emergency_cancel_reason = models.TextField(blank=True, default='')
    city = models.ForeignKey('emergency_services.City', on_delete=models.SET_NULL, null=True, blank=True, related_name='prescriptions')
    service_zone = models.ForeignKey('emergency_services.ServiceZone', on_delete=models.SET_NULL, null=True, blank=True, related_name='prescriptions')
    source_response = models.ForeignKey(
        'PrescriptionResponse',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='reorder_prescriptions',
    )
    preferred_store = models.ForeignKey(
        Store,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='preferred_reorder_prescriptions',
    )
    reorder_scope = models.CharField(
        max_length=20,
        choices=[('none', 'None'), ('preferred_only', 'Preferred Store Only'), ('all_stores', 'All Eligible Stores')],
        default='none',
        db_index=True,
    )
    # store = models.ForeignKey(Store, on_delete=models.CASCADE, related_name='prescriptions' , null=True, blank=True)
    def save(self, *args, **kwargs):
        if self.latitude and self.longitude:
            lat, lon = float(self.latitude), float(self.longitude)
            self.location = Point(lon, lat, srid=4326)
            self.geohash = geohash.encode(lat, lon, precision=12)
            from emergency_services.models import City
            if not self.city_id or City.objects.filter(id=self.city_id, is_default=True).exists():
                from emergency_services.services import resolve_city_zone
                self.city, self.service_zone = resolve_city_zone(self.location)
        super().save(*args, **kwargs)

    def __str__(self):
        return f"Prescription {self.id}"


class PrescriptionResponse(models.Model):
    USER_STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('quoted', 'Quoted'),
        ('accepted', 'Accepted'),
        ('processing', 'Processing'),
        ('locked', 'Locked (Ready for Pickup)'),
        ('out_for_delivery', 'Out for Delivery'),
        ('completed', 'Completed'),
        ('rejected', 'Rejected'),
        ('cancelled', 'Cancelled'),
        ('dismissed', 'Dismissed'),
        ('expired', 'Expired'),
    ]

    # 🚦 State Machine Definition
    STATUS_TRANSITIONS = {
        'pending': ['quoted', 'accepted', 'dismissed', 'expired'],
        'quoted': ['accepted', 'rejected', 'dismissed', 'expired'],
        'accepted': ['processing', 'cancelled', 'dismissed'],
        'processing': ['locked', 'out_for_delivery', 'cancelled'],
        'locked': ['completed', 'cancelled'],
        'out_for_delivery': ['completed', 'cancelled'],
        'completed': [],
        'cancelled': [],
        'dismissed': [],
        'expired': [],
        'rejected': [],
    }
    # CONTACT_STATUS_CHOICES = [
    #     ('not_contacted', 'Not Contacted'),
    #     ('contacted', 'Contacted'),
    #     ('done', 'Done'),
    # ]

    # Store contact status (e.g., store ne contact kiya ya nahi)
    # store_contact_status = models.CharField(
    #     max_length=20,
    #     choices=CONTACT_STATUS_CHOICES,
    #     default='not_contacted'
    # )

    # User contact status (e.g., user ne pharmacy se contact kiya ya nahi)


    # store_contact_note = models.TextField(null=True, blank=True)
    user_contact_note = models.TextField(null=True, blank=True)
    store_contact_note = models.TextField(null=True, blank=True)  # ✅ Correct place

    user_status = models.CharField(
        max_length=20,
        choices=USER_STATUS_CHOICES,
        default='pending'
    )
    DELIVERY_OPTION_CHOICES = [
        ('walk_in', 'Walk-in'),
        ('online', 'Online Delivery'),
    ]

    delivery_option = models.CharField(
        max_length=20,
        choices=DELIVERY_OPTION_CHOICES,
        null=True,
        blank=True
    )

    total_amount = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    distance_km = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True, help_text="Distance from user in kilometers")
    quality_score = models.DecimalField(max_digits=5, decimal_places=2, default=0.0)


    store_latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    store_longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    store_address = models.TextField(null=True, blank=True)
    prescription = models.ForeignKey('Prescription', on_delete=models.CASCADE, related_name='responses', null=True, blank=True)
    image = models.FileField(upload_to='response_images/', null=True, blank=True)  # New field for image upload
    user = models.ForeignKey(User, on_delete=models.CASCADE)  # The user receiving the response
    response_text = models.TextField(null=True, blank=True)  # 👈 Make it optional

    # New fields for storing store information
    store_name = models.CharField(max_length=255, null=True, blank=True)
    store_contact = models.CharField(max_length=255, null=True, blank=True)
    store = models.ForeignKey('Store', on_delete=models.CASCADE, related_name='responses', null=True, blank=True)  # Store reference
    completed_by_store = models.ForeignKey('Store', on_delete=models.SET_NULL, related_name='completed_orders', null=True, blank=True)

    # 🛡️ Stock Verification Safeguards
    stock_verified_at = models.DateTimeField(null=True, blank=True)


    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True, db_index=True)

    # 🔒 Level 5 Bulletproof Architecture Fields
    is_locked = models.BooleanField(default=False)
    is_unresponsive = models.BooleanField(default=False)
    response_version = models.IntegerField(default=1)
    last_refresh_requested_at = models.DateTimeField(null=True, blank=True)

    # 🚦 Cancel Flow — Zomato-style state tracking
    is_processing_started = models.BooleanField(default=False)  # Store: bill generation started
    is_packed = models.BooleanField(default=False)               # Store: medicine ready/packed
    
    # 🏁 Cancellation Data Persistence
    cancelled_by = models.CharField(max_length=10, choices=[('user', 'User'), ('store', 'Store'), ('system', 'System')], null=True, blank=True)
    cancel_reason = models.TextField(null=True, blank=True)
    
    # 🛒 Quotation Strategy Options
    QUOTATION_SCENARIO_CHOICES = [
        ('exact_brand', 'All Required Brands Available'),
        ('all_generic', 'All Generics Available'),
        ('mixed', 'Mixed (Brand + Generic)'),
        ('substitutes', 'Alternative Brands / Substitutes'),
        ('partial', 'Some Items Available')
    ]
    quotation_scenario = models.CharField(
        max_length=20, choices=QUOTATION_SCENARIO_CHOICES, null=True, blank=True
    )

    accepted_at = models.DateTimeField(null=True, blank=True)    # For 5-min grace period
    processing_at = models.DateTimeField(null=True, blank=True)
    locked_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    def save(self, *args, **kwargs):
        # 🛡️ Layer 1: Atomic Integrity & Transition Validation
        status_changed = False
        old_status = None
        new_status = self.user_status
        user_context = kwargs.pop('user_context', None) # Custom arg to track who changed it

        if self.pk:
            original = PrescriptionResponse.objects.get(pk=self.pk)
            old_status = original.user_status
            
            # ✅ TERMINAL STATE PROTECTION
            if old_status in ['completed', 'cancelled', 'expired', 'dismissed']:
                # Allow updating internal flags but not status once terminal
                if old_status != new_status:
                    from django.core.exceptions import ValidationError
                    raise ValidationError(f"Cannot change status from terminal state '{old_status}'.")

            # ✅ TRANSITION VALIDATION
            if old_status != new_status:
                allowed = self.STATUS_TRANSITIONS.get(old_status, [])
                if new_status not in allowed:
                    from django.core.exceptions import ValidationError
                    raise ValidationError(
                        f"Illegal status jump from {old_status} to {new_status}."
                    )
                status_changed = True

            self._pre_save_user_status = old_status
            self._post_save_user_status = new_status
            self._status_changed = status_changed

            # ✅ CANCEL REASON ENFORCEMENT
            if new_status == 'cancelled' and not self.cancel_reason:
                from django.core.exceptions import ValidationError
                raise ValidationError("Cancellation reason is mandatory.")

            # ✅ PRICE LOCK ENFORCEMENT
            if original.is_locked:
                if self.total_amount != original.total_amount:
                     from django.core.exceptions import ValidationError
                     raise ValidationError("Locked order: Cannot modify pricing.")

            # Auto-increment version on every update
            self.response_version += 1

        if not self.pk:
            self._pre_save_user_status = None
            self._post_save_user_status = self.user_status
            self._status_changed = False

        # Auto-set timestamps for key states
        now = timezone.now()
        if self.user_status == 'accepted' and not self.accepted_at:
            self.accepted_at = now
        
        if self.user_status == 'processing' and not self.processing_at:
            self.processing_at = now

        if self.user_status in ['locked', 'out_for_delivery'] and not self.locked_at:
            self.locked_at = now
            self.is_locked = True

        if self.user_status == 'completed' and not self.completed_at:
            self.completed_at = now

        super().save(*args, **kwargs)

        # 📜 LOG STATUS HISTORY
        if status_changed and old_status:
            PrescriptionResponseStatusHistory.objects.create(
                response=self,
                from_status=old_status,
                to_status=new_status,
                reason=self.cancel_reason if new_status == 'cancelled' else None,
                changed_by_name=str(user_context) if user_context else "system"
            )

    @property
    def is_ratable(self):
        from django.utils import timezone
        import datetime
        # Only completed or cancelled orders can be rated
        if self.user_status not in ['completed', 'cancelled']:
            return False
        
        # Rating window: 48 hours from the last update (when it was completed/cancelled)
        current_time = timezone.now()
        if current_time - self.updated_at > datetime.timedelta(hours=48):
            return False
        
        return True


# models.py

class ReportNote(models.Model):
    response = models.ForeignKey('PrescriptionResponse', on_delete=models.CASCADE, related_name='reports')
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    note = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user} - {self.response.id} - {self.created_at}"
class StoreReportNote(models.Model):
    response = models.ForeignKey(
        'PrescriptionResponse', on_delete=models.CASCADE, related_name='store_reports',
        null=True, blank=True,
    )
    prescription = models.ForeignKey(
        'Prescription', on_delete=models.CASCADE, related_name='store_reports',
        null=True, blank=True,
    )
    store = models.ForeignKey('Store', on_delete=models.CASCADE)
    note = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.store.name} - {self.note[:20]}"

class SafetyReport(models.Model):
    SCOPE_CITY = 'CITY'
    SCOPE_GLOBAL = 'GLOBAL'
    SCOPE_CHOICES = [(SCOPE_CITY, 'City'), (SCOPE_GLOBAL, 'Global')]
    SEVERITY_CHOICES = [
        ('low', 'Low'), ('medium', 'Medium'), ('high', 'High'), ('critical', 'Critical'),
    ]
    REPORTER_CHOICES = [('user', 'User'), ('store', 'Pharmacy')]
    TARGET_CHOICES = [('user', 'User'), ('store', 'Pharmacy')]
    CATEGORY_CHOICES = [
        ('fake_or_spam', 'Fake or spam request'),
        ('invalid_contact', 'Invalid contact information'),
        ('wrong_information', 'Wrong information'),
        ('suspicious_behavior', 'Suspicious behavior'),
        ('medicine_safety', 'Medicine safety concern'),
        ('abusive_behavior', 'Abusive behavior'),
        ('other', 'Other'),
    ]
    STATUS_CHOICES = [
        ('submitted', 'Submitted'),
        ('under_review', 'Under Review'),
        ('action_taken', 'Action Taken'),
        ('escalated', 'Escalated'),
        ('closed', 'Closed'),
    ]

    reporter_type = models.CharField(max_length=10, choices=REPORTER_CHOICES, db_index=True)
    reporter_user = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL, related_name='safety_reports_filed')
    reporter_store = models.ForeignKey(Store, null=True, blank=True, on_delete=models.SET_NULL, related_name='safety_reports_filed')
    target_type = models.CharField(max_length=10, choices=TARGET_CHOICES, db_index=True)
    reported_user = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL, related_name='safety_reports_received')
    reported_store = models.ForeignKey(Store, null=True, blank=True, on_delete=models.SET_NULL, related_name='safety_reports_received')
    prescription = models.ForeignKey(Prescription, null=True, blank=True, on_delete=models.SET_NULL, related_name='safety_reports')
    response = models.ForeignKey(PrescriptionResponse, null=True, blank=True, on_delete=models.SET_NULL, related_name='safety_reports')
    category = models.CharField(max_length=40, choices=CATEGORY_CHOICES, default='other', db_index=True)
    severity = models.CharField(max_length=10, choices=SEVERITY_CHOICES, default='medium', db_index=True)
    scope = models.CharField(max_length=10, choices=SCOPE_CHOICES, default=SCOPE_GLOBAL, db_index=True)
    city = models.ForeignKey(
        'emergency_services.City', null=True, blank=True, on_delete=models.SET_NULL,
        related_name='safety_reports',
    )
    service_zone = models.ForeignKey(
        'emergency_services.ServiceZone', null=True, blank=True, on_delete=models.SET_NULL,
        related_name='safety_reports',
    )
    assigned_to_id = models.PositiveBigIntegerField(null=True, blank=True, db_index=True)
    description = models.TextField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='submitted', db_index=True)
    resolution_note = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [models.Index(fields=['reporter_type', 'status', 'created_at'])]

    def __str__(self):
        return f'Safety Report #{self.pk} ({self.reporter_type} → {self.target_type})'

    def save(self, *args, **kwargs):
        if self._state.adding:
            source = self.prescription
            if not source and self.response_id:
                source = self.response.prescription
            source = source or self.reported_store or self.reporter_store
            if source:
                self.scope = self.SCOPE_CITY
                self.city = getattr(source, 'city', None)
                self.service_zone = getattr(source, 'service_zone', None)
                if not self.city_id:
                    from emergency_services.services import get_default_city
                    self.city = get_default_city()
            else:
                self.scope = self.SCOPE_GLOBAL
                self.city = None
                self.service_zone = None
            if self.severity == 'medium' and self.category in {'medicine_safety', 'suspicious_behavior'}:
                self.severity = 'high'
            elif self.severity == 'medium' and self.category == 'invalid_contact':
                self.severity = 'low'
        super().save(*args, **kwargs)


class PrescriptionResponseStatusHistory(models.Model):
    """
    Elite Audit Trail: Tracks every status transition for a response.
    Essential for 'Strict FSM' and debugging production state issues.
    """
    response    = models.ForeignKey('PrescriptionResponse', on_delete=models.CASCADE, related_name='status_history')
    from_status = models.CharField(max_length=20, choices=PrescriptionResponse.USER_STATUS_CHOICES)
    to_status   = models.CharField(max_length=20, choices=PrescriptionResponse.USER_STATUS_CHOICES)
    reason      = models.TextField(null=True, blank=True)
    changed_by_name = models.CharField(max_length=100, null=True, blank=True)
    created_at  = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Order {self.response_id}: {self.from_status} -> {self.to_status} at {self.created_at}"

class QuoteDeliveryOffer(models.Model):
    ELIGIBILITY_CHOICES = [
        ('eligible', 'Eligible'),
        ('delivery_disabled', 'Delivery Disabled'),
        ('outside_radius', 'Outside Delivery Radius'),
        ('user_location_missing', 'User Location Missing'),
        ('store_location_missing', 'Store Location Missing'),
        ('delivery_person_unavailable', 'Delivery Person Unavailable'),
        ('temporarily_unavailable', 'Temporarily Unavailable'),
        ('store_closed', 'Store Closed'),
        ('manual_override', 'Manual Override'),
    ]
    response = models.OneToOneField(PrescriptionResponse, on_delete=models.CASCADE, related_name='delivery_offer')
    distance_km = models.DecimalField(max_digits=7, decimal_places=2, null=True, blank=True)
    pickup_available = models.BooleanField(default=True)
    home_delivery_available = models.BooleanField(default=False)
    eligibility_code = models.CharField(max_length=40, choices=ELIGIBILITY_CHOICES, default='delivery_disabled')
    unavailable_reason = models.CharField(max_length=240, blank=True)
    delivery_charge = models.DecimalField(max_digits=8, decimal_places=2, default=Decimal('0.00'))
    estimated_delivery_minutes = models.PositiveIntegerField(null=True, blank=True)
    delivery_message = models.CharField(max_length=240, blank=True)
    settings_snapshot = models.JSONField(default=dict, blank=True)
    assigned_delivery_person = models.ForeignKey(
        StoreDeliveryPerson,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='assigned_offers',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def clean(self):
        errors = {}
        if self.delivery_charge < 0:
            errors['delivery_charge'] = 'Delivery charge cannot be negative.'
        if self.home_delivery_available and self.eligibility_code not in ('eligible', 'manual_override'):
            errors['eligibility_code'] = 'Available delivery must use an eligible status.'
        if self.assigned_delivery_person_id:
            if self.assigned_delivery_person.store_id != self.response.store_id:
                errors['assigned_delivery_person'] = 'Delivery person must belong to the quoting store.'
            elif not self.assigned_delivery_person.is_active:
                errors['assigned_delivery_person'] = 'Inactive delivery person cannot be assigned.'
        if errors:
            raise ValidationError(errors)

    @property
    def payable_amount(self):
        medicine_total = self.response.total_amount or Decimal('0.00')
        return medicine_total + self.delivery_charge if self.response.delivery_option == 'online' else medicine_total

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)


class PrescriptionTargetStore(models.Model):
    STATUS_CHOICES = [
        ('notified', 'Notified'),
        ('responded', 'Responded'),
        ('skipped', 'Skipped'),
    ]

    prescription = models.ForeignKey(Prescription, on_delete=models.CASCADE, related_name='target_stores')
    store = models.ForeignKey(Store, on_delete=models.CASCADE, related_name='target_prescriptions')
    created_at = models.DateTimeField(auto_now_add=True)
    batch_number = models.IntegerField(default=1, db_index=True)
    rank_score = models.DecimalField(max_digits=7, decimal_places=4, default=0.0)
    distance_km = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True)
    radius_min_km = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True)
    radius_max_km = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True)
    notified_at = models.DateTimeField(default=timezone.now, db_index=True)
    opened_at = models.DateTimeField(null=True, blank=True)
    responded_at = models.DateTimeField(null=True, blank=True)
    first_reminder_at = models.DateTimeField(null=True, blank=True)
    second_reminder_at = models.DateTimeField(null=True, blank=True)
    escalated_at = models.DateTimeField(null=True, blank=True, db_index=True)
    reminder_count = models.PositiveSmallIntegerField(default=0)
    manual_reminder_count = models.PositiveSmallIntegerField(default=0)
    last_manual_reminder_at = models.DateTimeField(null=True, blank=True)
    reminders_suppressed_at = models.DateTimeField(null=True, blank=True)
    reminders_suppressed_by_id = models.PositiveBigIntegerField(null=True, blank=True)
    support_contacted_at = models.DateTimeField(null=True, blank=True)
    support_contacted_by_id = models.PositiveBigIntegerField(null=True, blank=True)
    last_notification_error = models.CharField(max_length=500, blank=True)
    policy_snapshot = models.JSONField(default=dict, blank=True)
    city = models.ForeignKey('emergency_services.City', on_delete=models.SET_NULL, null=True, blank=True, related_name='store_dispatches')
    service_zone = models.ForeignKey('emergency_services.ServiceZone', on_delete=models.SET_NULL, null=True, blank=True, related_name='store_dispatches')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='notified', db_index=True)

    class Meta:
        unique_together = ('prescription', 'store')
        indexes = [
            models.Index(fields=['prescription', 'batch_number']),
            models.Index(fields=['store', 'status']),
        ]

    def __str__(self):
        return f"Prescription {self.prescription.id} sent to Store {self.store.id}"

class DeliveryOTP(models.Model):
    response = models.OneToOneField(PrescriptionResponse, on_delete=models.CASCADE, related_name='delivery_otp')
    otp_code = models.CharField(max_length=6)
    is_used = models.BooleanField(default=False)
    attempts = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    @property
    def expires_at(self):
        return self.created_at + timedelta(minutes=10)

    @property
    def is_expired(self):
        return timezone.now() > self.expires_at

    @property
    def is_active(self):
        return not self.is_used and not self.is_expired and self.attempts < 5

    def __str__(self):
        return f"Delivery OTP for response {self.response_id}"

class PrescriptionResponseMedicine(models.Model):
    response = models.ForeignKey(PrescriptionResponse, on_delete=models.CASCADE, related_name='medicines')
    medicine_name = models.CharField(max_length=255)
    
    MEDICINE_TYPE_CHOICES = [
        ('brand', 'Original Brand'),
        ('generic', 'Generic Equivalent'),
        ('substitute', 'Different Brand / Substitute')
    ]
    medicine_type = models.CharField(max_length=20, choices=MEDICINE_TYPE_CHOICES, default='brand')
    
    price = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    medicine_brand = models.CharField(max_length=255, null=True, blank=True)
    is_available = models.BooleanField(default=True)

    def __str__(self):
        return f"{self.medicine_name} - {self.price}"


class UserStoreRelationship(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='store_relationships')
    store = models.ForeignKey(Store, on_delete=models.CASCADE, related_name='user_relationships')
    completed_order_count = models.PositiveIntegerField(default=0)
    last_completed_order = models.ForeignKey(
        PrescriptionResponse,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='last_relationship_records',
    )
    last_order_at = models.DateTimeField(null=True, blank=True, db_index=True)
    is_preferred = models.BooleanField(default=False, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('user', 'store')
        indexes = [
            models.Index(fields=['user', 'is_preferred', 'last_order_at']),
            models.Index(fields=['store', 'completed_order_count']),
        ]

    def __str__(self):
        return f"{self.user_id} -> {self.store_id} ({self.completed_order_count})"


class SavedMedicine(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='saved_medicines')
    store = models.ForeignKey(Store, on_delete=models.SET_NULL, null=True, blank=True, related_name='saved_customer_medicines')
    source_response = models.ForeignKey(
        PrescriptionResponse,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='saved_medicine_snapshots',
    )
    medicine_name = models.CharField(max_length=255)
    medicine_brand = models.CharField(max_length=255, null=True, blank=True)
    medicine_type = models.CharField(max_length=20, default='brand')
    last_price = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    last_ordered_at = models.DateTimeField(null=True, blank=True, db_index=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('user', 'medicine_name', 'medicine_brand', 'medicine_type')
        indexes = [
            models.Index(fields=['user', 'is_active', 'last_ordered_at']),
        ]

    def __str__(self):
        return self.medicine_name

class ChatThread(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="chat_threads")
    store = models.ForeignKey(Store, on_delete=models.CASCADE, related_name="chat_threads")
    prescription = models.ForeignKey(Prescription, on_delete=models.SET_NULL, null=True, blank=True, related_name="chat_threads")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True, db_index=True)
    
    class Meta:
        unique_together = ('user', 'store', 'prescription')

    LOCKED_STATUSES = ['completed', 'cancelled']  # only hard locks

    def is_chat_locked(self):
        if not self.prescription:
            return False
        response = (
            self.prescription.responses
            .filter(store=self.store, user=self.user)
            .exclude(user_status__in=['rejected', 'dismissed', 'expired'])
            .order_by('-created_at')
            .first()
        )
        return bool(response and response.user_status in self.LOCKED_STATUSES)

    def __str__(self):
        return f"Chat between {self.user.name} and {self.store.name}"

class ChatMessage(models.Model):
    SENDER_CHOICES = [
        ('user', 'User'),
        ('store', 'Store')
    ]
    
    thread = models.ForeignKey(ChatThread, on_delete=models.CASCADE, related_name="messages")
    sender_type = models.CharField(max_length=10, choices=SENDER_CHOICES, db_index=True)
    text = models.TextField(null=True, blank=True)
    audio = models.FileField(upload_to='chat_audio/', null=True, blank=True)
    is_read = models.BooleanField(default=False, db_index=True)
    is_edited = models.BooleanField(default=False)
    is_deleted_for_everyone = models.BooleanField(default=False)
    deleted_by_user = models.BooleanField(default=False)
    deleted_by_store = models.BooleanField(default=False)
    image = models.ImageField(upload_to='chat_images/', null=True, blank=True)
    video = models.FileField(upload_to='chat_videos/', null=True, blank=True)
    reply_to = models.ForeignKey('self', on_delete=models.SET_NULL, null=True, blank=True, related_name='replies')
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    def __str__(self):
        if self.audio:
            return f"{self.sender_type}: [Audio Message]"
        return f"{self.sender_type}: {self.text[:20] if self.text else ''}"

class Rating(models.Model):
    GIVER_CHOICES = [
        ('user', 'User'),
        ('store', 'Store'),
    ]
    TARGET_CHOICES = [
        ('user', 'User'),
        ('store', 'Store'),
    ]
    
    order = models.ForeignKey(PrescriptionResponse, on_delete=models.CASCADE, related_name='ratings')
    given_by = models.CharField(max_length=10, choices=GIVER_CHOICES)
    target_type = models.CharField(max_length=10, choices=TARGET_CHOICES) # Who is receiving the rating
    rating = models.PositiveSmallIntegerField() # 1-5
    review = models.TextField(null=True, blank=True)
    tags = models.JSONField(default=list, blank=True)
    is_edited = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('order', 'given_by')

    def __str__(self):
        return f"Rating for Order {self.order.id} by {self.given_by} ({self.rating} stars)"


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 📋 WS EVENT AUDIT LOG — Elite Reliability Layer
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
class WSEventLog(models.Model):
    """
    Lightweight audit trail for every WebSocket fulfillment broadcast.
    Used for:
      - Idempotency verification (event_id uniqueness)
      - Silent failure detection (query for un-acked events)
      - Debugging production issues without log files
    """
    event_id    = models.CharField(max_length=36, unique=True, db_index=True)
    event_type  = models.CharField(max_length=50)   # e.g. 'new_offer', 'status_change'
    user_id     = models.IntegerField(db_index=True)
    response_id = models.IntegerField(null=True, blank=True, db_index=True)
    payload     = models.JSONField(default=dict)
    created_at  = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user_id', 'created_at']),
        ]

    def __str__(self):
        return f"[{self.event_type}] event={self.event_id[:8]}… user={self.user_id}"

class AppNotification(models.Model):
    recipient_user = models.ForeignKey(User, on_delete=models.CASCADE, null=True, blank=True, related_name='app_notifications')
    recipient_store = models.ForeignKey(Store, on_delete=models.CASCADE, null=True, blank=True, related_name='app_notifications')
    title = models.CharField(max_length=180)
    body = models.TextField(blank=True)
    notification_type = models.CharField(max_length=80, blank=True, db_index=True)
    data = models.JSONField(default=dict, blank=True)
    dedupe_key = models.CharField(max_length=180, null=True, blank=True, unique=True)
    is_read = models.BooleanField(default=False, db_index=True)
    read_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['recipient_user', 'is_read', 'created_at']),
            models.Index(fields=['recipient_store', 'is_read', 'created_at']),
            models.Index(fields=['notification_type', 'created_at']),
        ]

    def __str__(self):
        target = self.recipient_user_id or self.recipient_store_id
        return f"{self.notification_type or 'notification'} -> {target}"

class AppRating(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, null=True, blank=True, related_name='app_ratings')
    store = models.ForeignKey(Store, on_delete=models.CASCADE, null=True, blank=True, related_name='app_ratings')
    rating = models.IntegerField()
    feedback = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        user_str = self.user.name if self.user else (self.store.name if self.store else "Anonymous")
        return f"AppRating {self.rating} stars by {user_str}"

class PasswordResetOTP(models.Model):
    email = models.EmailField(db_index=True)
    user_type = models.CharField(max_length=10, choices=[('user', 'User'), ('store', 'Store')])
    otp_code = models.CharField(max_length=6)
    is_verified = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"OTP {self.otp_code} for {self.email} ({self.user_type})"


class PharmacistConsultation(models.Model):
    STATUS_CHOICES = [
        ('waiting', 'Waiting for pharmacist'), ('active', 'Active'),
        ('callback_requested', 'Callback requested'), ('answered', 'Answered'), ('closed', 'Closed'),
    ]
    CATEGORY_CHOICES = [
        ('how_to_take', 'How and when to take'), ('food_timing', 'Before or after food'),
        ('missed_dose', 'Missed dose'), ('side_effects', 'Common side effects'),
        ('storage', 'Storage'), ('prescription_help', 'Understand prescription'), ('other', 'Other'),
    ]
    order = models.OneToOneField(PrescriptionResponse, on_delete=models.CASCADE, related_name='pharmacist_consultation')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='pharmacist_consultations')
    store = models.ForeignKey(Store, on_delete=models.CASCADE, related_name='pharmacist_consultations')
    category = models.CharField(max_length=30, choices=CATEGORY_CHOICES)
    medicine_name = models.CharField(max_length=200)
    question = models.TextField()
    status = models.CharField(max_length=30, choices=STATUS_CHOICES, default='waiting', db_index=True)
    callback_requested = models.BooleanField(default=False)
    callback_phone = models.CharField(max_length=15, blank=True)
    callback_preferred_time = models.CharField(max_length=100, blank=True)
    user_consent_at = models.DateTimeField()
    closed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-updated_at']
        indexes = [models.Index(fields=['store', 'status', 'updated_at']), models.Index(fields=['user', 'updated_at'])]

    def __str__(self):
        return f"Pharmacist consultation #{self.id} for order {self.order_id}"


class PharmacistConsultationMessage(models.Model):
    SENDER_CHOICES = [('user', 'User'), ('pharmacist', 'Verified pharmacist')]
    consultation = models.ForeignKey(PharmacistConsultation, on_delete=models.CASCADE, related_name='messages')
    sender_type = models.CharField(max_length=20, choices=SENDER_CHOICES)
    text = models.TextField()
    attachment = models.FileField(upload_to='pharmacist_consultations/', null=True, blank=True)
    pharmacist_name_snapshot = models.CharField(max_length=120, blank=True)
    pharmacist_license_snapshot = models.CharField(max_length=100, blank=True)
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f"Consultation message #{self.id}"


class OrderReplacementRequest(models.Model):
    REASON_CHOICES = [("wrong_medicine", "Wrong Medicine Delivered"), ("expired_medicine", "Expired Medicine"), ("damaged", "Damaged Packaging/Product"), ("other", "Other")]
    STATUS_CHOICES = [("requested", "Replacement Requested"), ("approved", "Approved by Store"), ("rejected", "Rejected by Store"), ("in_transit", "Replacement in Transit"), ("completed", "Replacement Completed"), ("cancelled", "Cancelled by User")]
    order = models.OneToOneField(PrescriptionResponse, on_delete=models.CASCADE, related_name="replacement_request")
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="replacement_requests")
    store = models.ForeignKey(Store, on_delete=models.CASCADE, related_name="replacement_requests")
    reason = models.CharField(max_length=50, choices=REASON_CHOICES)
    description = models.TextField(blank=True, null=True)
    proof_image = models.ImageField(upload_to="replacements/proofs/", blank=True, null=True)
    status = models.CharField(max_length=30, choices=STATUS_CHOICES, default="requested", db_index=True)
    store_note = models.TextField(blank=True, null=True, help_text="Reason for rejection or instructions for replacement")
    is_walk_in = models.BooleanField(default=False)
    assigned_delivery_person = models.ForeignKey(
        StoreDeliveryPerson, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='replacement_assignments',
    )
    estimated_delivery_minutes = models.PositiveIntegerField(null=True, blank=True)
    estimated_arrival_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)
    approved_at = models.DateTimeField(null=True, blank=True)
    rejected_at = models.DateTimeField(null=True, blank=True)
    in_transit_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    cancelled_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['store', 'status', 'created_at']),
        ]

    def __str__(self):
        return f"Replacement for Order #{self.order.id} - {self.status}"
