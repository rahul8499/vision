# from rest_framework.views import APIView
# from rest_framework.response import Response
# from rest_framework.parsers import MultiPartParser, FormParser
# from .serializers import PrescriptionSerializer
# from .models import Prescription

# class PrescriptionUploadView(APIView):
#     parser_classes = [MultiPartParser, FormParser]

#     def post(self, request, *args, **kwargs):
#         serializer = PrescriptionSerializer(data=request.data)
#         if serializer.is_valid():
#             serializer.save()
#             return Response(serializer.data, status=201)
#         return Response(serializer.errors, status=400)
from collections import defaultdict
from django.conf import settings
from django.core.mail import send_mail
from django.core.serializers.json import DjangoJSONEncoder
from django.db import transaction
from django.db.models import F, Count, Sum
from decimal import Decimal, InvalidOperation
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
import random
from django.utils.timezone import make_aware, is_naive
from django.db.models import Q, Exists, OuterRef, Subquery, IntegerField
from django.contrib.gis.db.models.functions import Distance
from django.contrib.gis.measure import D
from django.contrib.gis.geos import Point
import math
from .tasks import notify_chat_message_task, notify_store_order_accepted_task, notify_user_response_task

from .utils.ranking import calculate_quality_score, get_smart_tags
from django.db.models import Max, Min
from .models import WSEventLog
from .serializers import PrescriptionResponseSerializer
from .tasks import send_push_task
from .models import Store,PrescriptionResponseMedicine, Rating
from .models import PrescriptionTargetStore
from .models import ReportNote
from .models import StoreReportNote, SafetyReport
from .tasks import send_push_task, enforce_pharmacist_accountability

from .serializers import StoreSerializer, StoreLoginSerializer
from rest_framework.authtoken.models import Token
from django.utils.dateparse import parse_datetime
# Notifications are sent via Celery tasks (see prescription/tasks.py)
from .utils.notifications import send_push_notification
from .utils.app_notifications import (
    create_chat_message_app_notification,
    get_app_notifications_for_actor,
    mark_app_notifications_read,
    send_store_app_notification,
    send_user_app_notification,
    serialize_app_notification,
)
from core.services.s3_service import get_file_url

from rest_framework import status
from rest_framework.generics import RetrieveAPIView
from .serializers import (
    StoreMeSerializer, StoreMeUpdateSerializer, StoreDeliverySettingsSerializer,
    StoreDeliveryPersonSerializer,
)
from rest_framework.parsers import JSONParser
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
import uuid
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser
from .serializers import PrescriptionSerializer, PrescriptionResponseSerializer, RatingSerializer
# from .models import Prescription,
from .models import (
    Prescription, PrescriptionResponse, PasswordResetOTP, DeliveryOTP,
    PharmacistConsultation, PharmacistConsultationMessage, StoreDeliveryPerson,
    QuoteDeliveryOffer,
)
from .services.delivery import (
    get_or_create_delivery_settings, evaluate_delivery_eligibility,
    apply_quote_delivery_override, release_assigned_delivery_person,
)

from rest_framework import generics, filters
from django_filters.rest_framework import DjangoFilterBackend
from .models import Store
from .serializers import StoreSerializer
from asgiref.sync import async_to_sync
from rest_framework.permissions import IsAuthenticated
from rest_framework.authtoken.models import Token
from rest_framework.exceptions import AuthenticationFailed, NotFound
from rest_framework.authentication import BaseAuthentication
from .models import User  # add this
from .serializers import UserSerializer, UserLoginSerializer  # add this
from django.contrib.auth.hashers import make_password
from django.contrib.auth.hashers import check_password
from rest_framework.permissions import AllowAny
from rest_framework.permissions import IsAuthenticated
from rest_framework.authentication import TokenAuthentication
from .authentication import StoreTokenAuthentication, UserTokenAuthentication
from core.services.capability_service import delete_store_account, delete_user_account, get_store_lifecycle_status, get_user_lifecycle_status
from core.services.repeat_customer_service import create_order_again_request
from rest_framework.pagination import PageNumberPagination
from django.core.cache import cache
from rest_framework.throttling import UserRateThrottle
import requests
from geopy.geocoders import Nominatim
from geopy.exc import GeocoderTimedOut, GeocoderServiceError
from geopy.extra.rate_limiter import RateLimiter
import json
import os
from django.utils.dateparse import parse_date
from django.utils import timezone  # ✅ required
from django.utils.translation import gettext as _, override
from django.core.exceptions import ValidationError
from core.services.capability_service import Permission
from core.services.action_validator import CapabilityBlocked, validate_action_capability, blocked_response
from django.core.files import File
import logging
import httpx
import asyncio
from asgiref.sync import async_to_sync
from .models import ChatThread, ChatMessage
from .serializers import ChatThreadSerializer, ChatMessageSerializer
from rest_framework.pagination import PageNumberPagination
logger = logging.getLogger(__name__)
LOCAL_DATE_TZ = ZoneInfo("Asia/Kolkata")


def _run_safe_side_effect(label, callback):
    try:
        return callback()
    except Exception:
        logger.exception("%s failed after commit.", label)
        return None


def _safe_on_commit(label, callback):
    transaction.on_commit(
        lambda label=label, callback=callback: _run_safe_side_effect(label, callback)
    )


def _get_response_store_name(response):
    store = getattr(response, 'store', None)
    return (
        getattr(response, 'store_name', None)
        or getattr(store, 'name', None)
        or 'your pharmacy'
    )


def _build_order_progress_push_payload(response, action):
    store_name = _get_response_store_name(response)
    data = {
        "response_id": getattr(response, 'id', None),
        "prescription_id": getattr(response, 'prescription_id', None),
    }

    if action == 'start_processing':
        data["type"] = "BILLING_STARTED"
        return {
            "title": "Billing started",
            "body": f"{store_name} has started billing your order.",
            "data": data,
        }

    if action == 'mark_packed':
        data["type"] = "ORDER_PACKED"
        return {
            "title": "Order packed",
            "body": f"{store_name} has packed your medicines.",
            "data": data,
        }

    if action == 'mark_locked':
        if getattr(response, 'delivery_option', None) == 'online':
            data["type"] = "OUT_FOR_DELIVERY"
            return {
                "title": "Out for delivery",
                "body": f"Your order from {store_name} is out for delivery.",
                "data": data,
            }

        data["type"] = "ORDER_READY_FOR_PICKUP"
        return {
            "title": "Ready for pickup",
            "body": f"Your order from {store_name} is ready for pickup.",
            "data": data,
        }

    if action == 'completion_otp_requested':
        data["type"] = "COMPLETION_OTP_REQUESTED"
        return {
            "title": "Completion OTP requested",
            "body": f"{store_name} needs your OTP to mark the order complete.",
            "data": data,
        }

    if action == 'mark_completed':
        data["type"] = "ORDER_COMPLETED"
        return {
            "title": "Order completed",
            "body": f"Your order from {store_name} has been completed.",
            "data": data,
        }

    return None


def _queue_user_order_progress_push(response, action):
    user = getattr(response, 'user', None)
    payload = _build_order_progress_push_payload(response, action)

    if not user or not payload:
        return

    notification_type = payload["data"].get("type")
    _safe_on_commit(
        "order progress notification",
        lambda user=user, payload=payload, notification_type=notification_type: send_user_app_notification(
            user,
            payload["title"],
            payload["body"],
            payload["data"],
            dedupe_key=f"user:{user.id}:response:{payload['data'].get('response_id')}:{notification_type}",
        )
    )


def _send_completion_otp_email(recipient_email, otp_code, store_name):
    """Email the same completion OTP already shown to the customer in the app."""
    if not recipient_email:
        logger.warning("Completion OTP email skipped: customer email is missing.")
        return False

    try:
        send_mail(
            subject='Your AARX order completion code',
            message=(
                f'Your verification code to complete the order from '
                f'{store_name or "your pharmacy"} is: {otp_code}.\n\n'
                'This code is valid for 10 minutes. Share it with the pharmacy '
                'only after you have received your order.'
            ),
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[recipient_email],
            fail_silently=False,
        )
        return True
    except Exception:
        # Email is an additional delivery channel. The existing in-app OTP must
        # remain available even if SMTP is temporarily unavailable.
        logger.exception(
            "Failed to send completion OTP email for customer %s.",
            recipient_email,
        )
        return False


def _normalize_whatsapp_number(mobile):
    """Return a digits-only WhatsApp recipient ID, defaulting local numbers to India."""
    digits = ''.join(character for character in str(mobile or '') if character.isdigit())
    if digits.startswith('00'):
        digits = digits[2:]
    if digits.startswith('0') and len(digits) == 11:
        digits = digits[1:]
    if len(digits) == 10:
        country_code = ''.join(
            character
            for character in str(settings.WHATSAPP_DEFAULT_COUNTRY_CODE)
            if character.isdigit()
        )
        digits = f'{country_code}{digits}'
    return digits if 8 <= len(digits) <= 15 else None


def _send_whatsapp_otp(recipient_mobile, otp_code, template_name):
    """Send an existing OTP with an approved Meta authentication template."""
    if not settings.WHATSAPP_ENABLED:
        return False

    phone_number_id = str(settings.WHATSAPP_PHONE_NUMBER_ID).strip()
    access_token = str(settings.WHATSAPP_ACCESS_TOKEN).strip()
    template_name = str(template_name or '').strip()
    recipient = _normalize_whatsapp_number(recipient_mobile)

    if not phone_number_id or not access_token or not template_name or not recipient:
        logger.warning(
            "WhatsApp OTP skipped: provider configuration or recipient is invalid."
        )
        return False

    components = [
        {
            'type': 'body',
            'parameters': [{'type': 'text', 'text': str(otp_code)}],
        }
    ]
    if settings.WHATSAPP_OTP_COPY_CODE_BUTTON:
        components.append({
            'type': 'button',
            'sub_type': 'url',
            'index': '0',
            'parameters': [{'type': 'text', 'text': str(otp_code)}],
        })

    api_version = str(settings.WHATSAPP_GRAPH_API_VERSION).strip().lstrip('v')
    url = f'https://graph.facebook.com/v{api_version}/{phone_number_id}/messages'
    payload = {
        'messaging_product': 'whatsapp',
        'recipient_type': 'individual',
        'to': recipient,
        'type': 'template',
        'template': {
            'name': template_name,
            'language': {'code': settings.WHATSAPP_TEMPLATE_LANGUAGE},
            'components': components,
        },
    }

    try:
        response = requests.post(
            url,
            headers={
                'Authorization': f'Bearer {access_token}',
                'Content-Type': 'application/json',
            },
            json=payload,
            timeout=10,
        )
        response.raise_for_status()
        return True
    except requests.RequestException:
        # WhatsApp is additive: provider/network errors must not alter the
        # existing email, in-app OTP, or OTP verification behavior.
        logger.exception("Failed to send WhatsApp OTP.")
        return False


def get_local_day_bounds(start_date, end_date):
    start_datetime = datetime.combine(start_date, datetime.min.time(), tzinfo=LOCAL_DATE_TZ)
    end_datetime = datetime.combine(end_date + timedelta(days=1), datetime.min.time(), tzinfo=LOCAL_DATE_TZ)
    return start_datetime, end_datetime

def haversine(lat1, lon1, lat2, lon2):
    # Calculate distance between two lat/lon points in km
    R = 6371  # Earth radius in km

    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)

    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = math.sin(delta_phi / 2) ** 2 + \
        math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2) ** 2

    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    return R * c
# class CustomPagination(PageNumberPagination):
#     page_size = 10  # Default page size
#     page_size_query_param = 'page_size'
#     max_page_size = 100
class CustomPagination(PageNumberPagination):
    page_size = 10
    page_size_query_param = 'page_size'
    max_page_size = 100

    def get_paginated_response(self, data):
        return Response({
            'total': self.page.paginator.count,
            'page': self.page.number,
            'page_size': self.get_page_size(self.request),
            'total_pages': math.ceil(self.page.paginator.count / self.get_page_size(self.request)),
            'results': data
        })
def calculate_distance(lat1, lon1, lat2, lon2):
    try:
        # 🛡️ Global Robustness: Force all inputs to float to prevent TypeErrors
        lat1 = float(lat1) if lat1 is not None else 0
        lon1 = float(lon1) if lon1 is not None else 0
        lat2 = float(lat2) if lat2 is not None else 0
        lon2 = float(lon2) if lon2 is not None else 0
    except (ValueError, TypeError):
        return 0

    R = 6371  # Earth radius in km
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (
        math.sin(dlat/2) ** 2 +
        math.cos(math.radians(lat1)) *
        math.cos(math.radians(lat2)) *
        math.sin(dlon/2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    distance = R * c
    return distance
# class PrescriptionUploadView(APIView):
#     authentication_classes = [UserTokenAuthentication]
#     permission_classes = [IsAuthenticated]  # Ensure user is authenticated
#     parser_classes = [MultiPartParser, FormParser]

#     def post(self, request, *args, **kwargs):
#         user = request.user


#         # Create a serializer instance with the data from the request
#         serializer = PrescriptionSerializer(data=request.data)

#         if serializer.is_valid():
#             # Save the prescription and associate it with the logged-in user
#             prescription = serializer.save(user=user)

#             # Get uploaded prescription latitude and longitude
#             lat = serializer.validated_data.get('latitude')
#             lon = serializer.validated_data.get('longitude')

#             # Find all stores within 2 km
#             nearby_stores = []
#             all_stores = Store.objects.filter(is_active=True, is_verified=True)

#             for store in all_stores:
#                 if store.latitude and store.longitude:
#                     distance = calculate_distance(lat, lon, store.latitude, store.longitude)
#                     if distance <= 10:
#                         nearby_stores.append(store)
#                         if store.expo_push_token:
#                             send_expo_push_notification(
#                                 store.expo_push_token,
#                                 "New Emergency Prescription!",
#                                 f"A new emergency prescription was uploaded {round(distance, 2)} km away.",
#                                 {"prescription_id": prescription.id, "type": "NEW_PRESCRIPTION"}
#                             )

#             # Serialize the nearby stores data
#             stores_data = StoreSerializer(nearby_stores, many=True).data

#             # Return the response with the prescription data and nearby stores
#             return Response({
#                 "prescription": serializer.data,  # Full prescription data
#                 "prescription_id": prescription.id,  # Correct variable name here
#                 "nearby_stores": stores_data
#             }, status=201)

#         # If serializer is not valid, return error responses
#         return Response(serializer.errors, status=400)

class PrescriptionUploadView(APIView):
    authentication_classes = [UserTokenAuthentication]
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request, *args, **kwargs):
        user = request.user

        # Get emergency flag from request
        emergency = request.data.get('emergency', 'false').lower() == 'true'
        emergency_charge_id = request.data.get('emergency_charge_id')

        if emergency:
            if request.data.get('latitude') in (None, '') or request.data.get('longitude') in (None, ''):
                return Response({'error': 'Confirm your location before starting an emergency pharmacy request.', 'code': 'emergency_location_required'}, status=400)
            from emergency_services.services import validate_charge_for_upload
            validate_charge_for_upload(user, emergency_charge_id)

        # Validate and save prescription
        # NOTE: Do NOT copy request.data — it contains an open file object that can't be deep-copied.
        # Instead, read upload_type separately and pass it into serializer.save().
        user_upload_type = request.data.get('upload_type', 'text_only')

        upload_data = request.data.copy()
        image_key = request.data.get('image_key')
        verified_image_key = None
        if image_key:
            try:
                from core.services.s3_service import validate_uploaded_object_key
                verified_image_key = validate_uploaded_object_key(image_key, 'prescriptions')
                upload_data.pop('image_key', None)
            except (ValueError, RuntimeError) as exc:
                return Response({'image_key': str(exc)}, status=400)

        serializer = PrescriptionSerializer(
            data=upload_data,
            context={'request': request, 'verified_image_key': verified_image_key},
        )

        if serializer.is_valid():
            status_val = 'emergency' if emergency else 'normal'
            prescription = serializer.save(user=user, status=status_val, user_upload_type=user_upload_type)
            if emergency:
                from emergency_services.services import bind_charge
                bind_charge(user, emergency_charge_id, prescription)
            if verified_image_key:
                prescription.image.name = verified_image_key
                prescription.save(update_fields=['image'])

            response_data = {
                "prescription": serializer.data,
                "prescription_id": prescription.id,
            }

            lat = serializer.validated_data.get('latitude')
            lon = serializer.validated_data.get('longitude')

            if prescription.image:
                try:
                    from .tasks import analyze_prescription_image_task
                    import threading
                    threading.Thread(target=analyze_prescription_image_task, args=(prescription.id,)).start()
                except Exception as exc:
                    logger.error(f"AI analysis queue failed for Rx {prescription.id}: {exc}")
                    prescription.ai_status = 'failed'
                    prescription.ai_reason = f"AI queue failed: {exc}"
                    prescription.save(update_fields=['ai_status', 'ai_reason'])

            if lat is not None and lon is not None:
                from .tasks import get_ranked_dispatch_candidates, notify_nearby_stores_task

                dispatch_result = None
                try:
                    # Create the first target-store batch immediately so the
                    # seller list is correct even before the next Celery tick.
                    dispatch_result = notify_nearby_stores_task.run(prescription.id)
                except Exception as exc:
                    logger.error(f"Immediate dispatch failed for Rx {prescription.id}: {exc}")

                prescription.refresh_from_db()
                target_batch = PrescriptionTargetStore.objects.filter(
                    prescription=prescription,
                    batch_number=prescription.dispatch_current_batch,
                ).select_related('store')
                dispatched_stores = [target.store for target in target_batch]
                stores_data = StoreSerializer(dispatched_stores, many=True).data
                ranked_candidates = get_ranked_dispatch_candidates(
                    prescription,
                    radius_km=30,
                    min_radius_km=0,
                    max_radius_km=30,
                )
                response_data["nearby_stores"] = stores_data
                response_data["dispatch"] = {
                    "current_batch": prescription.dispatch_current_batch,
                    "stores_notified": len(dispatched_stores),
                    "total_eligible_stores": len(ranked_candidates),
                    "min_quotes_needed": prescription.dispatch_min_quotes,
                    "next_expansion_in_seconds": 120 if prescription.status == 'emergency' else 300,
                    "status": dispatch_result.get("status") if isinstance(dispatch_result, dict) else prescription.dispatch_status,
                }

            return Response(response_data, status=201)

        return Response(serializer.errors, status=400)



class PrescriptionSendToStoresView(APIView):
    authentication_classes = [UserTokenAuthentication]
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        user = request.user
        prescription_id = request.data.get('prescription_id')
        store_ids = request.data.getlist('store_ids')  # list of store IDs
        emergency_flag = request.data.get('emergency', 'false').lower() == 'true'

        if not prescription_id or not store_ids:
            return Response({"error": "prescription_id and store_ids are required"}, status=400)

        try:
            prescription = Prescription.objects.get(id=prescription_id, user=user)
        except Prescription.DoesNotExist:
            return Response({"error": "Prescription not found"}, status=404)

        if emergency_flag:
            prescription.status = 'emergency'
            prescription.save(update_fields=['status'])

        # Link to stores

        
        serializer = PrescriptionSerializer(prescription, context={'request': request})
        
        # 🚀 O(1) Database Query: Get all selected stores instantly
        stores = list(Store.objects.filter(id__in=store_ids))
        
        # Count auto-accepting stores
        reviewing_count = sum(1 for store in stores if getattr(store, 'auto_accept_prescription', False))
        
        # 🚀 Ultra-fast Bulk Insert: Save all mappings in a single DB query
        target_stores_to_create = [
            PrescriptionTargetStore(prescription=prescription, store=store)
            for store in stores
        ]
        PrescriptionTargetStore.objects.bulk_create(target_stores_to_create, ignore_conflicts=True)
        
        # 🚀 Background Broadcasting (non-blocking)
        def broadcast_to_selected_stores():
            import threading
            channel_layer = get_channel_layer()
            for store in stores:
                try:
                    dist = calculate_distance(prescription.latitude, prescription.longitude, store.latitude, store.longitude) if prescription.latitude and prescription.longitude and store.latitude and store.longitude else 0

                    ws_data = serializer.data.copy()
                    if dist < 1:
                        ws_data['distance_km'] = f"{round(dist * 1000)} meters"
                    else:
                        ws_data['distance_km'] = f"{round(dist, 2)} km"
                    ws_data['store_latitude'] = store.latitude
                    ws_data['store_longitude'] = store.longitude
                    ws_data['store_address'] = store.address
                    ws_data['has_responded'] = False
                    
                    async_to_sync(channel_layer.group_send)(
                        f"store_{store.id}_fulfillment",
                        {
                            "type": "fulfillment_update",
                            "event_id": str(uuid.uuid4()),
                            "seq": prescription.id,
                            "action": "new_prescription",
                            "data": ws_data
                        }
                    )
                except Exception as e:
                    print(f"Error broadcasting to selected store {store.id}: {e}")

        import threading
        threading.Thread(target=broadcast_to_selected_stores).start()

        return Response({
            "message": "Prescription sent to selected stores.",
            "reviewing_pharmacies_count": reviewing_count
        }, status=status.HTTP_201_CREATED)
class GetPrescriptionByIdView(APIView):
    authentication_classes = [StoreTokenAuthentication]  # Use appropriate authentication
    permission_classes = [IsAuthenticated]  # Ensure user is authenticated

    def get(self, request, *args, **kwargs):
        user = request.user
        print(user)

        prescription_id = kwargs.get('id')
        print(f"Requested Prescription ID: {prescription_id}")

        try:
            # Get the prescription instance based on the ID
            prescription = Prescription.objects.get(id=prescription_id)
        except Prescription.DoesNotExist:
            raise NotFound({"error": "Prescription not found."})

        # Serialize the prescription data and return it
        prescription_data = PrescriptionSerializer(prescription, context={'request': request}).data

        return Response({
            "prescription": prescription_data
        }, status=200)



class SubmitResponseToUserPrescription(APIView):
    authentication_classes = [StoreTokenAuthentication]  # Your auth class
    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        store = request.user  # Store instance authenticated by token
        target_user_id = kwargs.get('user_id')
        response_text = request.data.get('response_text')
        image = request.FILES.get('image')

        validate_action_capability(Permission.OFFER, actor=store, store=store)

        try:
            target_user = User.objects.get(id=target_user_id)
        except User.DoesNotExist:
            return Response({"error": "Target user not found."}, status=404)

        # try:
        #     prescription = Prescription.objects.filter(user=target_user).latest('uploaded_at')
        # except Prescription.DoesNotExist:
        #     return Response({"error": "No prescription found for this user."}, status=404)
        prescription_id = request.data.get('prescription_id')
        print("prescription_id--",prescription_id)
        if not prescription_id:
            return Response({"error": "prescription_id is required."}, status=400)

        try:
            prescription = Prescription.objects.get(id=prescription_id, user=target_user)
        except Prescription.DoesNotExist:
            return Response({"error": "Prescription not found for this user."}, status=404)

        target_link = PrescriptionTargetStore.objects.filter(
            prescription=prescription,
            store=store
        ).first()
        if not target_link:
            return Response({"error": "This prescription has not been assigned to your store."}, status=403)
        if PrescriptionResponse.objects.filter(prescription=prescription, store=store).exists():
            return Response({"error": "You have already submitted a quote for this prescription."}, status=400)

        delivery_override = request.data.get('delivery_offer')
        if isinstance(delivery_override, str):
            try:
                delivery_override = json.loads(delivery_override)
            except json.JSONDecodeError:
                return Response({"error": "Invalid delivery_offer format."}, status=400)
        try:
            delivery_result = apply_quote_delivery_override(
                evaluate_delivery_eligibility(store, prescription),
                delivery_override,
            )
        except (ValueError, TypeError) as exc:
            return Response({"error": str(exc)}, status=400)
        if not delivery_result['pickup_available'] and not delivery_result['home_delivery_available']:
            return Response({"error": "At least one fulfillment method must be available for this quote."}, status=400)

        total_amount = None
        if 'total_amount' in request.data:
            total_amount_input = request.data.get('total_amount')
            try:
                total_amount = Decimal(total_amount_input)
            except InvalidOperation:
                return Response({"error": "Invalid total_amount format."}, status=400)

        # Extract user's lat/lng from the latest prescription
        user_lat = getattr(prescription, 'latitude', None)
        user_lng = getattr(prescription, 'longitude', None)

        store_lat = store.latitude
        store_lng = store.longitude

        distance_km = None
        distance_display = None

        if user_lat is not None and user_lng is not None and store_lat and store_lng:
            distance_km = haversine(float(user_lat), float(user_lng), float(store_lat), float(store_lng))
            if distance_km < 1:
                distance_meters = round(distance_km * 1000)
                distance_display = f"{distance_meters} meters"

            else:
                distance_display = f"{round(distance_km, 2)} km"








        print("distance_display",distance_display )

        quotation_scenario = request.data.get('quotation_scenario')

        response = PrescriptionResponse.objects.create(
            prescription=prescription,
            store=store,
            user=target_user,
            response_text=response_text,
            # image=image,
            store_name=store.name,
            store_contact=store.mobile,
            store_latitude=store_lat,
            store_longitude=store_lng,
            store_address=store.address,
            total_amount=total_amount,
            distance_km=Decimal(str(round(distance_km, 2))) if distance_km is not None else None,
            quotation_scenario=quotation_scenario
            # distance_km=distance_display
        )
        # 🗄️ Copy prescription image to response (S3-compatible)
        if prescription.image and prescription.image.name:
            try:
                from core.services.s3_service import is_s3_enabled, copy_s3_object
                if is_s3_enabled():
                    # S3 mode: server-side copy (fast, no download/re-upload)
                    new_key = copy_s3_object(
                        source_key=prescription.image.name,
                        dest_folder='response_images',
                    )
                    if new_key:
                        response.image.name = new_key
                        response.save()
                else:
                    # Local mode: read file and save copy
                    if os.path.isfile(prescription.image.path):
                        with open(prescription.image.path, 'rb') as f:
                            response.image.save(os.path.basename(prescription.image.name), File(f), save=False)
                        response.save()
            except Exception as e:
                logger.warning(f"Image copy failed for response {response.id}: {e}")


        medicines_data = request.data.get('medicines', [])

        if isinstance(medicines_data, str):
            try:
                medicines_data = json.loads(medicines_data)
            except json.JSONDecodeError:
                medicines_data = []

        # 🛡️ Safety Hub: Validate that at least ONE item is available
        has_at_least_one_available = any(med.get('is_available', True) for med in medicines_data if isinstance(med, dict))

        if not has_at_least_one_available:
            # We don't delete the response yet as they might want to re-try, or we can just fail hard
            response.delete()
            return Response({"error": "Stockout: At least one medicine must be available to send a quote."}, status=400)

        QuoteDeliveryOffer.objects.create(response=response, **delivery_result)
        response.stock_verified_at = timezone.now()
        response.save()

        response_minutes = max(
            1,
            int((response.created_at - prescription.uploaded_at).total_seconds() / 60)
        )
        current_avg = float(store.avg_response_time_mins or response_minutes)
        store.avg_response_time_mins = int((current_avg * 0.8) + (response_minutes * 0.2))
        store.save(update_fields=['avg_response_time_mins'])
        PrescriptionTargetStore.objects.filter(id=target_link.id).update(
            status='responded',
            responded_at=response.created_at
        )

        for med_data in medicines_data:
            if not isinstance(med_data, dict):
                continue

            med_name = med_data.get('medicine_name')
            price_raw = med_data.get('price')
            med_brand = med_data.get('medicine_brand')
            med_type = med_data.get('medicine_type', 'brand')
            is_avail = med_data.get('is_available')
            if is_avail is None:
                is_avail = True
            else:
                is_avail = bool(is_avail)

            if not med_name:
                continue
            try:
                price = Decimal(price_raw) if price_raw else None
            except InvalidOperation:
                price = None

            PrescriptionResponseMedicine.objects.create(
                response=response,
                medicine_name=med_name,
                price=price,
                medicine_type=med_type,
                is_available=is_avail,
                medicine_brand=med_brand
            )





        if prescription.status == 'emergency':
            from emergency_services.services import mark_valid_quote_received
            mark_valid_quote_received(response)

        # Push notification is sent after the quote is fully saved and broadcast.
        
        # ⚡ Real-Time WebSocket Broadcast
        
        serializer = PrescriptionResponseSerializer(response, context={'request': request})
        channel_safe_response = json.loads(json.dumps(serializer.data, cls=DjangoJSONEncoder))
        _eid = str(uuid.uuid4())
        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            f"user_{target_user.id}_fulfillment",
            {
                "type": "fulfillment_update",
                "event_id": _eid,
                "seq": response.response_version,
                "action": "new_offer",
                "data": channel_safe_response
            }
        )
        try:
            WSEventLog.objects.create(
                event_id=_eid, event_type='new_offer',
                user_id=target_user.id, response_id=response.id,
                payload={"action": "new_offer", "response_id": response.id, "seq": response.response_version}
            )
        except Exception:
            pass

        notification_args = (target_user.id, prescription.id, response.id, store.name)
        _safe_on_commit(
            "quotation notification",
            lambda notification_args=notification_args: notify_user_response_task.apply(args=notification_args)
        )

        return Response({
            "message": "Response submitted successfully.",
            "response": serializer.data
        }, status=201)

class VerifyStockAPIView(APIView):
    authentication_classes = [StoreTokenAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request, response_id):
        # NOTE: response_id here is actually the Prescription ID
        # (from NearbyPrescriptionsView, item.id = prescription.id)
        try:
            response = PrescriptionResponse.objects.select_related('user', 'store').get(
                prescription_id=response_id, store=request.user
            )

            validate_action_capability(Permission.OFFER, actor=request.user, resource=response)

            if response.is_locked:
                return Response({"error": "Order is already locked."}, status=400)

            # ✅ Update stock freshness AND clear the refresh request
            response.stock_verified_at = timezone.now()
            response.is_unresponsive = False
            response.last_refresh_requested_at = None  # ← Clear the banner
            response.save()

            # ⚡ Real-Time WebSocket Broadcast
            _eid = str(uuid.uuid4())
            channel_layer = get_channel_layer()
            async_to_sync(channel_layer.group_send)(
                f"user_{response.user.id}_fulfillment",
                {
                    "type": "fulfillment_update",
                    "event_id": _eid,
                    "seq": response.response_version,
                    "action": "status_change",
                    "data": {
                        "response_id": response.id,
                        "stock_verified_at": response.stock_verified_at.isoformat(),
                        "is_unresponsive": response.is_unresponsive,
                        "last_refresh_requested_at": response.last_refresh_requested_at,
                    }
                }
            )
            try:
                
                WSEventLog.objects.create(
                    event_id=_eid, event_type='stock_verified',
                    user_id=response.user.id, response_id=response.id,
                    payload={"response_id": response.id, "seq": response.response_version}
                )
            except Exception:
                pass

            send_user_app_notification(
                response.user,
                title="Stock re-verified",
                body=f"{response.store.name} just verified their stock. The offer is ready for you to accept.",
                data={"response_id": response.id, "type": "STOCK_VERIFIED"},
                dedupe_key=f"user:{response.user.id}:response:{response.id}:stock_verified",
            )

            return Response({
                "message": "Stock successfully verified.",
                "stock_verified_at": response.stock_verified_at
            }, status=200)

        except PrescriptionResponse.DoesNotExist:
            return Response({"error": "Response not found for this prescription."}, status=404)

class RequestStockRefreshView(APIView):
    authentication_classes = [UserTokenAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request, response_id):
        # 🛡️ Loop Closure: The patient triggers a re-verification request
        try:
            with transaction.atomic():
                response = PrescriptionResponse.objects.select_for_update().get(id=response_id)
                validate_action_capability(Permission.ENQUIRY, actor=request.user, resource=response)
                
                # 🛑 Rate Limit Check: 1 request every 5 minutes
                if response.last_refresh_requested_at:
                    time_since = timezone.now() - response.last_refresh_requested_at
                    if time_since.total_seconds() < 300: # 5 minutes
                        return Response({
                            "error": "Refresh already requested recently.",
                            "cooldown_seconds": 300 - int(time_since.total_seconds())
                        }, status=429)

                response.last_refresh_requested_at = timezone.now()
                response.save()

                # ⚡ Real-Time WebSocket Broadcast
                _eid = str(uuid.uuid4())
                channel_layer = get_channel_layer()
                async_to_sync(channel_layer.group_send)(
                    f"user_{response.user.id}_fulfillment",
                    {
                        "type": "fulfillment_update",
                        "event_id": _eid,
                        "seq": response.response_version,
                        "data": {
                            "response_id": response.id,
                            "last_refresh_requested_at": response.last_refresh_requested_at.isoformat(),
                        }
                    }
                )
                try:
                    
                    WSEventLog.objects.create(
                        event_id=_eid, event_type='refresh_requested',
                        user_id=response.user.id, response_id=response.id,
                        payload={"response_id": response.id, "seq": response.response_version}
                    )
                except Exception:
                    pass

                if response.store:
                    _safe_on_commit(
                        "stock refresh store notification",
                        lambda response=response: send_store_app_notification(
                            response.store,
                            title="Stock refresh requested",
                            body=f"Patient is interested in your quote for Prescription #{response.prescription_id} but needs fresh verification. Please update stock status within 10 mins.",
                            data={"response_id": response.id, "type": "REFRESH_REQUEST"},
                            dedupe_key=f"store:{response.store.id}:response:{response.id}:refresh_request",
                        )
                    )
                
                # ⏲️ Accountability Task: Check back in 10 minutes
                enforce_pharmacist_accountability.apply_async((response_id,), countdown=600)

                # 🚀 Fast WS Update to Store: Pharmacist Accountability Wait Loop
                channel_layer = get_channel_layer()
                async_to_sync(channel_layer.group_send)(
                    f"store_{response.store.id}_fulfillment",
                    {
                        "type": "fulfillment_update",
                        "event_id": str(uuid.uuid4()),
                        "seq": response.response_version,
                        "action": "refresh_request",
                        "data": {
                            "response_id": response.id,
                            "last_refresh_requested_at": response.last_refresh_requested_at.isoformat() if response.last_refresh_requested_at else None,
                            "is_unresponsive": response.is_unresponsive,
                            "total_amount": str(response.total_amount) if response.total_amount else None,
                            "quotation_scenario": response.quotation_scenario,
                            "distance_km": float(response.distance_km) if response.distance_km else None
                        }
                    }
                )

                return Response({"message": "Stock refresh requested successfully."}, status=200)

        except PrescriptionResponse.DoesNotExist:
            return Response({"error": "Response not found"}, status=404)


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 🚦 CANCEL ORDER FLOW — Zomato-style
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

class UserCancelOrderView(APIView):
    """
    User cancels their order.
    Rules:
      PENDING   → Free cancel (dismissed)
      ACCEPTED  → Free if < 5 min, else warning (still allowed)
      PROCESSING → Allowed with mandatory reason
      LOCKED    → Blocked (walk-in only: contact store)
      COMPLETED → Blocked
    """
    authentication_classes = [UserTokenAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request, response_id):
        reason = request.data.get('reason', '')

        try:
            with transaction.atomic():
                response = PrescriptionResponse.objects.select_for_update().get(
                    id=response_id, user=request.user
                )

                status = response.user_status

                # ❌ LOCKED — block (unless walk-in)
                if status == 'locked':
                    if response.delivery_option == 'walk_in':
                        # Walk-in: user just doesn't show up — soft cancel allowed
                        pass
                    else:
                        return Response({
                            "error": "Order cannot be cancelled at this stage. Please contact the store.",
                            "contact": response.store_contact
                        }, status=400)

                # ❌ COMPLETED
                if status == 'completed':
                    return Response({"error": "Completed orders cannot be cancelled."}, status=400)
                if status == 'cancelled':
                    return Response({"message": "Order is already cancelled."}, status=200)

                # ⚠️ PROCESSING — reason mandatory
                if status == 'processing' and not reason:
                    return Response({
                        "error": "reason_required",
                        "message": "Order is being processed. Please provide a reason for cancellation."
                    }, status=400)

                # ⚠️ ACCEPTED — check 5-min grace period
                grace_expired = False
                if status == 'accepted' and response.accepted_at:
                    elapsed = (timezone.now() - response.accepted_at).total_seconds()
                    if elapsed > 300:  # 5 minutes
                        grace_expired = True

                # ✅ Cancel the order
                response.user_status = 'cancelled'
                response.cancelled_by = 'user'
                response.cancel_reason = reason or ('Cancelled during grace period' if not grace_expired else reason)
                response.save(user_context=request.user)
                release_assigned_delivery_person(response)

                # ⚡ Real-Time WebSocket Broadcast
                _eid = str(uuid.uuid4())
                channel_layer = get_channel_layer()
                async_to_sync(channel_layer.group_send)(
                    f"user_{response.user.id}_fulfillment",
                    {
                        "type": "fulfillment_update",
                        "event_id": _eid,
                        "seq": response.response_version,
                        "data": {
                            "response_id": response.id,
                            "user_status": response.user_status,
                            "cancelled_by": response.cancelled_by,
                            "cancel_reason": response.cancel_reason,
                        }
                    }
                )
                try:
                    WSEventLog.objects.create(
                        event_id=_eid, event_type='user_cancelled',
                        user_id=response.user.id, response_id=response.id,
                        payload={"user_status": response.user_status, "seq": response.response_version}
                    )
                except Exception:
                    pass

                if response.store:
                    _safe_on_commit(
                        "user cancel store notification",
                        lambda response=response, reason=reason: send_store_app_notification(
                            response.store,
                            title="Order cancelled by patient",
                            body=f"Patient cancelled order for Prescription #{response.prescription_id}." + (f" Reason: {reason}" if reason else ""),
                            data={"response_id": response.id, "type": "ORDER_CANCELLED_BY_USER"},
                            dedupe_key=f"store:{response.store.id}:response:{response.id}:cancelled_by_user",
                        )
                    )

                return Response({
                    "message": "Order cancelled successfully.",
                    "grace_expired": grace_expired,
                    "cancelled_by": "user"
                }, status=200)

        except PrescriptionResponse.DoesNotExist:
            return Response({"error": "Response not found."}, status=404)


class StoreCancelOrderView(APIView):
    """
    Store cancels the order.
    Rules:
      ACCEPTED/PROCESSING → Allowed with mandatory reason
      LOCKED              → Rare, allowed with strong reason
      COMPLETED           → Blocked
    """
    authentication_classes = [StoreTokenAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request, response_id):
        reason = request.data.get('reason', '').strip()

        if not reason:
            return Response({
                "error": "Reason is mandatory for cancellation.",
            }, status=400)

        try:
            with transaction.atomic():
                # 🧠 Smart Lookup: Check if ID is Response ID or Prescription ID
                response = PrescriptionResponse.objects.select_for_update().filter(
                    Q(id=response_id) | Q(prescription_id=response_id, store=request.user),
                    store=request.user
                ).first()

                if not response:
                    # 🚀 Edge Case: Pharmacist wants to cancel/dismiss before quoting
                    # We create a 'dismissed' entry so they don't see it again.
                    prescription = Prescription.objects.get(id=response_id)
                    response = PrescriptionResponse.objects.create(
                        prescription=prescription,
                        store=request.user,
                        user=prescription.user,
                        user_status='dismissed', # or 'rejected'
                        cancelled_by='store',
                        cancel_reason=reason,
                        store_name=request.user.name,
                        store_contact=request.user.mobile
                    )
                    return Response({"message": "Enquiry dismissed successfully."}, status=200)

                status = response.user_status

                # ❌ COMPLETED
                if status == 'completed':
                    return Response({"error": "Completed orders cannot be cancelled."}, status=400)
                if status == 'cancelled':
                    return Response({"message": "Order is already cancelled."}, status=200)

                # ✅ Cancel
                response.user_status = 'cancelled'
                response.cancelled_by = 'store'
                response.cancel_reason = reason
                response.save(user_context=request.user)
                release_assigned_delivery_person(response)

                # ⚡ Real-Time WebSocket Broadcast
                _eid = str(uuid.uuid4())
                channel_layer = get_channel_layer()
                async_to_sync(channel_layer.group_send)(
                    f"user_{response.user.id}_fulfillment",
                    {
                        "type": "fulfillment_update",
                        "event_id": _eid,
                        "seq": response.response_version,
                        "data": {
                            "response_id": response.id,
                            "user_status": response.user_status,
                            "cancelled_by": response.cancelled_by,
                            "cancel_reason": response.cancel_reason,
                        }
                    }
                )
                try:
                    WSEventLog.objects.create(
                        event_id=_eid, event_type='store_cancelled',
                        user_id=response.user.id, response_id=response.id,
                        payload={"user_status": response.user_status, "seq": response.response_version}
                    )
                except Exception:
                    pass

                if response.user:
                    _safe_on_commit(
                        "store cancel user notification",
                        lambda response=response, reason=reason: send_user_app_notification(
                            response.user,
                            title="Order cancelled by store",
                            body=f"{response.store_name} cancelled your order. Reason: {reason}",
                            data={"response_id": response.id, "type": "ORDER_CANCELLED_BY_STORE"},
                            dedupe_key=f"user:{response.user.id}:response:{response.id}:cancelled_by_store",
                        )
                    )

                return Response({
                    "message": "Order cancelled successfully.",
                    "cancelled_by": "store",
                    "reason": reason
                }, status=200)

        except PrescriptionResponse.DoesNotExist:
            return Response({"error": "Response not found."}, status=404)


# class StoreUpdateProgressView(APIView):
#     """
#     Store updates order progress:
#       action=start_processing → is_processing_started = True
#       action=mark_packed      → is_packed = True
#       action=mark_locked      → user_status = locked (almost irreversible)
#       action=mark_completed   → user_status = completed
#     """
#     authentication_classes = [StoreTokenAuthentication]
#     permission_classes = [IsAuthenticated]

#     def post(self, request, response_id):
#         action = request.data.get('action')
#         VALID_ACTIONS = ['start_processing', 'mark_packed', 'mark_locked', 'mark_completed']

#         if action not in VALID_ACTIONS:
#             return Response({"error": f"Invalid action. Choose from: {VALID_ACTIONS}"}, status=400)

#         try:
#             with transaction.atomic():
#                 # 🧠 Smart Lookup: Response ID or Prescription ID
#                 response = PrescriptionResponse.objects.select_for_update().filter(
#                     Q(id=response_id) | Q(prescription_id=response_id),
#                     store=request.user
#                 ).first()

#                 if not response:
#                     return Response({"error": "Order response not found."}, status=404)

#                 # State mapping for FSM
#                 if action == 'start_processing':
#                     response.is_processing_started = True
#                     response.user_status = 'processing'
#                 elif action == 'mark_packed':
#                     response.is_packed = True
#                 elif action == 'mark_locked':
#                     response.user_status = 'locked'
#                 elif action == 'mark_completed':
#                     response.user_status = 'completed'

#                 response.save(user_context=request.user) # 🛡️ Triggers FSM validation in models.py
            
#             # ✅ FIXED: Broadcast OUTSIDE transaction so DB lock releases BEFORE
#             # network I/O. Critical for PgBouncer transaction mode — prevents
#             # WS disconnect on rapid clicks.
#             self._broadcast_to_user(response, action)

#             # 🔔 Notifications (Async via Celery)
#             self._send_progress_notifications(response, action)

#             return Response({
#                 "message": f"Action '{action}' applied successfully.",
#                 "user_status": response.user_status,
#                 "is_processing_started": response.is_processing_started,
#                 "is_packed": response.is_packed,
#                 "is_locked": response.is_locked,
#             }, status=200)

#         except ValidationError as e:
#             return Response({"error": str(e.message if hasattr(e, 'message') else e)}, status=400)
#         except Exception as e:
#             import traceback
#             tb = traceback.format_exc()
#             print(tb)
#             return Response({"error": f"Unexpected error: {str(e)}\n\n{tb}"}, status=500)


#     def _broadcast_to_user(self, response, action):
#         """Broadcast progress update to user via WebSocket and log the event."""
#         _eid = str(uuid.uuid4())
#         channel_layer = get_channel_layer()
#         async_to_sync(channel_layer.group_send)(
#             f"user_{response.user.id}_fulfillment",
#             {
#                 "type": "fulfillment_update",
#                 "event_id": _eid,
#                 "seq": response.response_version,
#                 "action": action,
#                 "data": {
#                     "response_id": response.id,
#                     "user_status": response.user_status,
#                     "is_processing_started": response.is_processing_started,
#                     "is_packed": response.is_packed,
#                     "is_locked": response.is_locked,
#                     "updated_at": response.updated_at.isoformat()
#                 }
#             }
#         )
#         try:
#             from .models import WSEventLog
#             WSEventLog.objects.create(
#                 event_id=_eid, event_type='progress_update',
#                 user_id=response.user.id, response_id=response.id,
#                 payload={"action": action, "user_status": response.user_status, "seq": response.response_version}
#             )
#         except Exception: pass

#     def _send_progress_notifications(self, response, action):
#         """Send push notifications for specific progress milestones."""
#         if action in ('mark_locked', 'mark_completed') and response.user.expo_push_token:
#             from .tasks import send_push_task
#             msgs = {
#                 'mark_locked': ("🚀 Order Ready!", f"Your medicine is ready at {response.store_name}!"),
#                 'mark_completed': ("✅ Order Completed", f"Your order from {response.store_name} is complete."),
#             }
#             title, body = msgs[action]
#             send_push_task.delay(
#                 response.user.expo_push_token, title=title, body=body,
#                 data={"response_id": response.id, "type": action.upper()}
#             )

class StoreUpdateProgressView(APIView):
    """
    Store updates order progress:
      action=start_processing → is_processing_started = True
      action=mark_packed      → is_packed = True
      action=mark_locked      → user_status = locked (almost irreversible)
      action=mark_completed   → user_status = completed
    """
    authentication_classes = [StoreTokenAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request, response_id):
        action = request.data.get('action')
        delivery_person_id = request.data.get('delivery_person_id')
        VALID_ACTIONS = ['start_processing', 'mark_packed', 'mark_locked', 'mark_completed']

        if action not in VALID_ACTIONS:
            return Response({"error": f"Invalid action. Choose from: {VALID_ACTIONS}"}, status=400)

        try:
            with transaction.atomic():
                # 🧠 Smart Lookup: Try Response ID first, then fallback to Prescription ID
                response = PrescriptionResponse.objects.select_for_update().filter(
                    Q(id=response_id) | Q(prescription_id=response_id),
                    store=request.user
                ).first()

                if not response:
                    return Response({"error": "Order response not found."}, status=404)

                validate_action_capability(Permission.PLACE_ORDER, actor=request.user, resource=response)

                if response.user_status in ('cancelled', 'completed'):
                    return Response({"error": "Cannot update a cancelled or completed order."}, status=400)

                previous_progress_state = {
                    "is_processing_started": response.is_processing_started,
                    "is_packed": response.is_packed,
                    "is_locked": response.is_locked,
                    "user_status": response.user_status,
                }

                if action == 'start_processing':
                    response.is_processing_started = True
                    response.user_status = 'processing'

                elif action == 'mark_packed':
                    response.is_packed = True

                elif action == 'mark_locked':
                    if response.delivery_option == 'online':
                        if not delivery_person_id:
                            delivery_person_id = StoreDeliveryPerson.objects.filter(
                                store=request.user,
                                is_active=True,
                                is_available=True,
                                current_order_count__lt=F('max_concurrent_orders'),
                            ).order_by('current_order_count', 'last_assigned_at', 'id').values_list('id', flat=True).first()
                        if delivery_person_id:
                            try:
                                person = StoreDeliveryPerson.objects.select_for_update().get(
                                    id=delivery_person_id,
                                    store=request.user,
                                    is_active=True,
                                    is_available=True,
                                )
                            except StoreDeliveryPerson.DoesNotExist:
                                return Response({"error": "Selected delivery person is not available."}, status=400)
                            if person.current_order_count >= person.max_concurrent_orders:
                                return Response({"error": "Selected delivery person has reached the order limit."}, status=409)
                            try:
                                offer = response.delivery_offer
                            except QuoteDeliveryOffer.DoesNotExist:
                                offer = None
                            if offer:
                                if offer.assigned_delivery_person_id:
                                    if offer.assigned_delivery_person_id == person.id:
                                        response.user_status = 'out_for_delivery'
                                        response.is_locked = True
                                        response.locked_at = response.locked_at or timezone.now()
                                        response.save()
                                        return Response({
                                            "message": "Order is already assigned to this delivery person.",
                                            "user_status": response.user_status,
                                            "is_locked": response.is_locked,
                                        }, status=200)
                                    return Response({"error": "A delivery person is already assigned to this order."}, status=409)
                                offer.assigned_delivery_person = person
                                offer.save(update_fields=['assigned_delivery_person', 'updated_at'])
                                person.current_order_count += 1
                                person.last_assigned_at = timezone.now()
                                person.save(update_fields=['current_order_count', 'last_assigned_at', 'updated_at'])
                        response.user_status = 'out_for_delivery'
                    else:
                        response.user_status = 'locked'
                    
                    response.is_locked = True
                    response.locked_at = timezone.now()

                elif action == 'mark_completed':
                    if response.user_status not in ('locked', 'out_for_delivery') and not response.is_locked:
                        return Response({"error": "Order must be ready before requesting completion OTP."}, status=400)

                    otp_code = f"{random.randint(100000, 999999)}"
                    otp, _ = DeliveryOTP.objects.update_or_create(
                        response=response,
                        defaults={
                            "otp_code": otp_code,
                            "is_used": False,
                            "attempts": 0,
                        }
                    )
                    otp.created_at = timezone.now()
                    otp.save(update_fields=["otp_code", "is_used", "attempts", "created_at"])
                    response.save(user_context=request.user)

                    # Send only after the OTP transaction commits, using the
                    # exact same code saved above and exposed in the buyer app.
                    _safe_on_commit(
                        "completion OTP email",
                        lambda email=response.user.email,
                        code=otp.otp_code,
                        store_name=response.store_name: _send_completion_otp_email(
                            email,
                            code,
                            store_name,
                        )
                    )
                    _safe_on_commit(
                        "completion OTP WhatsApp",
                        lambda mobile=response.user.mobile,
                        code=otp.otp_code: _send_whatsapp_otp(
                            mobile,
                            code,
                            settings.WHATSAPP_COMPLETION_OTP_TEMPLATE,
                        )
                    )

                    _eid = str(uuid.uuid4())
                    channel_layer = get_channel_layer()
                    async_to_sync(channel_layer.group_send)(
                        f"user_{response.user.id}_fulfillment",
                        {
                            "type": "fulfillment_update",
                            "event_id": _eid,
                            "seq": response.response_version,
                            "action": "completion_otp_requested",
                            "data": {
                                "response_id": response.id,
                                "id": response.id,
                                "user_status": response.user_status,
                                "completion_otp_requested": True,
                                "completion_otp": otp.otp_code,
                                "completion_otp_expires_at": otp.expires_at.isoformat(),
                                "updated_at": response.updated_at.isoformat(),
                            }
                        }
                    )
                    try:
                        WSEventLog.objects.create(
                            event_id=_eid, event_type='completion_otp_requested',
                            user_id=response.user.id, response_id=response.id,
                            payload={"action": "completion_otp_requested", "response_id": response.id}
                        )
                    except Exception:
                        pass

                    _queue_user_order_progress_push(response, 'completion_otp_requested')

                    return Response({
                        "message": "Completion OTP sent to the customer.",
                        "otp_required": True,
                        "response_id": response.id,
                        "completion_otp_expires_at": otp.expires_at.isoformat(),
                    }, status=202)

                response.save()
                
                # 💥 INVALIDATE CACHE for this store
                from django.core.cache import cache
                try:
                    cache.incr(f"store_{request.user.id}_cache_version")
                except ValueError:
                    cache.set(f"store_{request.user.id}_cache_version", 1, timeout=86400 * 30)

                # ⚡ Real-Time WebSocket Broadcast
                _eid = str(uuid.uuid4())
                channel_layer = get_channel_layer()
                async_to_sync(channel_layer.group_send)(
                    f"user_{response.user.id}_fulfillment",
                    {
                        "type": "fulfillment_update",
                        "event_id": _eid,
                        "seq": response.response_version,
                        "action": "status_change",
                        "data": {
                            "response_id": response.id,
                            "user_status": response.user_status,
                            "delivery_option": response.delivery_option,
                            "is_processing_started": response.is_processing_started,
                            "is_packed": response.is_packed,
                            "is_locked": response.is_locked,
                            "response_version": response.response_version,
                            "updated_at": response.updated_at.isoformat(),
                            "accepted_at": response.accepted_at.isoformat() if response.accepted_at else None,
                            "processing_at": response.processing_at.isoformat() if response.processing_at else None,
                            "locked_at": response.locked_at.isoformat() if response.locked_at else None,
                            "completed_at": response.completed_at.isoformat() if response.completed_at else None,
                        }
                    }
                )
                try:
                    WSEventLog.objects.create(
                        event_id=_eid, event_type='progress_update',
                        user_id=response.user.id, response_id=response.id,
                        payload={"action": action, "user_status": response.user_status, "seq": response.response_version}
                    )
                except Exception:
                    pass

                should_notify_progress = (
                    (action == 'start_processing' and not previous_progress_state["is_processing_started"])
                    or (action == 'mark_packed' and not previous_progress_state["is_packed"])
                    or (
                        action == 'mark_locked'
                        and (
                            not previous_progress_state["is_locked"]
                            or previous_progress_state["user_status"] not in ('locked', 'out_for_delivery')
                        )
                    )
                )
                if should_notify_progress:
                    _queue_user_order_progress_push(response, action)

                return Response({
                    "message": f"Action '{action}' applied successfully.",
                    "user_status": response.user_status,
                    "is_processing_started": response.is_processing_started,
                    "is_packed": response.is_packed,
                    "is_locked": response.is_locked,
                }, status=200)

        except PrescriptionResponse.DoesNotExist:
            return Response({"error": "Response not found."}, status=404)


class OrderAgainView(APIView):
    authentication_classes = [UserTokenAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request, response_id):
        scope = request.data.get('scope') or request.data.get('reorder_scope') or 'all_stores'
        if scope not in ('preferred_only', 'all_stores'):
            return Response({"error": "scope must be preferred_only or all_stores."}, status=400)

        try:
            response = PrescriptionResponse.objects.select_related(
                'prescription', 'user', 'store'
            ).prefetch_related('medicines').get(id=response_id, user=request.user)
        except PrescriptionResponse.DoesNotExist:
            return Response({"error": "Completed order not found."}, status=404)

        if response.user_status != 'completed':
            return Response({"error": "Only completed orders can be ordered again."}, status=400)

        try:
            prescription, dispatch = create_order_again_request(response, scope=scope)
        except ValueError as exc:
            return Response({"error": str(exc)}, status=400)

        return Response({
            "message": "New prescription request created. Stores can send fresh quotes.",
            "prescription_id": prescription.id,
            "source_response_id": response.id,
            "preferred_store_id": response.store_id,
            "preferred_store_name": response.store.name if response.store else None,
            "scope": scope,
            "dispatch": dispatch,
        }, status=201)


class VerifyCompletionOTPView(APIView):
    authentication_classes = [StoreTokenAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request, response_id):
        otp_input = str(request.data.get('otp', '')).strip()
        if not otp_input:
            return Response({"error": "OTP is required."}, status=400)

        try:
            with transaction.atomic():
                response = PrescriptionResponse.objects.select_for_update().filter(
                    Q(id=response_id) | Q(prescription_id=response_id),
                    store=request.user
                ).first()

                if not response:
                    return Response({"error": "Order response not found."}, status=404)

                validate_action_capability(Permission.PLACE_ORDER, actor=request.user, resource=response)

                if response.user_status == 'completed':
                    return Response({"message": "Order is already completed."}, status=200)

                if response.user_status not in ('locked', 'out_for_delivery') and not response.is_locked:
                    return Response({"error": "Order must be ready before completion."}, status=400)

                try:
                    otp = response.delivery_otp
                except DeliveryOTP.DoesNotExist:
                    return Response({"error": "No active completion OTP found. Request OTP first."}, status=400)

                if otp.is_used:
                    return Response({"error": "OTP has already been used."}, status=400)

                if otp.is_expired:
                    return Response({"error": "OTP has expired. Request a new OTP."}, status=400)

                if otp.attempts >= 5:
                    return Response({"error": "Too many incorrect attempts. Request a new OTP."}, status=400)

                if otp.otp_code != otp_input:
                    otp.attempts += 1
                    otp.save(update_fields=["attempts"])
                    return Response({
                        "error": "Invalid OTP.",
                        "attempts_remaining": max(0, 5 - otp.attempts)
                    }, status=400)

                otp.is_used = True
                otp.save(update_fields=["is_used"])

                response.user_status = 'completed'
                response.completed_by_store = request.user
                response.save(user_context=request.user)
                release_assigned_delivery_person(response)

                try:
                    cache.incr(f"store_{request.user.id}_cache_version")
                except ValueError:
                    cache.set(f"store_{request.user.id}_cache_version", 1, timeout=86400 * 30)

            self._broadcast_completion(response)

            _queue_user_order_progress_push(response, 'mark_completed')

            return Response({
                "message": "Order completed successfully.",
                "user_status": response.user_status,
                "completed_at": response.completed_at.isoformat() if response.completed_at else None,
            }, status=200)

        except ValidationError as e:
            return Response({"error": str(e.message if hasattr(e, 'message') else e)}, status=400)

    def _broadcast_completion(self, response):
        channel_layer = get_channel_layer()
        event_id = str(uuid.uuid4())
        payload = {
            "response_id": response.id,
            "id": response.id,
            "user_status": response.user_status,
            "is_locked": response.is_locked,
            "completed_at": response.completed_at.isoformat() if response.completed_at else None,
            "completion_otp": None,
            "completion_otp_requested": False,
            "completion_otp_expires_at": None,
            "response_version": response.response_version,
            "updated_at": response.updated_at.isoformat(),
        }
        async_to_sync(channel_layer.group_send)(
            f"user_{response.user.id}_fulfillment",
            {
                "type": "fulfillment_update",
                "event_id": event_id,
                "seq": response.response_version,
                "action": "status_change",
                "data": payload
            }
        )
        if response.store_id:
            async_to_sync(channel_layer.group_send)(
                f"store_{response.store_id}_fulfillment",
                {
                    "type": "fulfillment_update",
                    "event_id": str(uuid.uuid4()),
                    "seq": response.response_version,
                    "action": "status_change",
                    "data": payload
                }
            )
        try:
            WSEventLog.objects.create(
                event_id=event_id, event_type='completion_verified',
                user_id=response.user.id, response_id=response.id,
                payload={"action": "completion_verified", "response_id": response.id, "seq": response.response_version}
            )
        except Exception:
            pass


class StoreDashboardSummaryView(APIView):
    authentication_classes = [StoreTokenAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        store = request.user
        now = timezone.now()
        
        start_date_str = request.query_params.get("start_date")
        end_date_str = request.query_params.get("end_date")
        
        today = timezone.localtime(now, LOCAL_DATE_TZ).date()
        
        try:
            if start_date_str and end_date_str:
                from django.utils.dateparse import parse_date
                start_date = parse_date(start_date_str)
                end_date = parse_date(end_date_str)
                if not start_date or not end_date:
                    start_date = end_date = today
                start_datetime, end_datetime = get_local_day_bounds(start_date, end_date)
            else:
                start_datetime, end_datetime = get_local_day_bounds(today, today)
        except Exception:
            start_datetime, end_datetime = get_local_day_bounds(today, today)


        base_qs = PrescriptionResponse.objects.filter(store=store)
        active_qs = base_qs.exclude(user_status__in=['completed', 'cancelled', 'expired', 'dismissed', 'rejected'])

        otp_q = Q(delivery_otp__isnull=False, delivery_otp__is_used=False, delivery_otp__created_at__gt=now - timedelta(minutes=10), delivery_otp__attempts__lt=5)
        delivery_q = Q(user_status='out_for_delivery') | (Q(is_locked=True) & Q(delivery_option='online'))
        ready_q = (Q(user_status='locked') | Q(is_locked=True)) & ~Q(delivery_option='online')
        packed_q = Q(is_packed=True) & ~Q(is_locked=True) & ~Q(user_status__in=['locked', 'out_for_delivery'])
        billing_q = (Q(is_processing_started=True) | Q(user_status='processing')) & Q(is_packed=False)
        new_q = Q(user_status='accepted') & Q(is_processing_started=False) & Q(is_packed=False) & Q(is_locked=False) & ~otp_q

        workload = {
            'new': active_qs.filter(new_q).count(),
            'billing': active_qs.filter(billing_q).count(),
            'packed': active_qs.filter(packed_q).count(),
            'ready': active_qs.filter(ready_q & ~otp_q).count(),
            'delivery': active_qs.filter(delivery_q & ~otp_q).count(),
            'otp': active_qs.filter(otp_q).count(),
        }
        workload['active'] = sum(workload.values())

        today_completed_qs = base_qs.filter(user_status='completed', completed_at__gte=start_datetime, completed_at__lt=end_datetime)
        today_cancelled_qs = base_qs.filter(user_status='cancelled', updated_at__gte=start_datetime, updated_at__lt=end_datetime)
        today_orders_qs = base_qs.filter(accepted_at__gte=start_datetime, accepted_at__lt=end_datetime)
        revenue = today_completed_qs.aggregate(total=Sum('total_amount'))['total'] or Decimal('0')

        def minutes_since(dt):
            if not dt:
                return 0
            return max(0, int((now - dt).total_seconds() // 60))

        attention = []
        seen_ids = set()

        def attention_image_url(item):
            image = item.image or getattr(item.prescription, 'image', None)
            if not image:
                return None
            return get_file_url(image, request)

        def add_attention(qs, reason, stage, since_field, threshold, icon):
            nonlocal attention, seen_ids
            if len(attention) >= 5:
                return
            for item in qs.select_related('user', 'prescription').order_by(since_field)[:10]:
                if item.id in seen_ids:
                    continue
                since = getattr(item, since_field.lstrip('-'), None)
                minutes = minutes_since(since or item.updated_at)
                if minutes < threshold:
                    continue
                seen_ids.add(item.id)
                attention.append({
                    'id': item.id,
                    'response_id': item.id,
                    'patient': getattr(item.user, 'name', None) or getattr(item.user, 'full_name', None) or 'Patient',
                    'reason': reason,
                    'stage': stage,
                    'minutes': minutes,
                    'icon': icon,
                    'image': attention_image_url(item),
                })
                if len(attention) >= 5:
                    return

        add_attention(active_qs.filter(otp_q), 'OTP verification pending', 'OTP', 'updated_at', 0, 'shield-key-outline')
        add_attention(active_qs.filter(new_q), 'New enquiry waiting', 'NEW', 'accepted_at', 10, 'bell-ring-outline')
        add_attention(active_qs.filter(billing_q), 'Billing stuck', 'BILLING', 'processing_at', 20, 'script-text-outline')
        add_attention(active_qs.filter(packed_q), 'Packed order waiting', 'PACKED', 'updated_at', 15, 'package-variant-closed')
        add_attention(active_qs.filter(delivery_q), 'Delivery delay', 'DELIVERY', 'locked_at', 30, 'truck-delivery-outline')
        add_attention(active_qs.filter(ready_q), 'Pickup waiting', 'READY', 'locked_at', 20, 'store-clock-outline')

        reported_ids = set(StoreReportNote.objects.filter(response__store=store).values_list('response_id', flat=True)[:20])
        reported_ids.update(ReportNote.objects.filter(response__store=store).values_list('response_id', flat=True)[:20])
        if len(attention) < 5 and reported_ids:
            for item in active_qs.filter(id__in=reported_ids).select_related('user', 'prescription').order_by('-updated_at')[:5]:
                if item.id in seen_ids:
                    continue
                seen_ids.add(item.id)
                attention.append({
                    'id': item.id,
                    'response_id': item.id,
                    'patient': getattr(item.user, 'name', None) or getattr(item.user, 'full_name', None) or 'Patient',
                    'reason': 'Reported issue',
                    'stage': {
                        'accepted': 'NEW',
                        'processing': 'BILLING',
                        'locked': 'READY',
                        'out_for_delivery': 'DELIVERY',
                    }.get(item.user_status, 'ACTIVE'),
                    'minutes': minutes_since(item.updated_at),
                    'icon': 'flag-outline',
                    'image': attention_image_url(item),
                })
                if len(attention) >= 5:
                    break

        return Response({
            'date': today.isoformat(),
            'today': {
                'orders': today_orders_qs.count(),
                'revenue': float(revenue),
                'completed': today_completed_qs.count(),
                'cancelled': today_cancelled_qs.count(),
            },
            'workload': workload,
            'attention': attention,
            'store': {
                'is_online': getattr(store, 'is_online', False),
                'is_active': getattr(store, 'is_active', False),
                'is_verified': getattr(store, 'is_verified', False),
            }
        })


class StoreSubmittedResponsesView(APIView):
    authentication_classes = [StoreTokenAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        store = request.user

        start_date_str = request.query_params.get("start_date")
        end_date_str = request.query_params.get("end_date")

        # 🚀 Production Optimization: Queryset Optimization (O(1))
        # Prefetch medicines and prescriptions to avoid N+1
        from django.db.models import Prefetch, Subquery, OuterRef
        
        # Prefetch medicines for each response
        medicines_prefetch = Prefetch('medicines', queryset=PrescriptionResponseMedicine.objects.all())
        
        # Find the latest report note IDs per response to prefetch only those
        latest_note_qs = StoreReportNote.objects.filter(response=OuterRef('pk')).order_by('-created_at').values('id')[:1]
        latest_user_note_qs = ReportNote.objects.filter(response=OuterRef('pk')).order_by('-created_at').values('id')[:1]

        from django.db.models import Prefetch, Subquery, OuterRef, Case, When, Value, IntegerField

        responses = PrescriptionResponse.objects.filter(store=store).select_related(
            'prescription', 'prescription__user', 'store'
        ).prefetch_related(
            medicines_prefetch
        ).annotate(
            latest_note_id=Subquery(latest_note_qs),
            latest_user_note_id=Subquery(latest_user_note_qs),
            is_emergency=Case(
                When(prescription__status='emergency', then=Value(0)),
                default=Value(1),
                output_field=IntegerField()
            )
        ).order_by('is_emergency', '-updated_at')

        # Filter by start_date and end_date if provided
        if start_date_str:
            try:
                start_date = datetime.strptime(start_date_str, "%Y-%m-%d").date()
                start_date, _ = get_local_day_bounds(start_date, start_date)
                responses = responses.filter(created_at__gte=start_date)
            except ValueError:
                return Response({"error": "Invalid start_date format. Use YYYY-MM-DD."}, status=400)

        if end_date_str:
            try:
                end_date = datetime.strptime(end_date_str, "%Y-%m-%d").date()
                _, end_date = get_local_day_bounds(end_date, end_date)
                responses = responses.filter(created_at__lt=end_date)
            except ValueError:
                return Response({"error": "Invalid end_date format. Use YYYY-MM-DD."}, status=400)
        responses = responses.order_by("-updated_at")
        # ✅ Use your custom pagination class here
        paginator = CustomPagination()
        result_page = paginator.paginate_queryset(responses, request)

        # Attach report metadata to the exact objects being serialized.
        page_note_ids = [r.latest_note_id for r in result_page if r.latest_note_id]
        page_user_note_ids = [r.latest_user_note_id for r in result_page if r.latest_user_note_id]
        page_notes_map = {n.id: n.note for n in StoreReportNote.objects.filter(id__in=page_note_ids)}
        page_user_notes_map = {n.id: n.note for n in ReportNote.objects.filter(id__in=page_user_note_ids)}
        page_store_report_counts = defaultdict(int)
        for row in StoreReportNote.objects.filter(response__in=result_page).values('response_id').annotate(count=Count('id')):
            page_store_report_counts[row['response_id']] = row['count']
        page_user_report_counts = defaultdict(int)
        for row in ReportNote.objects.filter(response__in=result_page).values('response_id').annotate(count=Count('id')):
            page_user_report_counts[row['response_id']] = row['count']

        for r in result_page:
            r.prefetched_store_note = page_notes_map.get(r.latest_note_id)
            r.prefetched_user_report_note = page_user_notes_map.get(r.latest_user_note_id)
            r.prefetched_store_report_count = page_store_report_counts[r.id]
            r.prefetched_user_report_count = page_user_report_counts[r.id]

        # 💬 Resolve Chat Threads
        chat_threads = ChatThread.objects.filter(
            store=store,
            prescription_id__in=[r.prescription_id for r in result_page],
            user_id__in=[r.user_id for r in result_page]
        )
        chat_map = {(t.user_id, t.prescription_id): t.id for t in chat_threads}
        for r in result_page:
            r.chat_thread_id = chat_map.get((r.user_id, r.prescription_id))

        serializer = PrescriptionResponseSerializer(result_page, many=True, context={'request': request})

        return paginator.get_paginated_response(serializer.data)

class StoreSubmittedResponseDetailView(RetrieveAPIView):
    authentication_classes = [StoreTokenAuthentication]
    permission_classes = [IsAuthenticated]
    serializer_class = PrescriptionResponseSerializer

    def get(self, request, *args, **kwargs):
        store = request.user
        response_id = kwargs.get("id")

        try:
            response = PrescriptionResponse.objects.get(id=response_id, store=store)
        except PrescriptionResponse.DoesNotExist:
            return Response({"error": "Response not found."}, status=status.HTTP_404_NOT_FOUND)

        serializer = self.serializer_class(response)
        return Response(serializer.data, status=status.HTTP_200_OK)
# class GetResponsesForUserPrescription(APIView):
#     authentication_classes = [UserTokenAuthentication]  # Assuming User is authenticated via Token
#     permission_classes = [IsAuthenticated]
#     # 👇 REMOVE this line if you don’t want pagination at all
#     # pagination_class = CustomPagination

#     def get(self, request, *args, **kwargs):
#         user_id = kwargs.get('user_id')
#         user = request.user  # The currently authenticated user

#         if user.id != int(user_id):
#             return Response({"error": "You are not authorized to view this user's responses."}, status=403)

#         try:
#             target_user = User.objects.get(id=user_id)
#         except User.DoesNotExist:
#             return Response({"error": "Target user not found."}, status=404)

#         # Get all responses for prescriptions belonging to the target user
#         responses = PrescriptionResponse.objects.filter(prescription__user=target_user)

#         # Searching: Filter responses by response_text or store_name
#         search_query = request.query_params.get('search', None)
#         if search_query:
#             responses = responses.filter(
#                 Q(response_text__icontains=search_query) |
#                 Q(store_name__icontains=search_query)
#             )

#         # Sorting: Sort by created_at or any other field
#         sort_by = request.query_params.get('sort_by', 'created_at')  # Default sorting by created_at
#         responses = responses.order_by(f'-{sort_by}')  # Always newest first

#         # 👇 No pagination — serialize everything
#         response_data = PrescriptionResponseSerializer(responses, many=True).data

#         return Response({
#             "count": len(response_data),
#             "results": response_data
#         })
# class GetResponsesForUserPrescription(APIView):
#     authentication_classes = [UserTokenAuthentication]
#     permission_classes = [IsAuthenticated]

#     def get(self, request, *args, **kwargs):
#         user_id = kwargs.get('user_id')
#         user = request.user  # The currently authenticated user

#         if user.id != int(user_id):
#             return Response({"error": "You are not authorized to view this user's responses."}, status=403)

#         try:
#             target_user = User.objects.get(id=user_id)
#         except User.DoesNotExist:
#             return Response({"error": "Target user not found."}, status=404)

#         # Base queryset
#         responses = PrescriptionResponse.objects.filter(prescription__user=target_user)

#         # ✅ Filter by date range (created_at)
#         start_date_str = request.query_params.get("start_date")
#         end_date_str = request.query_params.get("end_date")

#         if start_date_str and end_date_str:
#             try:
#                 start_date = parse_date(start_date_str)
#                 end_date = parse_date(end_date_str)
#                 if start_date and end_date:
#                     start_datetime = make_aware(datetime.combine(start_date, datetime.min.time()))
#                     end_datetime = make_aware(datetime.combine(end_date + timedelta(days=1), datetime.min.time()))
#                     responses = responses.filter(created_at__range=(start_datetime, end_datetime))
#             except Exception as e:
#                 return Response({"error": f"Date filter error: {str(e)}"}, status=400)

#         # 🔍 Search filter
#         search_query = request.query_params.get('search', None)
#         if search_query:
#             responses = responses.filter(
#                 Q(response_text__icontains=search_query) |
#                 Q(store_name__icontains=search_query)
#             )

#         # ⬇️ Sort
#         sort_by = request.query_params.get('sort_by', 'created_at')
#         responses = responses.order_by(f'-{sort_by}')

#         # 🔢 Serialize
#         response_data = PrescriptionResponseSerializer(responses, many=True).data

#         return Response({
#             "count": len(response_data),
#             "results": response_data
#         })

# class GetResponsesForUserPrescription(APIView):
#     authentication_classes = [UserTokenAuthentication]
#     permission_classes = [IsAuthenticated]

#     def get(self, request, *args, **kwargs):
#         user_id = kwargs.get('user_id')
#         user = request.user

#         if user.id != int(user_id):
#             return Response({"error": "You are not authorized to view this user's responses."}, status=403)

#         try:
#             target_user = User.objects.get(id=user_id)
#         except User.DoesNotExist:
#             return Response({"error": "Target user not found."}, status=404)

#         # Base queryset
#         responses = PrescriptionResponse.objects.filter(prescription__user=target_user)

#         # Filter by date
#         start_date_str = request.query_params.get("start_date")
#         end_date_str = request.query_params.get("end_date")


#         if start_date_str and end_date_str:
#             try:
#                 start_date = parse_date(start_date_str)
#                 end_date = parse_date(end_date_str)
#                 if start_date and end_date:
#                     start_datetime = make_aware(datetime.combine(start_date, datetime.min.time()))
#                     end_datetime = make_aware(datetime.combine(end_date + timedelta(days=1), datetime.min.time()))
#                     responses = responses.filter(created_at__range=(start_datetime, end_datetime))
#             except Exception as e:
#                 return Response({"error": f"Date filter error: {str(e)}"}, status=400)

#         # Search
#         search_query = request.query_params.get('search')
#         if search_query:
#             responses = responses.filter(
#                 Q(response_text__icontains=search_query) |
#                 Q(store_name__icontains=search_query)
#             )

#         # Sorting
#         sort_by = request.query_params.get('sort_by', 'created_at')
#         responses = responses.order_by(f'-{sort_by}')

#         # Apply pagination
#         paginator = CustomPagination()
#         paginated_responses = paginator.paginate_queryset(responses, request)
#         serialized_data = PrescriptionResponseSerializer(paginated_responses, many=True).data

#         return paginator.get_paginated_response(serialized_data)
class GetResponsesForUserPrescription(APIView):
    authentication_classes = [UserTokenAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        user_id = kwargs.get('user_id')
        user = request.user

        if user.id != int(user_id):
            return Response({"error": "You are not authorized to view this user's responses."}, status=403)

        try:
            target_user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return Response({"error": "Target user not found."}, status=404)

        # Base queryset
        responses = PrescriptionResponse.objects.filter(prescription__user=target_user)

        # Date filter is opt-in. The offers screen is the source of truth for
        # missed WebSocket events, so defaulting to "today" can hide valid quotes
        # when timezones, delayed review, or older prescriptions are involved.
        start_date_str = request.query_params.get("start_date")
        end_date_str = request.query_params.get("end_date")

        try:
            if start_date_str and end_date_str:
                start_date = parse_date(start_date_str)
                end_date = parse_date(end_date_str)

                if not start_date or not end_date:
                    return Response({"error": "Invalid date format. Use YYYY-MM-DD."}, status=400)

                start_datetime, end_datetime = get_local_day_bounds(start_date, end_date)
                responses = responses.filter(updated_at__gte=start_datetime, updated_at__lt=end_datetime)
        except Exception as e:
            return Response({"error": f"Date filter error: {str(e)}"}, status=400)

        # 🔍 Search
        search_query = request.query_params.get('search')
        if search_query:
            responses = responses.filter(
                Q(response_text__icontains=search_query) |
                Q(store_name__icontains=search_query)
            )

        # ⏱️ Sorting
        sort_by = request.query_params.get('sort_by', 'updated_at')
        responses = responses.order_by(f'-{sort_by}')
        
        # 🏆 Ranking & Score Injection v4

        
        try:
            # 1. Get Price Thresholds for the batch
            agg = responses.aggregate(overall_max=Max('total_amount'), overall_min=Min('total_amount'))
            price_thresholds = {'max': agg['overall_max'], 'min': agg['overall_min']}
            ranked_responses = list(responses)
            
            # 2. Calculate scores for all responses in the batch
            for r in ranked_responses:
                if r.store:
                    r.quality_score = calculate_quality_score(r.store, r, price_thresholds)
                else:
                    r.quality_score = Decimal('0.0')
                
                r.smart_tags = get_smart_tags(r, ranked_responses)
                
            # 3. Identify Unique Best Value Winner
            best_value_candidate = None
            max_bv_score = Decimal('-1.0')
            
            for r in ranked_responses:
                avail_val = {'exact_brand': 100, 'all_generic': 90, 'mixed': 70}.get((r.quotation_scenario or '').lower(), 40)
                if avail_val >= 80: # Criteria: High availability
                    if r.quality_score > max_bv_score:
                        max_bv_score = r.quality_score
                        best_value_candidate = r
            
            if best_value_candidate:
                if "Best Value" not in best_value_candidate.smart_tags:
                    best_value_candidate.smart_tags.insert(0, "Best Value")
            
            # 4. Batch Update to DB
            for r in ranked_responses:
                PrescriptionResponse.objects.filter(id=r.id).update(quality_score=r.quality_score)
                if r.store_id:
                    Store.objects.filter(id=r.store_id).update(
                        quality_score=r.quality_score,
                        exposure_count=F('exposure_count') + 1
                    )
            
            # Sort by Quality Score (Primary Rank)
            responses = sorted(ranked_responses, key=lambda x: x.quality_score, reverse=True)

        except Exception as e:
            logger.error(f"RANKING ENGINE FAILURE: {str(e)}")
            # 🛡️ EMERGENCY FALLBACK SORTING (Availability -> Price -> Rating)
            # This ensures the app NEVER crashes even if logic fails
            responses = list(responses.order_by('quotation_scenario', 'total_amount', '-store__average_rating'))
            logger.warning("Using Emergency Fallback Sort (Availability > Price > Rating)")

        # 📄 Pagination
        paginator = CustomPagination()
        paginated_responses = paginator.paginate_queryset(responses, request)

        # 💬 Resolve Chat Threads
        chat_threads = ChatThread.objects.filter(
            user=user,
            prescription_id__in=[r.prescription_id for r in paginated_responses],
            store_id__in=[r.store_id for r in paginated_responses]
        )
        chat_map = {(t.store_id, t.prescription_id): t.id for t in chat_threads}
        for r in paginated_responses:
            r.chat_thread_id = chat_map.get((r.store_id, r.prescription_id))

        serialized_data = PrescriptionResponseSerializer(paginated_responses, many=True, context={'request': request}).data

        return paginator.get_paginated_response(serialized_data)
class UpdateResponseStatusAPIView(APIView):
    authentication_classes = [UserTokenAuthentication]
    permission_classes = [IsAuthenticated]

    def patch(self, request, response_id):
        status = request.data.get("user_status")
        delivery_option = request.data.get("delivery_option")
        cancel_reason = request.data.get("cancel_reason")

        try:
            from django.core.exceptions import ValidationError
            with transaction.atomic():
                # 🔒 Atomic Lock: Pessimistic locking for state transition
                response_obj = PrescriptionResponse.objects.select_for_update().get(id=response_id, user=request.user)
                previous_status = response_obj.user_status
                previous_delivery_option = response_obj.delivery_option
                notification_events = []

                if delivery_option and delivery_option not in ('walk_in', 'online'):
                    return Response({"error": "Invalid delivery option."}, status=400)
                if (
                    delivery_option
                    and previous_delivery_option
                    and previous_delivery_option != delivery_option
                    and previous_status not in ('pending', 'quoted')
                ):
                    return Response({"error": "Fulfillment method cannot be changed after order acceptance."}, status=409)
                selected_delivery_option = delivery_option or response_obj.delivery_option
                if status == 'accepted' and not selected_delivery_option:
                    return Response({"error": "Choose pickup or home delivery before accepting the quote."}, status=400)
                try:
                    delivery_offer = response_obj.delivery_offer
                except QuoteDeliveryOffer.DoesNotExist:
                    delivery_offer = None
                if selected_delivery_option == 'online':
                    if not delivery_offer or not delivery_offer.home_delivery_available:
                        return Response({"error": "Home delivery is not available for this quote."}, status=400)
                if selected_delivery_option == 'walk_in' and delivery_offer and not delivery_offer.pickup_available:
                    return Response({"error": "Store pickup is not available for this quote."}, status=400)
                
                if status == 'accepted':
                    validate_action_capability(Permission.ACCEPT_QUOTE, actor=request.user, resource=response_obj)
                elif status in ('rejected', 'dismissed'):
                    validate_action_capability(Permission.REJECT_QUOTE, actor=request.user, resource=response_obj)
                elif status and status != 'cancelled':
                    validate_action_capability(Permission.PLACE_ORDER, actor=request.user, resource=response_obj)
                if delivery_option:
                    validate_action_capability(Permission.PLACE_ORDER, actor=request.user, resource=response_obj)

                if status:
                    response_obj.user_status = status
                    if status in ('cancelled', 'rejected', 'dismissed'):
                        response_obj.cancel_reason = cancel_reason
                        response_obj.cancelled_by = 'user'
                    
                    if status == 'accepted' and previous_status != 'accepted':
                        notification_events.append('ACCEPTED')

                if delivery_option:
                    response_obj.delivery_option = delivery_option
                    if previous_delivery_option != delivery_option:
                        notification_events.append('DELIVERY_SELECTED')

                response_obj.save(user_context=request.user) # 🛡️ FSM validation
                for event_type in notification_events:
                    _safe_on_commit(
                        "store order notification",
                        lambda event_type=event_type, response_id=response_obj.id: notify_store_order_accepted_task.apply(
                            args=(response_id, event_type)
                        )
                    )
                
                # 💥 INVALIDATE Store Cache to prevent UI desyncs
                if response_obj.store:
                    from django.core.cache import cache
                    try:
                        cache.incr(f"store_{response_obj.store.id}_cache_version")
                    except ValueError:
                        cache.set(f"store_{response_obj.store.id}_cache_version", 1, timeout=86400 * 30)

                # 🚀 Real-time WebSocket Broadcast
                self._broadcast_status_change(response_obj)

            return Response({
                "message": "Update successful.",
                "response": PrescriptionResponseSerializer(response_obj, context={'request': request}).data
            }, status=200)

        except ValidationError as e:
            return Response({"error": str(e.message if hasattr(e, 'message') else e)}, status=400)
        except PrescriptionResponse.DoesNotExist:
            return Response({"error": "Response not found or not authorized."}, status=404)
        except CapabilityBlocked:
            raise
        except Exception:
            return Response({"error": "Could not update response status."}, status=400)

    def _broadcast_status_change(self, response_obj):
        """Helper to send WebSocket updates to the store."""
        from channels.layers import get_channel_layer
        from asgiref.sync import async_to_sync
        import uuid
        
        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            f"store_{response_obj.store.id}_fulfillment",
            {
                "type": "fulfillment_update",
                "event_id": str(uuid.uuid4()),
                "seq": response_obj.response_version,
                "action": "status_change",
                "data": {
                    "id": response_obj.id,
                    "prescription_id": response_obj.prescription.id,
                    "user_status": response_obj.user_status,
                    "delivery_option": response_obj.delivery_option,
                    "cancelled_by": response_obj.cancelled_by,
                    "cancel_reason": response_obj.cancel_reason,
                    "is_locked": response_obj.is_locked,
                    "updated_at": response_obj.updated_at.isoformat()
                }
            }
        )
    def delete(self, request, response_id):
        try:
            response = PrescriptionResponse.objects.get(id=response_id, user=request.user)
            if response.is_locked:
                return Response({"error": "LOCKED order cannot be deleted."}, status=403)
            response.delete()
            return Response({"message": "Response deleted successfully."}, status=200)
        except PrescriptionResponse.DoesNotExist:
            return Response({"error": "Response not found"}, status=404)

class UserContactNoteUpdateView(APIView):
    authentication_classes = [UserTokenAuthentication]
    permission_classes = [IsAuthenticated]
    # def post(self, request, response_id):
    #     try:
    #         response = PrescriptionResponse.objects.get(id=response_id, user=request.user)
    #     except PrescriptionResponse.DoesNotExist:
    #         return Response({"error": "Response not found"}, status=404)

    #     note = request.data.get("note")
    #     if not note:
    #         return Response({"error": "Note is required"}, status=400)

    #     response.user_contact_note = note
    #     response.save()
    #     return Response({"success": True, "message": "Note saved successfully"}, status=200)
    def post(self, request, response_id):
        try:
            response = PrescriptionResponse.objects.get(id=response_id, user=request.user)
        except PrescriptionResponse.DoesNotExist:
            return Response({"error": "Response not found"}, status=404)

        note = request.data.get("note")
        if not note:
            return Response({"error": "Note is required"}, status=400)
            
        response.user_contact_note = note
        response.save()
        # ✅ Save to ReportNote table
        ReportNote.objects.create(
            response=response,
            user=request.user,
            note=note
        )

        if response.store:
            from django.core.cache import cache
            try:
                cache.incr(f"store_{response.store.id}_cache_version")
            except ValueError:
                cache.set(f"store_{response.store.id}_cache_version", 1, timeout=86400 * 30)

        if response.store:
            _safe_on_commit(
                "user note store notification",
                lambda response=response: send_store_app_notification(
                    response.store,
                    "New message from user",
                    f"User sent a note for prescription #{response.prescription.id}",
                    {"prescription_id": response.prescription.id, "response_id": response.id, "type": "USER_NOTE"},
                    dedupe_key=f"store:{response.store.id}:response:{response.id}:user_note:{ReportNote.objects.filter(response=response, user=request.user).count()}",
                )
            )

        return Response({"success": True, "message": "Note saved successfully"}, status=200)

    def get(self, request, response_id):
        try:
            response = PrescriptionResponse.objects.get(id=response_id)
        except PrescriptionResponse.DoesNotExist:
            return Response({"error": "Response not found"}, status=404)

        if request.user != response.prescription.user:
            return Response({"error": "You are not authorized to view this response."}, status=403)

        reports = ReportNote.objects.filter(response=response, user=request.user).order_by('-created_at')
        report_data = [
            {
                "note": report.note,
                "created_at": report.created_at.strftime('%Y-%m-%d %H:%M:%S')
            }
            for report in reports
        ]
        store_reports = StoreReportNote.objects.filter(response=response).order_by('-created_at')
        store_report_data = [
            {
                "note": report.note,
                "created_at": report.created_at.strftime('%Y-%m-%d %H:%M:%S'),
                "store_name": report.store.name if report.store else response.store_name
            }
            for report in store_reports
        ]
        if not store_report_data and response.store_contact_note:
            store_report_data.append({
                "note": response.store_contact_note,
                "created_at": response.updated_at.strftime('%Y-%m-%d %H:%M:%S'),
                "store_name": response.store_name
            })

        return Response({
            "count": reports.count(),
            "reports": report_data,
            "store_count": len(store_report_data),
            "store_reports": store_report_data
        }, status=200)
        
# class StoreContactNoteUpdateView(APIView):
#     authentication_classes = [StoreTokenAuthentication]
#     permission_classes = [IsAuthenticated]

#     def post(self, request, response_id):
#         try:
#             response = PrescriptionResponse.objects.get(id=response_id, store=request.user)
#         except PrescriptionResponse.DoesNotExist:
#             return Response({"error": "Response not found or unauthorized"}, status=404)

#         note = request.data.get("note")
#         if not note:
#             return Response({"error": "Note is required"}, status=400)

#         response.store_contact_note = note
#         response.save()

#         StoreReportNote.objects.create(
#             response=response,
#             store=request.user,
#             note=note
#         )

#         return Response({"success": True, "message": "Store note saved successfully"}, status=200)

#     def get(self, request, response_id):
#         try:
#             response = PrescriptionResponse.objects.get(id=response_id)
#         except PrescriptionResponse.DoesNotExist:
#             return Response({"error": "Response not found"}, status=404)

#         reports = StoreReportNote.objects.filter(response=response, store=request.user).order_by('-created_at')
#         report_data = [
#             {
#                 "note": report.note,
#                 "created_at": report.created_at.strftime('%Y-%m-%d %H:%M:%S')
#             }
#             for report in reports
#         ]

#         return Response({
#             "count": reports.count(),
#             "reports": report_data
#         }, status=200)
# class StoreContactNoteView(APIView):
#     authentication_classes = [StoreTokenAuthentication]
#     permission_classes = [IsAuthenticated]

#     def post(self, request, response_id):
#         note = request.data.get('note')
#         if not note:
#             return Response({"error": "Note is required"}, status=400)

#         try:
#             response = PrescriptionResponse.objects.get(id=response_id)
#         except PrescriptionResponse.DoesNotExist:
#             return Response({"error": "PrescriptionResponse not found"}, status=404)

#         try:
#             StoreReportNote.objects.create(
#                 response=response,
#                 store=request.user,  # request.user is store because of StoreTokenAuthentication
#                 note=note
#             )
#             return Response({"message": "Store note saved successfully"}, status=201)
#         except Exception as e:
#             return Response({"error": "Request could not be completed."}, status=400)
# class StoreContactNoteView(APIView):
#     authentication_classes = [StoreTokenAuthentication]
#     permission_classes = [IsAuthenticated]

#     def post(self, request, response_id):
#         try:
#             response = PrescriptionResponse.objects.get(id=response_id, store=request.user)
#         except PrescriptionResponse.DoesNotExist:
#             return Response({"error": "Response not found"}, status=404)

#         note = request.data.get('note')
#         if not note:
#             return Response({"error": "Note is required"}, status=400)

#         try:
#             StoreReportNote.objects.create(
#                 response=response,
#                 store=request.user,
#                 note=note
#             )
#             return Response({"message": "Store note saved successfully"}, status=201)
#         except Exception as e:
#             return Response({"error": "Request could not be completed."}, status=400)
class StoreContactNoteView(APIView):
    authentication_classes = [StoreTokenAuthentication]
    permission_classes = [IsAuthenticated]

    def _get_store_context(self, reference_id, store):
        response = PrescriptionResponse.objects.filter(
            Q(id=reference_id) | Q(prescription_id=reference_id),
            store=store
        ).select_related("prescription__user").first()
        if response:
            return response, response.prescription
        target = PrescriptionTargetStore.objects.filter(
            prescription_id=reference_id, store=store
        ).select_related("prescription__user").first()
        if target:
            return None, target.prescription
        return None, None

    def post(self, request, response_id):
        try:
            response, prescription = self._get_store_context(response_id, request.user)
            if not prescription:
                return Response({"error": "Enquiry not found or not assigned to this store"}, status=404)

            note = request.data.get('note')
            if not note:
                return Response({"error": "Note is required"}, status=400)

            with transaction.atomic():
                StoreReportNote.objects.create(
                    response=response,
                    prescription=prescription,
                    store=request.user,
                    note=note
                )
                
                # Reporting is allowed even after lock/completion; only clear accountability flag.
                if response:
                    PrescriptionResponse.objects.filter(id=response.id).update(is_unresponsive=False)

                from django.core.cache import cache
                try:
                    cache.incr(f"store_{request.user.id}_cache_version")
                except ValueError:
                    cache.set(f"store_{request.user.id}_cache_version", 1, timeout=86400 * 30)
            
            target_user = prescription.user
            if target_user:
                _safe_on_commit(
                    "store report user notification",
                    lambda response=response, prescription=prescription, target_user=target_user, note=note, store=request.user: send_user_app_notification(
                        target_user,
                        f"Report from {store.name}",
                        f"The pharmacy submitted a report: {note[:60]}...",
                        {"prescription_id": prescription.id, "response_id": response.id if response else None, "type": "STORE_REPORT"},
                        dedupe_key=f"user:{target_user.id}:prescription:{prescription.id}:store_report:{StoreReportNote.objects.filter(prescription=prescription, store=request.user).count()}",
                    )
                )

            return Response({"message": "Store report submitted successfully"}, status=201)
        except Exception as e:
            return Response({"error": "Request could not be completed."}, status=400)
    def get(self, request, response_id):
        response, prescription = self._get_store_context(response_id, request.user)
        if not prescription:
            return Response({"error": "Enquiry not found or not assigned to this store"}, status=404)

        context_filter = Q(prescription=prescription)
        if response:
            context_filter |= Q(response=response)
        notes = StoreReportNote.objects.filter(
            context_filter, store=request.user,
        ).distinct().order_by("-created_at")

        report_data = [
            {
                "note": note.note,
                "created_at": note.created_at.strftime('%Y-%m-%d %H:%M:%S')
            }
            for note in notes
        ]

        return Response({
            "count": notes.count(),
            "reports": report_data
        }, status=200)

class SafetyReportListCreateView(APIView):
    authentication_classes = [StoreTokenAuthentication, UserTokenAuthentication]
    permission_classes = [IsAuthenticated]

    def _serialize(self, report):
        target = report.reported_store or report.reported_user
        return {
            'id': report.id,
            'reporter_type': report.reporter_type,
            'target_type': report.target_type,
            'target_name': getattr(target, 'name', 'Account'),
            'category': report.category,
            'category_display': report.get_category_display(),
            'description': report.description,
            'status': report.status,
            'status_display': report.get_status_display(),
            'resolution_note': report.resolution_note,
            'context_type': 'order' if report.response_id else 'enquiry',
            'context_id': report.response_id or report.prescription_id,
            'prescription_id': report.prescription_id,
            'response_id': report.response_id,
            'created_at': report.created_at.isoformat(),
            'updated_at': report.updated_at.isoformat(),
        }

    def get(self, request):
        if isinstance(request.user, Store):
            reports = SafetyReport.objects.filter(reporter_store=request.user)
        else:
            reports = SafetyReport.objects.filter(reporter_user=request.user)
        reference_id = request.query_params.get('reference_id')
        if reference_id:
            reports = reports.filter(Q(response_id=reference_id) | Q(prescription_id=reference_id))
        reports = reports.select_related('reported_user', 'reported_store')
        return Response({'count': reports.count(), 'reports': [self._serialize(item) for item in reports[:100]]})

    def post(self, request):
        reference_id = request.data.get('reference_id')
        category = request.data.get('category', 'other')
        description = str(request.data.get('description', '')).strip()
        valid_categories = {value for value, _ in SafetyReport.CATEGORY_CHOICES}
        if not reference_id:
            return Response({'error': 'Enquiry or order reference is required.'}, status=400)
        if category not in valid_categories:
            return Response({'error': 'Invalid report category.'}, status=400)
        if len(description) < 3:
            return Response({'error': 'Please add report details.'}, status=400)

        if isinstance(request.user, Store):
            response, prescription = StoreContactNoteView()._get_store_context(reference_id, request.user)
            if not prescription:
                return Response({'error': 'Enquiry not found or not assigned to this store.'}, status=404)
            report = SafetyReport.objects.create(
                reporter_type='store', reporter_store=request.user,
                target_type='user', reported_user=prescription.user,
                prescription=prescription, response=response,
                category=category, description=description,
            )
        else:
            response = PrescriptionResponse.objects.filter(id=reference_id, user=request.user).select_related('prescription', 'store').first()
            if not response:
                return Response({'error': 'Order not found.'}, status=404)
            report = SafetyReport.objects.create(
                reporter_type='user', reporter_user=request.user,
                target_type='store', reported_store=response.store,
                prescription=response.prescription, response=response,
                category=category, description=description,
            )
        return Response(self._serialize(report), status=201)


class GetResponseByIdViewForUserPrescription(APIView):
    authentication_classes = [UserTokenAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request, response_id):
        try:
            response = PrescriptionResponse.objects.get(id=response_id)
        except PrescriptionResponse.DoesNotExist:
            return Response({"error": "Response not found."}, status=404)

        # Ensure only the user who owns the prescription can see this response
        if request.user != response.prescription.user:
            return Response({"error": "You are not authorized to view this response."}, status=403)

        serializer = PrescriptionResponseSerializer(response, context={'request': request})
        return Response(serializer.data)
class DeletePrescriptionResponse(APIView):
    authentication_classes = [StoreTokenAuthentication]
    permission_classes = [IsAuthenticated]

    def delete(self, request, *args, **kwargs):
        response_id = kwargs.get('response_id')
        user = request.user

        # Find the response to delete
        try:
            response = PrescriptionResponse.objects.get(id=response_id, user=user)
        except PrescriptionResponse.DoesNotExist:
            return Response({"error": "Response not found or you are not authorized to delete this response."}, status=404)

        # Delete the response
        response.delete()

        return Response({"message": "Response deleted successfully."}, status=204)





# class PublicPrescriptionListView(APIView):
#     authentication_classes = [UserTokenAuthentication]
#     permission_classes = [IsAuthenticated]
#     def get(self, request, *args, **kwargs):
# #         start_date = request.query_params.get('start_date')
#         end_date = request.query_params.get('end_date')

#         prescriptions = Prescription.objects.all()

#         if user_id:
#             try:
#                 user = User.objects.get(id=user_id)
#                 prescriptions = prescriptions.filter(user=user)
#             except User.DoesNotExist:
#                 raise NotFound({'error': 'User not found'})

#         if start_date and end_date:
#             start = datetime.strptime(start_date, "%Y-%m-%d")
#             end = datetime.strptime(end_date, "%Y-%m-%d")
#             prescriptions = prescriptions.filter(uploaded_at__date__range=(start, end))

#         prescriptions = prescriptions.order_by('-uploaded_at')

#         # Apply pagination
#         paginator = CustomPagination()
#         result_page = paginator.paginate_queryset(prescriptions, request)
#         serializer = PrescriptionSerializer(result_page, many=True)
#         return paginator.get_paginated_response(serializer.data)
# class PublicPrescriptionListView(APIView):
#     authentication_classes = [UserTokenAuthentication]
#     permission_classes = [IsAuthenticated]

#     def get(self, request, *args, **kwargs):
#         user_id = request.query_params.get('user_id')
#         start_date = request.query_params.get('start_date')
#         end_date = request.query_params.get('end_date')

#         prescriptions = Prescription.objects.all()

#         # Filter by user
#         if user_id:
#             try:
#                 user = User.objects.get(id=user_id)
#                 prescriptions = prescriptions.filter(user=user)
#             except User.DoesNotExist:
#                 raise NotFound({'error': 'User not found'})

#         # Filter by full date range (timezone-aware)
#         if start_date and end_date:
#             try:
#                 start = datetime.strptime(start_date, "%Y-%m-%d")
#                 end = datetime.strptime(end_date, "%Y-%m-%d") + timedelta(days=1)

#                 # Make timezone-aware only if needed
#                 try:
#                     if is_naive(start):
#                         start = make_aware(start)
#                     if is_naive(end):
#                         end = make_aware(end)
#                 except Exception as e:
#                     print("Timezone error:", e)

#                 prescriptions = prescriptions.filter(uploaded_at__range=(start, end))
#             except ValueError:
#                 return Response({'error': 'Invalid date format. Use YYYY-MM-DD'}, status=400)

#         prescriptions = prescriptions.order_by('-uploaded_at')

#         paginator = CustomPagination()
#         result_page = paginator.paginate_queryset(prescriptions, request)
#         serializer = PrescriptionSerializer(result_page, many=True)
#         return paginator.get_paginated_response(serializer.data)
class PublicPrescriptionListView(APIView):
    authentication_classes = [UserTokenAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        user_id = request.query_params.get('user_id')
        start_date_str = request.query_params.get('start_date')
        end_date_str = request.query_params.get('end_date')

        prescriptions = Prescription.objects.filter(user=request.user).prefetch_related('target_stores__store')

        if start_date_str and end_date_str:
            start = parse_datetime(start_date_str)
            end = parse_datetime(end_date_str)

            if not start or not end:
                return Response({'error': 'Invalid datetime format.'}, status=400)

            # If both datetime are the same day, expand to full day
            if start.date() == end.date():
                start = datetime.combine(start.date(), datetime.min.time())
                end = datetime.combine(start.date() + timedelta(days=1), datetime.min.time())

            # Make timezone aware
            if is_naive(start):
                start = make_aware(start)
            if is_naive(end):
                end = make_aware(end)

            prescriptions = prescriptions.filter(uploaded_at__range=(start, end))

        prescriptions = prescriptions.order_by('-uploaded_at')

        paginator = CustomPagination()
        result_page = paginator.paginate_queryset(prescriptions, request)
        serializer = PrescriptionSerializer(result_page, many=True, context={'request': request})
        return paginator.get_paginated_response(serializer.data)
class UserAuthentication(BaseAuthentication):
    permission_classes = [AllowAny]  # Allow unauthenticated users to access login

    def authenticate(self, request):
        auth_header = request.headers.get('Authorization')
        if not auth_header:
            return None
        try:
            token = auth_header.split(' ')[1]
            user = User.objects.get(token=token)
            return (user, None)
        except (IndexError, User.DoesNotExist):
            return None

class UserRegisterView(APIView):
    permission_classes = [AllowAny]  # Allow unauthenticated users to access login

    def post(self, request):
        serializer = UserSerializer(data=request.data)
        if serializer.is_valid():
            User.objects.create(
                name=serializer.validated_data['name'],
                mobile=serializer.validated_data['mobile'],
                email=serializer.validated_data['email'],
                address=serializer.validated_data['address'],
                pincode=serializer.validated_data['pincode'],
                password=request.data['password']
            )
            return Response({"msg": "User registered successfully!"}, status=201)
        return Response(serializer.errors, status=400)

class UserLoginView(APIView):
    permission_classes = [AllowAny]  # Allow unauthenticated users to access login

    def post(self, request):
        serializer = UserLoginSerializer(data=request.data)
        if serializer.is_valid():
            try:
                user = User.objects.get(email=serializer.validated_data['email'])
                if user.check_password(serializer.validated_data['password']):
                    user_status = get_user_lifecycle_status(user)
                    if user_status.value == "user_deleted":
                        return Response({"error": "User account has been deleted."}, status=403)
                    if user_status.value == "user_inactive":
                        return Response({"error": "User account is inactive."}, status=403)
                    if not user.token:
                        user.token = str(uuid.uuid4())
                        user.save()
                    return Response({
                        "msg": "Login successful",
                        "user_id": user.id,
                        "token": user.token,
                        "user_type": "user"

                    })
                else:
                    return Response({"error": "Invalid credentials"}, status=401)
            except User.DoesNotExist:
                return Response({"error": "User not found"}, status=404)
        return Response(serializer.errors, status=400)

class UserLogoutView(APIView):
    # permission_classes = [AllowAny]  # Allow unauthenticated users to access login

    authentication_classes = [UserTokenAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        user.token = None
        user.save()
        return Response({"msg": "Logout successful"}, status=200)

class LoggedInUserView(APIView):
    authentication_classes = [UserTokenAuthentication]

    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        serializer = UserSerializer(user)
        return Response(serializer.data)
    def patch(self, request):
        user = request.user
        serializer = UserSerializer(user, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
class LoggedInStoreView(APIView):
    authentication_classes = [StoreTokenAuthentication]

    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        serializer = UserSerializer(user)
        return Response(serializer.data)

# class NearbyPrescriptionsView(APIView):
#     authentication_classes = [StoreTokenAuthentication]
#     permission_classes = [IsAuthenticated]

#     def get(self, request, *args, **kwargs):
#         store = request.user

#         if not store.is_verified or not store.is_active:
#             return Response({"error": "Store is not verified or not active."}, status=403)

#         if not store.latitude or not store.longitude:
#             return Response({"error": "Store latitude and longitude are not available."}, status=400)

#         store_lat = store.latitude
#         store_lon = store.longitude

#         prescriptions = Prescription.objects.all()

#         nearby_prescriptions = []
#         for prescription in prescriptions:
#             if prescription.latitude and prescription.longitude:
#                 distance = calculate_distance(store_lat, store_lon, prescription.latitude, prescription.longitude)
#                 if distance <= 10:
#                     prescription.distance = distance  # 👈 attach distance
#                     prescription.store_lat = store_lat
#                     prescription.store_lon = store_lon
#                     prescription.store_address = store.address
#                     nearby_prescriptions.append(prescription)

#         serializer = PrescriptionSerializer(nearby_prescriptions, many=True)
#         return Response(serializer.data, status=200)

# class NearbyPrescriptionsView(APIView):
#     authentication_classes = [StoreTokenAuthentication]
#     permission_classes = [IsAuthenticated]
#     pagination_class = CustomPagination  # Use your custom pagination

#     def get(self, request, *args, **kwargs):
#         store = request.user

#         if not store.is_verified or not store.is_active:
#             return Response({"error": "Store is not verified or not active."}, status=403)

#         if not store.latitude or not store.longitude:
#             return Response({"error": "Store latitude and longitude are not available."}, status=400)

#         store_lat = store.latitude
#         store_lon = store.longitude

#         prescriptions = Prescription.objects.all()

#         # Filter by search query if provided (adjust fields accordingly)
#         search_query = request.query_params.get('search', None)
#         if search_query:
#             prescriptions = prescriptions.filter(
#                 Q(description__icontains=search_query) |  # example field, change as per your model
#                 Q(user__username__icontains=search_query)  # example related user field
#             )

#         # Calculate distances and filter prescriptions within 10 km
#         nearby_prescriptions = []
#         for prescription in prescriptions:
#             if prescription.latitude and prescription.longitude:
#                 distance = calculate_distance(store_lat, store_lon, prescription.latitude, prescription.longitude)
#                 if distance <= 10:
#                     prescription.distance = distance
#                     prescription.store_lat = store_lat
#                     prescription.store_lon = store_lon
#                     prescription.store_address = store.address
#                     nearby_prescriptions.append(prescription)

#         # Sort by distance ascending
#         nearby_prescriptions.sort(key=lambda x: x.distance)

#         # Pagination
#         paginator = self.pagination_class()
#         page = paginator.paginate_queryset(nearby_prescriptions, request)
#         serializer = PrescriptionSerializer(page, many=True)

#         return paginator.get_paginated_response(serializer.data)

# class NearbyPrescriptionsView(APIView):
#     authentication_classes = [StoreTokenAuthentication]
#     permission_classes = [IsAuthenticated]
#     pagination_class = CustomPagination

#     def get(self, request, *args, **kwargs):
#         store = request.user

#         if not store.is_verified or not store.is_active:
#             return Response({"error": "Store is not verified or not active."}, status=403)

#         if not store.latitude or not store.longitude:
#             return Response({"error": "Store latitude and longitude are not available."}, status=400)

#         store_lat = store.latitude
#         store_lon = store.longitude

#         # prescriptions = Prescription.objects.all()
#         prescriptions = Prescription.objects.all().order_by('-uploaded_at')


#         # 🔍 Search filter
#         search_query = request.query_params.get('search')
#         if search_query:
#             prescriptions = prescriptions.filter(
#                 Q(description__icontains=search_query) |
#                 Q(user__username__icontains=search_query)
#             )

#         # 📅 Date filter
#         start_date = request.query_params.get('start_date')
#         end_date = request.query_params.get('end_date')

#         if start_date and end_date:
#             try:
#                 start = datetime.strptime(start_date, "%Y-%m-%d")
#                 end = datetime.strptime(end_date, "%Y-%m-%d")
#                 prescriptions = prescriptions.filter(uploaded_at__date__range=(start, end))
#             except ValueError:
#                 return Response({"error": "Invalid date format. Use YYYY-MM-DD."}, status=400)

#         # 📍 Distance filter (within 10 km)
#         nearby_prescriptions = []
#         for prescription in prescriptions:
#             if prescription.latitude and prescription.longitude:
#                 distance = calculate_distance(store_lat, store_lon, prescription.latitude, prescription.longitude)
#                 if distance <= 10:
#                     prescription.distance = distance
#                     prescription.store_lat = store_lat
#                     prescription.store_lon = store_lon
#                     prescription.store_address = store.address
#                     nearby_prescriptions.append(prescription)

#         # 🧭 Sort by distance
#         nearby_prescriptions.sort(key=lambda x: x.distance)

#         # 📄 Pagination
#         paginator = self.pagination_class()
#         page = paginator.paginate_queryset(nearby_prescriptions, request)
#         serializer = PrescriptionSerializer(page, many=True)

#         return paginator.get_paginated_response(serializer.data)
# class NearbyPrescriptionsView(APIView):
#     authentication_classes = [StoreTokenAuthentication]
#     permission_classes = [IsAuthenticated]
#     pagination_class = CustomPagination

#     def get(self, request, *args, **kwargs):
#         store = request.user

#         if not store.is_verified or not store.is_active:
#             return Response({"error": "Store is not verified or not active."}, status=403)

#         if not store.latitude or not store.longitude:
#             return Response({"error": "Store latitude and longitude are not available."}, status=400)

#         store_lat = store.latitude
#         store_lon = store.longitude

#         # Start with all prescriptions sorted by latest first
#         prescriptions = Prescription.objects.all().order_by('-uploaded_at')

#         # 🔍 Search filter
#         search_query = request.query_params.get('search')
#         if search_query:
#             prescriptions = prescriptions.filter(
#                 Q(description__icontains=search_query) |
#                 Q(user__username__icontains=search_query)
#             )

#         # 📅 Date filter
#         start_date = request.query_params.get('start_date')
#         end_date = request.query_params.get('end_date')

#         if start_date and end_date:
#             try:
#                 start = datetime.strptime(start_date, "%Y-%m-%d")
#                 end = datetime.strptime(end_date, "%Y-%m-%d")
#                 prescriptions = prescriptions.filter(uploaded_at__date__range=(start, end))
#             except ValueError:
#                 return Response({"error": "Invalid date format. Use YYYY-MM-DD."}, status=400)

#         # 📍 Distance filter (within 10 km)
#         nearby_prescriptions = []
#         for prescription in prescriptions:
#             if prescription.latitude and prescription.longitude:
#                 distance = calculate_distance(store_lat, store_lon, prescription.latitude, prescription.longitude)
#                 if distance <= 10:
#                     prescription.distance = distance
#                     prescription.store_lat = store_lat
#                     prescription.store_lon = store_lon
#                     prescription.store_address = store.address
#                     nearby_prescriptions.append(prescription)

#         # ❌ REMOVE sort by distance to keep uploaded_at order
#         # nearby_prescriptions.sort(key=lambda x: x.distance)  <-- delete this line

#         # 📄 Pagination
#         paginator = self.pagination_class()
#         page = paginator.paginate_queryset(nearby_prescriptions, request)
#         serializer = PrescriptionSerializer(page, many=True)

#         return paginator.get_paginated_response(serializer.data)
# class NearbyPrescriptionsView(APIView):
#     authentication_classes = [StoreTokenAuthentication]
#     permission_classes = [IsAuthenticated]
#     pagination_class = CustomPagination

#     def get(self, request, *args, **kwargs):
#         store = request.user

#         if not store.is_verified or not store.is_active:
#             return Response({"error": "Store is not verified or not active."}, status=403)

#         if not store.latitude or not store.longitude:
#             return Response({"error": "Store latitude and longitude are not available."}, status=400)

#         store_lat = store.latitude
#         store_lon = store.longitude

#         # Start with all prescriptions sorted by latest first
#         prescriptions = Prescription.objects.all().order_by('-uploaded_at')

#         # 🔍 Search filter
#         search_query = request.query_params.get('search')
#         if search_query:
#             prescriptions = prescriptions.filter(
#                 Q(description__icontains=search_query) |
#                 Q(user__username__icontains=search_query)
#             )

#         # 📅 Date filter — default: today
#         start_date = request.query_params.get('start_date')
#         end_date = request.query_params.get('end_date')

#         if start_date and end_date:
#             try:
#                 start = datetime.strptime(start_date, "%Y-%m-%d")
#                 end = datetime.strptime(end_date, "%Y-%m-%d")
#                 prescriptions = prescriptions.filter(uploaded_at__date__range=(start, end))
#             except ValueError:
#                 return Response({"error": "Invalid date format. Use YYYY-MM-DD."}, status=400)
#         else:
#             today = timezone.now().date()
#             prescriptions = prescriptions.filter(uploaded_at__date=today)

#         # 📍 Distance filter (within 10 km)
#         nearby_prescriptions = []
#         for prescription in prescriptions:
#             if prescription.latitude and prescription.longitude:
#                 distance = calculate_distance(store_lat, store_lon, prescription.latitude, prescription.longitude)
#                 if distance <= 10:
#                     prescription.distance = distance
#                     prescription.store_lat = store_lat
#                     prescription.store_lon = store_lon
#                     prescription.store_address = store.address
#                     nearby_prescriptions.append(prescription)

#         # ❌ No distance sorting to preserve uploaded_at order

#         # 📄 Pagination
#         paginator = self.pagination_class()
#         page = paginator.paginate_queryset(nearby_prescriptions, request)
#         serializer = PrescriptionSerializer(page, many=True)

#         return paginator.get_paginated_response(serializer.data)
# class NearbyPrescriptionsView(APIView):
#     authentication_classes = [StoreTokenAuthentication]
#     permission_classes     = [IsAuthenticated]
#     pagination_class       = CustomPagination

#     def get(self, request, *args, **kwargs):
#         store = request.user

#         # ✅ Store status checks
#         # if not store.is_verified or not store.is_active:
#         #     return Response({"error": "Store is not verified or not active."}, status=403)

#         if not store.is_active:
#             return Response({"error": "Store is not active."}, status=403)

#         if not store.latitude or not store.longitude:
#             return Response({"error": "Store latitude and longitude are not available."}, status=400)

#         store_lat, store_lon = store.latitude, store.longitude

#         # 🔄 Base queryset (latest first)
#         prescriptions = Prescription.objects.all().order_by('-uploaded_at')

#         # 🔍 Search filter
#         search_query = request.query_params.get('search')
#         if search_query:
#             prescriptions = prescriptions.filter(
#                 Q(user__name__icontains=search_query) |
#                 Q(user_address__icontains=search_query)
#             )

#         # 📅 Date filter (default = today)
#         start_date = request.query_params.get('start_date')
#         end_date   = request.query_params.get('end_date')

#         if start_date and end_date:
#             try:
#                 start = datetime.strptime(start_date, "%Y-%m-%d")
#                 end   = datetime.strptime(end_date,   "%Y-%m-%d")
#                 prescriptions = prescriptions.filter(
#                     uploaded_at__date__range=(start, end)
#                 )
#             except ValueError:
#                 return Response(
#                     {"error": "Invalid date format. Use YYYY-MM-DD."},
#                     status=400
#                 )
#         else:
#             prescriptions = prescriptions.filter(uploaded_at__date=timezone.now().date())

#         # 📍 Distance filter (≤ 10 km)
#         nearby = []
#         for p in prescriptions:
#             if p.latitude and p.longitude:
#                 dist = calculate_distance(store_lat, store_lon, p.latitude, p.longitude)
#                 if dist <= 10:
#                     # attach extra attrs used by serializer
#                     p.distance       = dist
#                     p.store_lat      = store_lat
#                     p.store_lon      = store_lon
#                     p.store_address  = store.address
#                     nearby.append(p)

#         # 🔔 Determine which prescriptions already responded by this store
#         responded_ids = set(
#             PrescriptionResponse.objects.filter(
#                 store=store, prescription_id__in=[p.id for p in nearby]
#             ).values_list('prescription_id', flat=True)
#         )
#         for p in nearby:
#             p.has_responded = p.id in responded_ids   # Serializer will read this

#         # 📄 Pagination + serialization
#         paginator  = self.pagination_class()
#         page       = paginator.paginate_queryset(nearby, request)
#         serializer = PrescriptionSerializer(page, many=True)

#         return paginator.get_paginated_response(serializer.data)
class NearbyPrescriptionsView(APIView):
    authentication_classes = [StoreTokenAuthentication]
    permission_classes     = [IsAuthenticated]
    pagination_class       = CustomPagination

    def get(self, request, *args, **kwargs):
        from django.core.cache import cache
        import pickle

        store = request.user

        if not store.latitude or not store.longitude:
            return Response({"error": "Store latitude and longitude are not available."}, status=400)

        store_lat, store_lon = store.latitude, store.longitude

        # 🔍 Search/filter params
        search_query = request.query_params.get('search')
        start_date   = request.query_params.get('start_date')
        end_date     = request.query_params.get('end_date')
        page         = request.query_params.get('page', '1')

        # ⚡ Redis Cache Check
        # Skip cache for search/date-filter requests (dynamic results)
        use_cache = not search_query and not start_date and not end_date
        cache_key = None

        if use_cache:
            store_version = cache.get(f"store_{store.id}_cache_version", 0)
            geo_prefix = store.geohash[:4] if store.geohash else f"{round(store_lat,2)}_{round(store_lon,2)}"
            today_str  = timezone.localtime(timezone.now(), LOCAL_DATE_TZ).date().isoformat()
            cache_key  = f"nearby_rx:store_{store.id}:v{store_version}:{geo_prefix}:{today_str}:page_{page}"
            cached = cache.get(cache_key)
            if cached is not None:
                # ✅ Cache HIT — return instantly without any DB query
                return Response(cached)

        # ── DB Query (Cache MISS or dynamic request) ──────────────────────

        # 🔍 Get prescriptions sent to this store
        target_ids = list(PrescriptionTargetStore.objects.filter(store=store).values_list('prescription_id', flat=True))

        # Controlled dispatch: stores see only prescriptions assigned to them.
        prescriptions = Prescription.objects.filter(id__in=target_ids).order_by('-uploaded_at')

        # 🔍 Search
        if search_query:
            prescriptions = prescriptions.filter(
                Q(user__name__icontains=search_query) |
                Q(user_address__icontains=search_query)
            )

        # 📅 Date
        if start_date and end_date:
            try:
                start = datetime.strptime(start_date, "%Y-%m-%d").date()
                end   = datetime.strptime(end_date, "%Y-%m-%d").date()
                start_datetime, end_datetime = get_local_day_bounds(start, end)
                prescriptions = prescriptions.filter(uploaded_at__gte=start_datetime, uploaded_at__lt=end_datetime)
            except ValueError:
                return Response({"error": "Invalid date format. Use YYYY-MM-DD."}, status=400)
        else:
            # Default to today only
            today = timezone.localtime(timezone.now(), LOCAL_DATE_TZ).date()
            start_datetime, end_datetime = get_local_day_bounds(today, today)
            prescriptions = prescriptions.filter(uploaded_at__gte=start_datetime, uploaded_at__lt=end_datetime)

        # The target-store table is now the dispatch boundary. Geo pruning is done
        # before a store is targeted, not while listing its assigned requests.

        # 📍 Optimized PostGIS Query: Filter and calculate distance in DB
        from django.contrib.gis.db.models.functions import Distance
        from django.contrib.gis.measure import D
        prescriptions = prescriptions.annotate(
            distance=Distance('location', store.location)
        )

        from django.db.models import Exists, OuterRef, Subquery, IntegerField
        
        # 🚀 Efficiently annotate all required fields in a single optimized query
        res_qs = PrescriptionResponse.objects.filter(prescription=OuterRef('pk'), store=store)
        thr_qs = ChatThread.objects.filter(prescription=OuterRef('pk'), store=store).values('id')[:1]

        prescriptions = prescriptions.annotate(
            has_responded=Exists(res_qs),
            response_id=Subquery(res_qs.values('id')[:1]),
            user_status=Subquery(res_qs.values('user_status')[:1]),
            delivery_option=Subquery(res_qs.values('delivery_option')[:1]),
            user_contact_note=Subquery(res_qs.values('user_contact_note')[:1]),
            store_contact_note=Subquery(res_qs.values('store_contact_note')[:1]),
            is_locked=Subquery(res_qs.values('is_locked')[:1]),
            is_unresponsive=Subquery(res_qs.values('is_unresponsive')[:1]),
            last_refresh_requested_at=Subquery(res_qs.values('last_refresh_requested_at')[:1]),
            stock_verified_at=Subquery(res_qs.values('stock_verified_at')[:1]),
            is_processing_started=Subquery(res_qs.values('is_processing_started')[:1]),
            is_packed=Subquery(res_qs.values('is_packed')[:1]),
            cancelled_by=Subquery(res_qs.values('cancelled_by')[:1]),
            cancel_reason=Subquery(res_qs.values('cancel_reason')[:1]),
            chat_thread_id=Subquery(thr_qs)
        ).distinct().select_related('user')

        # 🧭 Priority Sort: Emergency First, then Latest First, then Distance
        # ✅ Python-level dedup as double safety (DB distinct already handles it)
        seen_ids = set()
        results = []
        for p in prescriptions:
            if p.id not in seen_ids:
                seen_ids.add(p.id)
                results.append(p)
        for p in results:
            p.store_lat = store.latitude
            p.store_lon = store.longitude
            p.store_address = store.address
            # distance is a Distance object, convert to km float for serializer
            p.distance_km_val = p.distance.km if p.distance else 999
            
        results.sort(key=lambda p: (p.status != 'emergency', -p.uploaded_at.timestamp(), p.distance_km_val))

        # 📄 Pagination & Result
        paginator = self.pagination_class()
        page_data = paginator.paginate_queryset(results, request)
        page_prescription_ids = [p.id for p in page_data]
        if page_prescription_ids:
            PrescriptionTargetStore.objects.filter(
                store=store,
                prescription_id__in=page_prescription_ids,
                opened_at__isnull=True
            ).update(opened_at=timezone.now())

        response_ids = [p.response_id for p in page_data if getattr(p, 'response_id', None)]
        user_report_counts = defaultdict(int)
        user_report_notes = {}
        store_report_counts = defaultdict(int)

        for report in ReportNote.objects.filter(response_id__in=response_ids).order_by('response_id', '-created_at'):
            user_report_counts[report.response_id] += 1
            user_report_notes.setdefault(report.response_id, report.note)

        for row in StoreReportNote.objects.filter(response_id__in=response_ids).values('response_id').annotate(count=Count('id')):
            store_report_counts[row['response_id']] = row['count']

        for prescription in page_data:
            response_id = getattr(prescription, 'response_id', None)
            prescription.prefetched_user_report_count = user_report_counts[response_id]
            prescription.prefetched_user_report_note = user_report_notes.get(response_id)
            prescription.prefetched_store_report_count = store_report_counts[response_id]

        serializer = PrescriptionSerializer(page_data, many=True, context={'request': request})
        response_data = paginator.get_paginated_response(serializer.data).data


        # 💾 Store in Redis cache (30 seconds TTL)
        # Short TTL ensures store sees new prescriptions quickly
        if use_cache and cache_key:
            cache.set(cache_key, response_data, timeout=30)

        return Response(response_data)




class LanguagePreferenceView(APIView):
    """Read or update the authenticated customer/store language preference."""
    authentication_classes = [StoreTokenAuthentication, UserTokenAuthentication]
    permission_classes = [IsAuthenticated]
    supported_languages = {'en': 'English', 'hi': 'हिन्दी', 'mr': 'मराठी'}

    def get(self, request):
        language = getattr(request.user, 'preferred_language', 'en') or 'en'
        return Response({
            'preferred_language': language,
            'language_label': self.supported_languages[language],
            'supported_languages': [
                {'code': code, 'label': label}
                for code, label in self.supported_languages.items()
            ],
        })

    def patch(self, request):
        language = str(request.data.get('preferred_language', '')).strip().lower()
        if language not in self.supported_languages:
            return Response({
                'error': _('Unsupported language. Choose English, Hindi, or Marathi.'),
                'code': 'unsupported_language',
                'supported_languages': list(self.supported_languages),
            }, status=400)

        account = request.user
        if account.preferred_language != language:
            account.preferred_language = language
            account.save(update_fields=['preferred_language'])

        with override(language):
            message = _('Language preference updated successfully.')
        return Response({
            'preferred_language': language,
            'language_label': self.supported_languages[language],
            'message': message,
        })


class AppNotificationListView(APIView):
    authentication_classes = [StoreTokenAuthentication, UserTokenAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        limit_raw = request.query_params.get('limit', 50)
        try:
            limit = max(1, min(int(limit_raw), 100))
        except (TypeError, ValueError):
            limit = 50

        notifications, unread_count = get_app_notifications_for_actor(request.user, limit=limit)
        return Response({
            "results": [serialize_app_notification(item) for item in notifications],
            "unread_count": unread_count,
        }, status=200)


class AppNotificationMarkReadView(APIView):
    authentication_classes = [StoreTokenAuthentication, UserTokenAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request):
        notification_id = request.data.get('id')
        unread_count = mark_app_notifications_read(request.user, notification_id=notification_id)
        return Response({"unread_count": unread_count}, status=200)


class SaveExpoPushTokenView(APIView):
    authentication_classes = [StoreTokenAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request):
        token = request.data.get("expo_push_token")
        user = request.user
        if token:
            user.expo_push_token = token
            user.save()
            return Response({"message": "Expo push token saved"})
        return Response({"error": "No token provided"}, status=400)

class SaveUserExpoPushTokenView(APIView):
    authentication_classes = [UserTokenAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request):
        token = request.data.get("expo_push_token")
        user = request.user

        if not token:
            return Response({"error": "No token provided"}, status=400)

        user.expo_push_token = token
        user.save(update_fields=["expo_push_token"])

        return Response({"message": "User expo push token saved"})
class UserListView(generics.ListAPIView):
    permission_classes = [AllowAny]  # Allow unauthenticated users to access login

    queryset = User.objects.all()
    serializer_class = UserSerializer
    filter_backends = [
        DjangoFilterBackend,
        filters.SearchFilter,
        filters.OrderingFilter
    ]
    filterset_fields = ['pincode']
    search_fields = ['name', 'email', 'mobile', 'address']
    ordering_fields = ['name', 'id', 'pincode']
    ordering = ['id']

class UserDetailUpdateDeleteView(APIView):
    permission_classes = [AllowAny]  # Allow unauthenticated users to access login

    def get(self, request, pk):
        try:
            user = User.objects.get(pk=pk)
            serializer = UserSerializer(user)
            return Response(serializer.data)
        except User.DoesNotExist:
            return Response({"error": "User not found"}, status=404)

    def put(self, request, pk):
        try:
            user = User.objects.get(pk=pk)
            serializer = UserSerializer(user, data=request.data)
            if serializer.is_valid():
                serializer.save()
                return Response(serializer.data)
            return Response(serializer.errors, status=400)
        except User.DoesNotExist:
            return Response({"error": "User not found"}, status=404)

    def delete(self, request, pk):
        try:
            user = User.objects.get(pk=pk)
            delete_user_account(user, reason="legacy_user_delete_endpoint")
            return Response({"msg": "User account deactivated", "status": "user_deleted"})
        except User.DoesNotExist:
            return Response({"error": "User not found"}, status=404)

class AccountDeleteView(APIView):
    authentication_classes = [StoreTokenAuthentication, UserTokenAuthentication]
    permission_classes = [IsAuthenticated]

    def delete(self, request):
        account = request.user
        if getattr(account, 'is_store', False):
            delete_store_account(account, reason="self_delete_account", changed_by=account)
            return Response({"msg": "Store account deactivated", "status": "store_deleted"})

        delete_user_account(account, reason="self_delete_account", changed_by=account)
        return Response({"msg": "User account deactivated", "status": "user_deleted"})

class StoreAuthentication(BaseAuthentication):
    permission_classes = [AllowAny]  # Allow unauthenticated users to access login

    def authenticate(self, request):
        auth_header = request.headers.get('Authorization')
        if not auth_header:
            return None
        try:
            token = auth_header.split(' ')[1]
            store = Store.objects.get(token=token)
            return (store, None)
        except (IndexError, Store.DoesNotExist):
            return None

class StoreLogoutView(APIView):
    authentication_classes = [StoreTokenAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request):
        store = request.user
        store.token = None
        store.save()
        return Response({"msg": "Store Logout successful."})


class StoreRegisterView(APIView):
    permission_classes = [AllowAny]
    parser_classes = [MultiPartParser, FormParser]

    def get_lat_lon(self, address):
        api_key = "pk.cbb40b1c742acc9020479ee5e647eb64"
        url = "https://us1.locationiq.com/v1/search"
        params = {
            'key': api_key,
            'q': address,
            'format': 'json',
            'limit': 1,
        }
        try:
            response = requests.get(url, params=params, timeout=5)
            response.raise_for_status()
            data = response.json()
            if data and isinstance(data, list) and len(data) > 0:
                lat = data[0].get('lat')
                lon = data[0].get('lon')
                if lat and lon:
                    return float(lat), float(lon)
        except (requests.RequestException, ValueError) as e:
            logger.warning(f"LocationIQ API error: {e}")
        return None, None

    def post(self, request):
        try:
            serializer = StoreSerializer(data=request.data)
            if serializer.is_valid():
                address = serializer.validated_data['address']
                latitude = serializer.validated_data.get('latitude')
                longitude = serializer.validated_data.get('longitude')
                if latitude is None or longitude is None:
                    latitude, longitude = self.get_lat_lon(address)

                Store.objects.create(
                    name=serializer.validated_data['name'],
                    owner_name=serializer.validated_data['owner_name'],
                    mobile=serializer.validated_data['mobile'],
                    email=serializer.validated_data['email'],
                    address=address,
                    pincode=serializer.validated_data['pincode'],
                    gst_number=serializer.validated_data.get('gst_number'),
                    drug_license_number=serializer.validated_data.get('drug_license_number'),
                    store_license_document=serializer.validated_data.get('store_license_document'),
                    owner_id_proof=serializer.validated_data.get('owner_id_proof'),
                    store_image=serializer.validated_data.get('store_image'),
                    latitude=latitude,
                    longitude=longitude,
                    password=request.data['password'],
                )
                return Response({"msg": "Store registered successfully!"}, status=201)

            logger.warning(f"Store registration validation failed: {serializer.errors}")
            return Response({
                "message": "Store registration failed.",
                "errors": serializer.errors,
            }, status=400)

        except Exception as e:
            print("Unexpected error:", e)
            return Response({"error": "Store registration failed."}, status=400)

class StoreLoginView(APIView):
    permission_classes = [AllowAny]  # Allow unauthenticated users to access login

    permission_classes = [AllowAny]  # Allow unauthenticated users to access login

    def post(self, request):
        serializer = StoreLoginSerializer(data=request.data)
        if serializer.is_valid():
            try:
                store = Store.objects.get(email=serializer.validated_data['email'])
                if store.check_password(serializer.validated_data['password']):
                    store_status = get_store_lifecycle_status(store)
                    if store_status.value == "store_deleted":
                        return Response({"error": "Store account has been deleted."}, status=403)
                    if store_status.value == "store_inactive":
                        return Response({"error": "Store account is inactive."}, status=403)
                    # Generate or reuse token
                    if not store.token:
                        store.token = str(uuid.uuid4())
                        store.save()
                    return Response({
                        "msg": "Login successful",
                        "store_id": store.id,
                        "token": store.token,
                        "user_type": "store"

                    })
                else:
                    return Response({"error": "Invalid credentials"}, status=401)
            except Store.DoesNotExist:
                return Response({"error": "Store not found"}, status=404)
        return Response(serializer.errors, status=400)

# class StoreMeView(APIView):
#     authentication_classes = [StoreTokenAuthentication]
#     permission_classes     = [IsAuthenticated]

#     def get(self, request, *args, **kwargs):
#         store = request.user            # authenticated Store instance
#         serializer = StoreMeSerializer(store, context={"request": request})
#         return Response(serializer.data)
# class StoreMeView(APIView):
#     authentication_classes = [StoreTokenAuthentication]
#     permission_classes     = [IsAuthenticated]
#     parser_classes         = [JSONParser]  # 👈 Add this line

#     def get(self, request, *args, **kwargs):
#         store = request.user
#         serializer = StoreMeSerializer(store, context={"request": request})
#         return Response(serializer.data)

#     def patch(self, request, *args, **kwargs):  # 👈 Add PATCH handler
#         store = request.user
#         serializer = StoreMeSerializer(store, data=request.data, partial=True)
#         if serializer.is_valid():
#             serializer.save()
#             return Response(serializer.data)
#         return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
class StoreDeliverySettingsView(APIView):
    authentication_classes = [StoreTokenAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        settings_obj = get_or_create_delivery_settings(request.user)
        return Response(StoreDeliverySettingsSerializer(settings_obj, context={'store': request.user}).data)

    def patch(self, request):
        settings_obj = get_or_create_delivery_settings(request.user)
        serializer = StoreDeliverySettingsSerializer(
            settings_obj,
            data=request.data,
            partial=True,
            context={'store': request.user},
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class StoreDeliveryPersonListCreateView(APIView):
    authentication_classes = [StoreTokenAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        people = StoreDeliveryPerson.objects.filter(store=request.user)
        return Response(StoreDeliveryPersonSerializer(people, many=True).data)

    def post(self, request):
        serializer = StoreDeliveryPersonSerializer(data=request.data, context={'store': request.user})
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=201)


class StoreDeliveryPersonDetailView(APIView):
    authentication_classes = [StoreTokenAuthentication]
    permission_classes = [IsAuthenticated]

    def _get_person(self, request, person_id):
        try:
            return StoreDeliveryPerson.objects.get(id=person_id, store=request.user)
        except StoreDeliveryPerson.DoesNotExist:
            raise NotFound('Delivery person not found.')

    def patch(self, request, person_id):
        person = self._get_person(request, person_id)
        deactivating = request.data.get('is_active') is False or request.data.get('is_available') is False
        if deactivating and person.replacement_assignments.filter(status='in_transit').exists():
            return Response({'error': 'This delivery person has an active replacement delivery.'}, status=409)
        serializer = StoreDeliveryPersonSerializer(person, data=request.data, partial=True, context={'store': request.user})
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    def delete(self, request, person_id):
        person = self._get_person(request, person_id)
        has_active_order = person.assigned_offers.filter(response__user_status__in=['accepted', 'processing', 'out_for_delivery']).exists()
        has_active_replacement = person.replacement_assignments.filter(status='in_transit').exists()
        if has_active_order or has_active_replacement:
            return Response({'error': 'Deactivate this delivery person after active deliveries are completed.'}, status=409)
        person.is_active = False
        person.is_available = False
        person.save(update_fields=['is_active', 'is_available', 'updated_at'])
        return Response(status=204)


class PrescriptionDeliveryPreviewView(APIView):
    authentication_classes = [StoreTokenAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request, prescription_id):
        try:
            prescription = Prescription.objects.get(
                id=prescription_id,
                target_stores__store=request.user,
            )
        except Prescription.DoesNotExist:
            raise NotFound('Prescription is not assigned to this store.')
        result = evaluate_delivery_eligibility(request.user, prescription)
        return Response(result)


class StoreMeView(APIView):
    authentication_classes = [StoreTokenAuthentication]
    permission_classes     = [IsAuthenticated]
    parser_classes         = [JSONParser, MultiPartParser, FormParser]   # JSON + multipart both

    # 1️⃣ GET profile
    def get(self, request, *args, **kwargs):
        store = request.user
        serializer = StoreMeSerializer(store, context={"request": request})
        return Response(serializer.data)


    def patch(self, request, *args, **kwargs):
     store = request.user
     data = request.data.copy()

     file_fields = ['store_license_document', 'owner_id_proof', 'store_image']

     for field in file_fields:
        if field in data and data[field] in [None, '', 'null', 'undefined']:
            getattr(store, field).delete(save=False)
            setattr(store, field, None)
            data.pop(field)

     serializer = StoreMeUpdateSerializer(store, data=data, partial=True)
     if serializer.is_valid():
        serializer.save()
        # ✅ response में GET serializer भेजें
        response_data = StoreMeSerializer(store, context={"request": request}).data
        return Response(response_data, status=200)
     return Response(serializer.errors, status=400)


    # 2️⃣ PATCH update / delete doc
    # def patch(self, request, *args, **kwargs):
    #     store = request.user
    #     data  = request.data.copy()

    #     # 🗑️ list all file fields that can be deleted
    #     file_fields = [
    #         'store_license_document',
    #         'owner_id_proof',
    #         'store_image',
    #     ]

    #     # 2a. delete requested files when value is null / '' / 'null'
    #     for field in file_fields:
    #         if field in data and (data[field] in [None, '', 'null', 'undefined']):
    #             getattr(store, field).delete(save=False)   # physically remove
    #             setattr(store, field, None)
    #             data.pop(field)  # remove so serializer won't complain

    #     # 2b. normal partial update (including new uploads)
    #     serializer = StoreMeSerializer(store, data=data, partial=True, context={'request': request})
    #     if serializer.is_valid():
    #         serializer.save()
    #         return Response(serializer.data, status=status.HTTP_200_OK)

    #     return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class StoreListView(generics.ListAPIView):
    permission_classes = [AllowAny]  # Allow unauthenticated users to access login

    queryset = Store.objects.all()
    serializer_class = StoreSerializer
    filter_backends = [
        DjangoFilterBackend,
        filters.SearchFilter,
        filters.OrderingFilter
    ]
    filterset_fields = ['pincode']   # You can add more fields
    search_fields = ['name', 'owner_name', 'email', 'mobile', 'address']
    ordering_fields = ['name', 'id', 'pincode']
    ordering = ['id']
class StoreDetailUpdateDeleteView(APIView):
    permission_classes = [AllowAny]  # Allow unauthenticated users to access login

    def get(self, request, pk):
        try:
            store = Store.objects.get(pk=pk)
            serializer = StoreSerializer(store)
            return Response(serializer.data)
        except Store.DoesNotExist:
            return Response({"error": "Store not found"}, status=404)

    def put(self, request, pk):
        try:
            store = Store.objects.get(pk=pk)
            serializer = StoreSerializer(store, data=request.data, partial=True)
            if serializer.is_valid():
                serializer.save()
                return Response(serializer.data)
            return Response(serializer.errors, status=400)
        except Store.DoesNotExist:
            return Response({"error": "Store not found"}, status=404)

    def delete(self, request, pk):
        try:
            store = Store.objects.get(pk=pk)
            delete_store_account(store, reason="legacy_store_delete_endpoint")
            return Response({"msg": "Store account deactivated", "status": "store_deleted"})
        except Store.DoesNotExist:
            return Response({"error": "Store not found"}, status=404)

class LocationSearchThrottle(UserRateThrottle):
    scope = 'location_search'

# L1 In-flight Cache Stampede Protection
_inflight_location_searches = {}

class LocationSearchView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [LocationSearchThrottle]

    def get(self, request):
        return async_to_sync(self._async_get)(request)

    async def _async_get(self, request):
        query = request.query_params.get('q', '').strip().lower() # 4. Cache Key Optimization (Normalize)
        lat = request.query_params.get('lat')
        lon = request.query_params.get('lon')
        if not query:
            return Response([], status=200)

        from django.conf import settings
        from asgiref.sync import sync_to_async
        import hashlib
        query_hash = hashlib.md5(query.encode('utf-8')).hexdigest()
        cache_key = f"location_search_{query_hash}_{lat}_{lon}"

        # 1. Check Redis Cache (Async Context Safe)
        cached_data = await sync_to_async(cache.get)(cache_key)
        if cached_data:
            return Response(cached_data, status=200)

        # 2. Cache Stampede Protection (Deduplicate concurrent identical requests)
        if cache_key in _inflight_location_searches:
            try:
                # Wait for the first request to fetch data
                data = await _inflight_location_searches[cache_key]
                return Response(data, status=200)
            except Exception:
                pass  # Fallback to fetching if the other request fails

        loop = asyncio.get_running_loop()
        future = loop.create_future()
        _inflight_location_searches[cache_key] = future

        data = []
        timeout_val = 3.0 # 2. Timeout Handling properly (3s)
        
        try:
            google_key = getattr(settings, 'GOOGLE_PLACES_API_KEY', None)
            mapbox_key = getattr(settings, 'MAPBOX_API_KEY', None) or 'pk.eyJ1IjoicmFodWw4NDk5IiwiYSI6ImNreWZoaGZ5aDE1YWUydXVydmRqYXRidDUifQ.t5UNUnDH9pGxp91_sTMD-A'

            async with httpx.AsyncClient(timeout=timeout_val) as client: # 1. Blocking API Calls fix (Async)
                for attempt in range(2): # 3. Retry Logic
                    try:
                        if google_key:
                            session_token = request.query_params.get('sessiontoken', '')
                            url = f"https://maps.googleapis.com/maps/api/place/autocomplete/json?input={query}&components=country:in&key={google_key}"
                            if session_token:
                                url += f"&sessiontoken={session_token}"
                            
                            # Add proximity bias if coordinates are provided
                            if lat and lon:
                                url += f"&location={lat},{lon}&radius=50000"

                            res = await client.get(url)
                            json_res = res.json()
                            if json_res.get('status') == 'OK':
                                predictions = json_res.get('predictions', [])
                                for item in predictions[:5]:
                                    data.append({
                                        "place_id": item.get('place_id'),
                                        "display_name": item.get('description'),
                                        "lat": "", # Google Autocomplete doesn't return lat/lon directly
                                        "lon": "",
                                        "is_prediction": True
                                    })
                            else:
                                logger.warning(f"Google Autocomplete API failed: {json_res}")
                        
                        # Fallback to Mapbox if Google didn't return data (e.g. no key, billing error)
                        if not data and mapbox_key:
                            proximity_param = f"&proximity={lon},{lat}" if lat and lon else ""
                            url = f"https://api.mapbox.com/geocoding/v5/mapbox.places/{query}.json?access_token={mapbox_key}&limit=5&country=in{proximity_param}"
                            res = await client.get(url)
                            if res.status_code == 200:
                                features = res.json().get('features', [])
                                for item in features:
                                    data.append({
                                        "place_id": item.get('id'),
                                        "display_name": item.get('place_name'),
                                        "lat": str(item['center'][1]),
                                        "lon": str(item['center'][0]),
                                    })
                            else:
                                logger.warning(f"Mapbox API failed: {res.text}")
                        
                        # Fallback to Nominatim if Mapbox also failed
                        if not data:
                            url = f"https://nominatim.openstreetmap.org/search?q={query}&format=json&addressdetails=1&limit=5&countrycodes=in"
                            headers = {
                                'User-Agent': 'AarxElite/1.0',
                                'Referer': settings.ALLOWED_HOSTS[0] if settings.ALLOWED_HOSTS else 'https://aarx.elite.in',
                            }
                            res = await client.get(url, headers=headers)
                            if res.status_code == 200:
                                nominatim_data = res.json()
                                for item in nominatim_data:
                                    data.append({
                                        "place_id": str(item.get('place_id')),
                                        "display_name": item.get('display_name'),
                                        "lat": item.get('lat'),
                                        "lon": item.get('lon'),
                                    })
                        
                        if data: break # Success, break retry loop

                    except (httpx.RequestError, httpx.TimeoutException) as exc:
                        logger.warning(f"Attempt {attempt + 1} failed for {query}: {exc}")
                        if attempt == 1: raise # Re-raise on last attempt

            # 3. Store in Redis Cache for 24 hours (Async Safe)
            if data:
                await sync_to_async(cache.set)(cache_key, data, timeout=60*60*24)
                
            future.set_result(data)

            return Response(data, status=200)

        except Exception as e:
            if not future.done():
                future.set_exception(e)
            logger.error(f"Location search failure for {query}: {e}") # 6. Logging System
            return Response({"error": "Failed to fetch suggestions"}, status=400)
            _inflight_location_searches.pop(cache_key, None)

# --- Chat API Views ---


class ChatInboxView(APIView):
    authentication_classes = [StoreTokenAuthentication, UserTokenAuthentication]
    # permission_classes = [IsAuthenticated]    
    def get(self, request):
        user = request.user
        
        # 🚀 Production Optimization: Queryset Prefetching
        # To avoid N+1 queries for the latest_message, we find the latest message ID per thread
        from django.db.models import Count, OuterRef, Q, Subquery
        
        if hasattr(user, 'owner_name'):
            base_threads = ChatThread.objects.filter(store=user)
            unread_sender_type = 'user'
        else:
            base_threads = ChatThread.objects.filter(user=user)
            unread_sender_type = 'store'

        # Annotate latest message/status data to avoid serializer N+1 queries.
        latest_msg_id_qs = ChatMessage.objects.filter(thread=OuterRef('pk')).order_by('-created_at').values('id')[:1]
        order_status_qs = PrescriptionResponse.objects.filter(
            prescription_id=OuterRef('prescription_id'),
            store_id=OuterRef('store_id'),
            user_id=OuterRef('user_id'),
        ).exclude(user_status__in=['rejected', 'dismissed', 'expired']).order_by('-created_at')
        
        threads = base_threads.annotate(
            latest_msg_id=Subquery(latest_msg_id_qs),
            order_status_value=Subquery(order_status_qs.values('user_status')[:1]),
            unread_count=Count(
                'messages',
                filter=Q(messages__is_read=False, messages__sender_type=unread_sender_type)
            )
        ).select_related('user', 'store', 'prescription').order_by('-updated_at')

        # Prefetch only the latest messages
        latest_ids = [t.latest_msg_id for t in threads if t.latest_msg_id]
        latest_msgs = {m.id: m for m in ChatMessage.objects.filter(id__in=latest_ids).select_related('reply_to')}
        
        # Attach to threads (so serializer can find them without querying)
        for t in threads:
            t.prefetched_latest_message = latest_msgs.get(t.latest_msg_id)

        serializer = ChatThreadSerializer(threads, many=True, context={'request': request})
        return Response(serializer.data, status=200)

class ChatThreadMessagesView(APIView):
    authentication_classes = [StoreTokenAuthentication, UserTokenAuthentication]
    permission_classes = [IsAuthenticated]    

    def get(self, request, thread_id):
        user = request.user

        try:
            thread = ChatThread.objects.get(id=thread_id)
        except ChatThread.DoesNotExist:
            return Response({"error": "Thread not found"}, status=404)
            
        messages = thread.messages.all().order_by('-created_at')
        paginator = PageNumberPagination()
        paginator.page_size = 50
        page = paginator.paginate_queryset(messages, request)
        
        # Mark as read for the receiver
        user_type = 'store' if hasattr(request.user, 'owner_name') else 'user'
        unread = thread.messages.filter(is_read=False).exclude(sender_type=user_type)
        unread.update(is_read=True)

        serializer = ChatMessageSerializer(page, many=True)
        response = paginator.get_paginated_response(serializer.data)
        
        # Add thread status
        thread_serializer = ChatThreadSerializer(thread, context={'request': request})
        response.data['other_online'] = thread_serializer.data.get('other_online')
        response.data['other_last_seen'] = thread_serializer.data.get('other_last_seen')
        response.data['prescription_id'] = thread_serializer.data.get('prescription_id')
        response.data['prescription_image'] = thread_serializer.data.get('prescription_image')
        response.data['order_status'] = thread_serializer.data.get('order_status')
        response.data['is_chat_locked'] = thread_serializer.data.get('is_chat_locked')

        return response

class ChatMessageMediaUploadView(APIView):
    authentication_classes = [StoreTokenAuthentication, UserTokenAuthentication]
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request, thread_id):
        print(f"DEBUG: ChatMessageMediaUploadView.post reached for thread_id={thread_id}")
        try:
            thread = ChatThread.objects.get(id=thread_id)
        except ChatThread.DoesNotExist:
            return Response({"error": "Thread not found"}, status=404)

        if thread.is_chat_locked():
            return Response({"detail": "Chat is closed. Order has been completed or cancelled."}, status=403)

        validate_action_capability(Permission.CHAT, actor=request.user, resource=thread)

        user = request.user
        user_type = 'store' if hasattr(request.user, 'owner_name') else 'user'

        # sender_type = get_sender_type(user)

        image = request.FILES.get('image')
        video = request.FILES.get('video')
        image_key = request.data.get('image_key')
        video_key = request.data.get('video_key')
        verified_image_key = verified_video_key = None
        try:
            from core.services.s3_service import validate_uploaded_object_key
            if image_key:
                verified_image_key = validate_uploaded_object_key(image_key, 'chat_images')
            if video_key:
                verified_video_key = validate_uploaded_object_key(video_key, 'chat_videos')
        except (ValueError, RuntimeError) as exc:
            return Response({'error': str(exc)}, status=400)
        reply_to_id = request.data.get('reply_to_id')

        if not image and not video and not verified_image_key and not verified_video_key:
            return Response({"error": "No media provided"}, status=400)

        msg = ChatMessage.objects.create(
            thread=thread,
            sender_type=user_type,
            image=image,
            video=video,
            reply_to_id=reply_to_id,
            is_read=False
        )
        if verified_image_key:
            msg.image.name = verified_image_key
        if verified_video_key:
            msg.video.name = verified_video_key
        if verified_image_key or verified_video_key:
            msg.save(update_fields=['image', 'video'])
        ChatThread.objects.filter(id=thread.id).update(updated_at=timezone.now())

        preview_text = 'Sent you a photo' if (image or verified_image_key) else 'Sent you a video'
        _run_safe_side_effect(
            'create chat media bell',
            lambda: create_chat_message_app_notification(
                thread, user_type, preview_text, message_id=msg.id,
            ),
        )
        _run_safe_side_effect(
            'enqueue chat media push',
            lambda: notify_chat_message_task.delay(thread.id, user_type, preview_text),
        )

        image_url = get_file_url(msg.image, request) if msg.image else None
        video_url = get_file_url(msg.video, request) if msg.video else None

        # 🔥 WebSocket Broadcast
        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            f'chat_{thread_id}',
            {
                'type': 'chat_message',
                'id': msg.id,
                'message': "",
                'sender_type': user_type,
                'sender_id': user.id,
                'created_at': msg.created_at.isoformat(),
                'image': image_url,
                'video': video_url,
                'is_read': False,
                'reply_to': msg.reply_to_id,
                'reply_to_text': msg.reply_to.text[:50] if msg.reply_to else None
            }
        )

        return Response(ChatMessageSerializer(msg).data, status=201)
# class ChatMessageMediaUploadView(APIView):
#     authentication_classes = [StoreTokenAuthentication, UserTokenAuthentication]
#     permission_classes = [IsAuthenticated]
#     parser_classes = [MultiPartParser, FormParser]

#     def post(self, request, thread_id):
#         try:
#             thread = ChatThread.objects.get(id=thread_id)
#         except ChatThread.DoesNotExist:
#             return Response({"error": "Thread not found"}, status=status.HTTP_404_NOT_FOUND)

#         sender_type = 'user' if getattr(request.user, 'is_user', False) else 'store'
#         image = request.FILES.get('image')
#         video = request.FILES.get('video')
#         reply_to_id = request.data.get('reply_to_id')

#         if not image and not video:
#             return Response({"error": "No media provided"}, status=status.HTTP_400_BAD_REQUEST)

#         msg = ChatMessage.objects.create(
#             thread=thread,
#             sender_type=sender_type,
#             image=image,
#             video=video,
#             reply_to_id=reply_to_id,
#             is_read=False
#         )
#         thread.save()

#         # Broadcast via Channels
#         channel_layer = get_channel_layer()
#         async_to_sync(channel_layer.group_send)(
#             f'chat_{thread_id}',
#             {
#                 'type': 'chat_message',
#                 'id': msg.id,
#                 'message': "",
#                 'sender_type': sender_type,
#                 'sender_id': request.user.id,
#                 'created_at': msg.created_at.isoformat(),
#                 'image': get_file_url(msg.image, request) if msg.image else None,
#                 'video': get_file_url(msg.video, request) if msg.video else None,
#                 'is_read': False,
#                 'reply_to': msg.reply_to_id,
#                 'reply_to_text': msg.reply_to.text[:50] if msg.reply_to else None
#             }
#         )

#         serializer = ChatMessageSerializer(msg)
#         return Response(serializer.data, status=status.HTTP_201_CREATED)

class ChatInitView(APIView):
    authentication_classes = [StoreTokenAuthentication, UserTokenAuthentication]
    permission_classes = [IsAuthenticated]    

    def post(self, request):
        store_id = request.data.get('store_id')
        user_id = request.data.get('user_id')
        prescription_id = request.data.get('prescription_id')

        user = request.user
        
        if hasattr(user, 'owner_name'): # True if Store
            u_id = user_id
            s_id = user.id
        else: # Normal User
            u_id = user.id
            s_id = store_id

        if not u_id or not s_id:
            return Response({"error": "Both user_id and store_id are required context."}, status=400)

        target_store = Store.objects.filter(id=s_id).first()
        if target_store:
            validate_action_capability(Permission.CHAT, actor=user, store=target_store)

        # ✅ Distinction between Lookup and Creation
        initial_text = request.data.get('text')

        if initial_text:
            # 🔨 Creation Mode (Strictly on first message)
            thread, created = ChatThread.objects.get_or_create(
                user_id=u_id,
                store_id=s_id,
                prescription_id=prescription_id
            )
            user_type = 'store' if hasattr(user, 'owner_name') else 'user'
            msg = ChatMessage.objects.create(
                thread=thread,
                sender_type=user_type,
                text=initial_text,
                is_read=False
            )
            _run_safe_side_effect(
                'create initial chat bell',
                lambda: create_chat_message_app_notification(
                    thread, user_type, initial_text, message_id=msg.id,
                ),
            )
            _run_safe_side_effect(
                'enqueue initial chat push',
                lambda: notify_chat_message_task.delay(thread.id, user_type, initial_text),
            )
            # Update updated_at
            from django.utils import timezone
            thread.updated_at = timezone.now()
            thread.save()
            
            serializer = ChatThreadSerializer(thread)
            return Response(serializer.data, status=201)
        else:
            # 🔍 Lookup Mode (Navigation Resolution)
            # We ONLY look for existing threads, we DO NOT create.
            thread = ChatThread.objects.filter(
                user_id=u_id,
                store_id=s_id,
                prescription_id=prescription_id
            ).first()
            
            if thread:
                serializer = ChatThreadSerializer(thread)
                return Response(serializer.data, status=200)
            else:
                # No thread exists yet - this is expected in lazy navigation
                return Response({"id": None, "message": "No existing thread."}, status=200)



class ChatAudioUploadView(APIView):
    authentication_classes = [StoreTokenAuthentication, UserTokenAuthentication]
    permission_classes = [IsAuthenticated]    
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request, thread_id):
        try:
            thread = ChatThread.objects.get(id=thread_id)
        except ChatThread.DoesNotExist:
            return Response({"error": "Thread not found"}, status=404)

        if thread.is_chat_locked():
            return Response({"detail": "Chat is closed. Order has been completed or cancelled."}, status=403)

        validate_action_capability(Permission.CHAT, actor=request.user, resource=thread)

        user = request.user
        sender_type = 'store' if hasattr(user, 'owner_name') else 'user'
        
        audio_file = request.FILES.get('audio')
        audio_key = request.data.get('audio_key')
        verified_audio_key = None
        if audio_key:
            try:
                from core.services.s3_service import validate_uploaded_object_key
                verified_audio_key = validate_uploaded_object_key(audio_key, 'chat_audio')
            except (ValueError, RuntimeError) as exc:
                return Response({'error': str(exc)}, status=400)
        if not audio_file and not verified_audio_key:
            return Response({"error": "No audio file provided"}, status=400)

        # Create message
        msg = ChatMessage.objects.create(
            thread=thread,
            sender_type=sender_type,
            audio=audio_file,
            text=""
        )
        if verified_audio_key:
            msg.audio.name = verified_audio_key
            msg.save(update_fields=['audio'])
        _run_safe_side_effect(
            'create chat audio bell',
            lambda: create_chat_message_app_notification(
                thread, sender_type, 'Sent you a voice message', message_id=msg.id,
            ),
        )
        _run_safe_side_effect(
            'enqueue chat audio push',
            lambda: notify_chat_message_task.delay(
                thread.id, sender_type, 'Sent you a voice message',
            ),
        )
        thread.save()

        # Build absolute URI for audio properly
        audio_url = get_file_url(msg.audio, request) if msg.audio else None

        # Broadcast via Channels
        channel_layer = get_channel_layer()
        room_group_name = f'chat_{thread_id}'
        async_to_sync(channel_layer.group_send)(
            room_group_name,
            {
                'type': 'chat_message',
                'id': msg.id,
                'message': '',
                'sender_type': sender_type,
                'sender_id': user.id,
                'created_at': msg.created_at.isoformat(),
                'audio': audio_url,
                'is_read': False
            }
        )

        serializer = ChatMessageSerializer(msg)
        return Response(serializer.data, status=201)

class SubmitRatingView(APIView):
    """
    Submit or update a rating for an order.
    Rules:
    - Must be within 48h of order completion/cancellation.
    - Only 1 edit allowed within 10 min.
    """
    authentication_classes = [StoreTokenAuthentication, UserTokenAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request):
        order_id = request.data.get('order_id')
        rating_val = request.data.get('rating')
        review = request.data.get('review', '')
        tags = request.data.get('tags', [])

        if not order_id or not rating_val:
            return Response({"error": "order_id and rating are required."}, status=400)

        try:
            order = PrescriptionResponse.objects.get(id=order_id)
        except PrescriptionResponse.DoesNotExist:
            return Response({"error": "Order not found."}, status=404)

        # Determine who is giving the rating
        if isinstance(request.user, User):
            if order.user != request.user:
                return Response({"error": "You are not authorized to rate this order."}, status=403)
            given_by = 'user'
            target_type = 'store'
        elif isinstance(request.user, Store):
            if order.store != request.user:
                return Response({"error": "You are not authorized to rate this customer."}, status=403)
            given_by = 'store'
            target_type = 'user'
        else:
            return Response({"error": "Unknown user type."}, status=403)

        # Check for existing rating
        existing_rating = Rating.objects.filter(order=order, given_by=given_by).first()
        
        if existing_rating:
            # Check 10-minute edit rule
            elapsed = (timezone.now() - existing_rating.created_at).total_seconds()
            if elapsed > 600: # 10 minutes
                return Response({"error": "Rating can only be edited within 10 minutes of creation."}, status=400)
            
            if existing_rating.is_edited:
                return Response({"error": "Rating can only be edited once."}, status=400)

            serializer = RatingSerializer(existing_rating, data={
                'rating': rating_val,
                'review': review,
                'tags': tags,
                'is_edited': True
            }, partial=True)
        else:
            serializer = RatingSerializer(data={
                'order': order.id,
                'given_by': given_by,
                'target_type': target_type,
                'rating': rating_val,
                'review': review,
                'tags': tags
            })

        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=201 if not existing_rating else 200)
        
        return Response(serializer.errors, status=400)

class PendingRatingsView(APIView):
    """
    Get a list of orders that are eligible for rating but haven't been rated yet.
    """
    authentication_classes = [StoreTokenAuthentication, UserTokenAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        now = timezone.now()
        window = now - timedelta(hours=48)

        if isinstance(request.user, User):
            # Orders for this user, completed/cancelled within 48h, not rated by user
            pending = PrescriptionResponse.objects.filter(
                user=request.user,
                user_status__in=['completed', 'cancelled'],
                updated_at__gte=window
            ).exclude(
                ratings__given_by='user'
            ).order_by('-updated_at')
            
        elif isinstance(request.user, Store):
            # Orders for this store, completed/cancelled within 48h, not rated by store
            pending = PrescriptionResponse.objects.filter(
                store=request.user,
                user_status__in=['completed', 'cancelled'],
                updated_at__gte=window
            ).exclude(
                ratings__given_by='store'
            ).order_by('-updated_at')
        else:
            return Response({"error": "Unknown user type."}, status=403)

        serializer = PrescriptionResponseSerializer(pending, many=True, context={'request': request})
        return Response(serializer.data)

class StoreReviewsView(APIView):
    authentication_classes = [StoreTokenAuthentication, UserTokenAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request, store_id):
        # Find all ratings where target_type is 'store'
        ratings = Rating.objects.filter(target_type='store', order__store_id=store_id).order_by('-created_at')
        
        data = []
        for r in ratings:
            data.append({
                "id": r.id,
                "rating": r.rating,
                "review": r.review,
                "tags": r.tags,
                "created_at": r.created_at,
                "user_name": r.order.user.name if r.order.user else "Anonymous"
            })
            
        return Response(data, status=200)

class LocationDetailsView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        return async_to_sync(self._async_get)(request)

    async def _async_get(self, request):
        place_id = request.query_params.get('place_id')
        session_token = request.query_params.get('sessiontoken', '')
        
        if not place_id:
            return Response({"error": "place_id is required"}, status=400)
            
        from django.conf import settings
        google_key = getattr(settings, 'GOOGLE_PLACES_API_KEY', None)
        
        if not google_key:
            return Response({"error": "Google API key not configured"}, status=400)
            
        url = f"https://maps.googleapis.com/maps/api/place/details/json?place_id={place_id}&fields=geometry&key={google_key}"
        if session_token:
            url += f"&sessiontoken={session_token}"
            
        async with httpx.AsyncClient(timeout=3.0) as client:
            try:
                res = await client.get(url)
                res.raise_for_status()
                json_res = res.json()
                
                if json_res.get('status') == 'OK':
                    location = json_res['result']['geometry']['location']
                    return Response({
                        "lat": str(location['lat']),
                        "lon": str(location['lng'])
                    }, status=200)
                else:
                    return Response({"error": f"Google API error: {json_res.get('status')}"}, status=400)
            except Exception as e:
                return Response({"error": "Request could not be completed."}, status=400)

from .models import AppRating
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator

@method_decorator(csrf_exempt, name='dispatch')
class SubmitAppRatingView(APIView):
    authentication_classes = [StoreTokenAuthentication, UserTokenAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user_id = request.data.get('user_id')
        store_id = request.data.get('store_id')
        rating = request.data.get('rating')
        feedback = request.data.get('feedback', '')

        if not rating:
            return Response({"error": "Rating is required"}, status=400)

        user = None
        store = None
        if user_id:
            user = User.objects.filter(id=user_id).first()
        if store_id:
            store = Store.objects.filter(id=store_id).first()

        app_rating = AppRating.objects.create(
            user=user,
            store=store,
            rating=int(rating),
            feedback=feedback
        )
        return Response({'success': True, 'id': app_rating.id}, status=201)

class RequestPasswordResetOTPView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        email = request.data.get('email')
        user_type = request.data.get('userType') # 'user' or 'store'

        if not email or not user_type:
            return Response({"error": "Email and user type are required."}, status=400)

        # Check if account exists
        if user_type == 'store':
            account = Store.objects.filter(email=email).only('mobile').first()
        else:
            account = User.objects.filter(email=email).only('mobile').first()

        if not account:
            return Response({"error": "No account found with this email."}, status=404)

        # Generate 6-digit OTP
        otp_code = f"{random.randint(100000, 999999)}"

        # Save to DB (overwrite if exists, or just create new)
        PasswordResetOTP.objects.filter(email=email, user_type=user_type).delete()
        PasswordResetOTP.objects.create(
            email=email,
            user_type=user_type,
            otp_code=otp_code
        )

        # Send email
        try:
            send_mail(
                subject='Password Reset OTP',
                message=f'Your OTP for password reset is: {otp_code}. It is valid for 10 minutes.',
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[email],
                fail_silently=False,
            )
        except Exception as e:
            logger.error(f"Failed to send OTP email: {e}")
            return Response({"error": "Failed to send OTP email. Please check configuration."}, status=400)

        _send_whatsapp_otp(
            account.mobile,
            otp_code,
            settings.WHATSAPP_PASSWORD_RESET_TEMPLATE,
        )

        return Response({"message": "OTP sent successfully."}, status=200)

class VerifyPasswordResetOTPView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        email = request.data.get('email')
        otp_code = request.data.get('otp')
        user_type = request.data.get('userType')

        if not email or not otp_code or not user_type:
            return Response({"error": "Email, OTP and user type are required."}, status=400)

        otp_record = PasswordResetOTP.objects.filter(
            email=email, 
            user_type=user_type, 
            otp_code=otp_code
        ).order_by('-created_at').first()

        if not otp_record:
            return Response({"error": "Invalid OTP."}, status=400)

        # Check expiration (10 minutes)
        if timezone.now() - otp_record.created_at > timedelta(minutes=10):
            otp_record.delete()
            return Response({"error": "OTP has expired."}, status=400)

        otp_record.is_verified = True
        otp_record.save()

        return Response({"message": "OTP verified successfully."}, status=200)

class ConfirmPasswordResetView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        email = request.data.get('email')
        new_password = request.data.get('password')
        user_type = request.data.get('userType')

        if not email or not new_password or not user_type:
            return Response({"error": "Missing required fields."}, status=400)

        # Check if OTP was verified recently
        otp_record = PasswordResetOTP.objects.filter(
            email=email, 
            user_type=user_type, 
            is_verified=True
        ).order_by('-created_at').first()

        if not otp_record:
            return Response({"error": "OTP not verified. Please verify OTP first."}, status=400)

        # Expiry logic for verified OTP (e.g., 15 mins to reset password)
        if timezone.now() - otp_record.created_at > timedelta(minutes=15):
            otp_record.delete()
            return Response({"error": "Session expired. Please request a new OTP."}, status=400)

        # Reset password
        if user_type == 'store':
            account = Store.objects.filter(email=email).first()
        else:
            account = User.objects.filter(email=email).first()

        if not account:
            return Response({"error": "Account not found."}, status=404)

        # The models' save method hashes the password when not self.pk. 
        # But for updates, we must hash it explicitly since the model save() only hashes if not self.pk.
        # Wait, let's check models.py:
        # def save(self, *args, **kwargs):
        #     if not self.pk:
        #         self.password = make_password(self.password)
        # So we use make_password here.
        from django.contrib.auth.hashers import make_password
        account.password = make_password(new_password)
        account.save(update_fields=['password'])

        # Delete the OTP record so it can't be reused
        otp_record.delete()

        return Response({"message": "Password reset successfully."}, status=200)
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .authentication import StoreTokenAuthentication
from .models import Prescription, PrescriptionResponse, StoreReportNote
from django.db import transaction

class StoreRejectEnquiryView(APIView):
    authentication_classes = [StoreTokenAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request, prescription_id):
        store = request.user
        reason = request.data.get('reason', 'Not available')
        
        try:
            prescription = Prescription.objects.get(id=prescription_id)
        except Prescription.DoesNotExist:
            return Response({"error": "Prescription not found"}, status=404)
            
        # Check if already responded
        existing = PrescriptionResponse.objects.filter(store=store, prescription=prescription).first()
        if existing:
            return Response({"error": "Already responded to this enquiry."}, status=400)
            
        with transaction.atomic():
            # Create a rejected response
            response = PrescriptionResponse.objects.create(
                prescription=prescription,
                store=store,
                user=prescription.user,
                store_name=store.name,
                store_contact=store.mobile,
                user_status='rejected',
                cancelled_by='store',
                cancel_reason=reason,
                total_amount=0.0
            )
            
            # Log the reason
            StoreReportNote.objects.create(
                response=response,
                store=store,
                note=reason
            )
            
            # Update target store status
            from .models import PrescriptionTargetStore
            target = PrescriptionTargetStore.objects.filter(prescription=prescription, store=store).first()
            if target:
                target.status = 'skipped'
                target.save()
                
        return Response({
            "message": "Enquiry rejected successfully.",
            "response_id": response.id
        }, status=201)


# ---------------------------------------------------------------------------
# Order-bound Ask a Pharmacist
# ---------------------------------------------------------------------------
def _consultation_actor(request):
    if isinstance(request.user, Store):
        return 'store', request.user
    if isinstance(request.user, User):
        return 'user', request.user
    return None, None


def _consultation_file_url(request, field):
    return get_file_url(field, request)


def _consultation_order_context(request, consultation):
    order = consultation.order
    prescription = order.prescription
    image = order.image or (prescription.image if prescription else None)
    try:
        offer_distance = order.delivery_offer.distance_km
    except QuoteDeliveryOffer.DoesNotExist:
        offer_distance = None
    distance = offer_distance if offer_distance is not None else order.distance_km
    return {
        'id': order.id, 'status': order.user_status,
        'delivery_option': order.delivery_option,
        'distance_km': str(distance) if distance is not None else None,
        'customer_name': order.user.name, 'customer_mobile': order.user.mobile,
        'customer_address': (prescription.user_address if prescription and prescription.user_address else order.user.address),
        'prescription_image_url': _consultation_file_url(request, image) if image else None,
        'prescription_medicine_name': getattr(prescription, 'medicine_name', None),
        'prescription_description': getattr(prescription, 'description', None),
        'response_text': order.response_text,
        'total_amount': str(order.total_amount) if order.total_amount is not None else None,
        'created_at': order.created_at, 'completed_at': order.completed_at,
        'medicines': [{
            'name': medicine.medicine_name, 'brand': medicine.medicine_brand,
            'type': medicine.get_medicine_type_display(),
            'price': str(medicine.price) if medicine.price is not None else None,
            'is_available': medicine.is_available,
        } for medicine in order.medicines.all()],
        'timeline': [{
            'from_status': entry.from_status, 'to_status': entry.to_status,
            'reason': entry.reason, 'changed_by': entry.changed_by_name,
            'created_at': entry.created_at,
        } for entry in reversed(list(order.status_history.all()))],
    }


def _serialize_consultation(request, consultation):
    actor_type, _ = _consultation_actor(request)
    store = consultation.store
    return {
        'id': consultation.id, 'order_id': consultation.order_id,
        'category': consultation.category, 'category_display': consultation.get_category_display(),
        'medicine_name': consultation.medicine_name, 'question': consultation.question,
        'status': consultation.status, 'status_display': consultation.get_status_display(),
        'callback_requested': consultation.callback_requested,
        'callback_phone': consultation.callback_phone if actor_type == 'store' else '',
        'callback_preferred_time': consultation.callback_preferred_time,
        'pharmacy_name': store.name, 'pharmacy_phone': store.mobile,
        'pharmacist_name': store.pharmacist_name if store.is_pharmacist_verified else '',
        'pharmacist_verified': store.is_pharmacist_verified,
        'pharmacist_available': bool(store.is_pharmacist_verified and store.pharmacist_available),
        'created_at': consultation.created_at, 'updated_at': consultation.updated_at,
        'order_context': _consultation_order_context(request, consultation),
        'messages': [{
            'id': message.id, 'sender_type': message.sender_type, 'text': message.text,
            'attachment': _consultation_file_url(request, message.attachment),
            'pharmacist_name': message.pharmacist_name_snapshot,
            'created_at': message.created_at,
        } for message in consultation.messages.all()],
    }


def _consultation_for_actor(pk, actor_type, actor):
    filters = {'id': pk}
    filters['store' if actor_type == 'store' else 'user'] = actor
    return PharmacistConsultation.objects.select_related('store', 'user', 'order', 'order__user', 'order__prescription', 'order__delivery_offer').prefetch_related('messages', 'order__medicines', 'order__status_history').filter(**filters).first()


class PharmacistConsultationOrderView(APIView):
    authentication_classes = [StoreTokenAuthentication, UserTokenAuthentication]
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def _order(self, request, order_id):
        actor_type, actor = _consultation_actor(request)
        if actor_type != 'user':
            return None
        return PrescriptionResponse.objects.select_related('store', 'user').filter(id=order_id, user=actor).first()

    def get(self, request, order_id):
        order = self._order(request, order_id)
        if not order:
            return Response({'error': 'Order not found.'}, status=404)
        consultation = PharmacistConsultation.objects.filter(order=order).first()
        store = order.store
        return Response({
            'eligible': order.user_status == 'completed' and bool(store and store.is_active and store.is_verified),
            'reason': '' if order.user_status == 'completed' else 'Ask a Pharmacist is available after the order is completed.',
            'pharmacy_name': store.name if store else order.store_name,
            'pharmacy_phone': store.mobile if store else order.store_contact,
            'pharmacist_verified': bool(store and store.is_pharmacist_verified),
            'pharmacist_available': bool(store and store.is_pharmacist_verified and store.pharmacist_available),
            'consultation': _serialize_consultation(request, consultation) if consultation else None,
        })

    @transaction.atomic
    def post(self, request, order_id):
        order = self._order(request, order_id)
        if not order:
            return Response({'error': 'Order not found.'}, status=404)
        if order.user_status != 'completed':
            return Response({'error': 'Consultation is available only for a completed order.'}, status=400)
        if not order.store or not order.store.is_active or not order.store.is_verified:
            return Response({'error': 'This pharmacy is not currently eligible for consultations.'}, status=400)
        existing = PharmacistConsultation.objects.filter(order=order).first()
        if existing:
            return Response(_serialize_consultation(request, existing), status=200)
        category = str(request.data.get('category', '')).strip()
        medicine_name = str(request.data.get('medicine_name', '')).strip()
        question = str(request.data.get('question', '')).strip()
        consent = str(request.data.get('consent', '')).lower() in ('1', 'true', 'yes')
        if category not in dict(PharmacistConsultation.CATEGORY_CHOICES):
            return Response({'category': ['Select a valid question type.']}, status=400)
        if len(medicine_name) < 2:
            return Response({'medicine_name': ['Enter the medicine name.']}, status=400)
        if len(question) < 10:
            return Response({'question': ['Describe your question in at least 10 characters.']}, status=400)
        if not consent:
            return Response({'consent': ['Consent is required before starting a consultation.']}, status=400)
        consultation = PharmacistConsultation.objects.create(
            order=order, user=order.user, store=order.store, category=category,
            medicine_name=medicine_name, question=question, user_consent_at=timezone.now(),
            status='active' if order.store.is_pharmacist_verified and order.store.pharmacist_available else 'waiting',
        )
        PharmacistConsultationMessage.objects.create(consultation=consultation, sender_type='user', text=question)
        send_store_app_notification(
            order.store, 'New pharmacist question',
            f'{order.user.name} asked about {medicine_name}.',
            {'type': 'PHARMACIST_CONSULTATION', 'consultation_id': consultation.id},
            notification_type='PHARMACIST_CONSULTATION',
            dedupe_key=f'pharmacist-consultation:{consultation.id}:new',
        )
        return Response(_serialize_consultation(request, consultation), status=201)


class PharmacistConsultationDetailView(APIView):
    authentication_classes = [StoreTokenAuthentication, UserTokenAuthentication]
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def get(self, request, consultation_id):
        actor_type, actor = _consultation_actor(request)
        consultation = _consultation_for_actor(consultation_id, actor_type, actor)
        if not consultation:
            return Response({'error': 'Consultation not found.'}, status=404)
        return Response(_serialize_consultation(request, consultation))

    @transaction.atomic
    def post(self, request, consultation_id):
        actor_type, actor = _consultation_actor(request)
        consultation = _consultation_for_actor(consultation_id, actor_type, actor)
        if not consultation:
            return Response({'error': 'Consultation not found.'}, status=404)
        if consultation.status == 'closed':
            return Response({'error': 'This consultation is closed.'}, status=400)
        text = str(request.data.get('text', '')).strip()
        if len(text) < 2:
            return Response({'text': ['Write a message.']}, status=400)
        kwargs = {'consultation': consultation, 'text': text}
        if actor_type == 'store':
            if not actor.is_active or not actor.is_verified or not actor.is_pharmacist_verified:
                return Response({'error': 'Only an admin-verified pharmacist can provide medicine guidance.'}, status=403)
            if not actor.pharmacist_available:
                return Response({'error': 'Set pharmacist availability to available before replying.'}, status=400)
            kwargs.update(sender_type='pharmacist', pharmacist_name_snapshot=actor.pharmacist_name, pharmacist_license_snapshot=actor.pharmacist_license_number)
            consultation.status = 'answered'
            send_user_app_notification(
                consultation.user, 'Your pharmacist replied',
                f'{actor.pharmacist_name or actor.name} replied to your medicine question.',
                {'type': 'PHARMACIST_CONSULTATION', 'consultation_id': consultation.id},
                notification_type='PHARMACIST_CONSULTATION',
                dedupe_key=f'pharmacist-consultation:{consultation.id}:reply:{consultation.messages.count()+1}',
            )
        else:
            kwargs['sender_type'] = 'user'
            consultation.status = 'active' if consultation.store.pharmacist_available and consultation.store.is_pharmacist_verified else 'waiting'
        PharmacistConsultationMessage.objects.create(**kwargs)
        consultation.save(update_fields=['status', 'updated_at'])
        return Response(_serialize_consultation(request, consultation), status=201)


class PharmacistCallbackView(APIView):
    authentication_classes = [UserTokenAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request, consultation_id):
        consultation = PharmacistConsultation.objects.select_related('store').filter(id=consultation_id, user=request.user).first()
        if not consultation:
            return Response({'error': 'Consultation not found.'}, status=404)
        phone = str(request.data.get('phone') or request.user.mobile or '').strip()
        preferred_time = str(request.data.get('preferred_time', '')).strip()
        if len(phone) < 10:
            return Response({'phone': ['Enter a valid callback number.']}, status=400)
        consultation.callback_requested = True
        consultation.callback_phone = phone
        consultation.callback_preferred_time = preferred_time
        consultation.status = 'callback_requested'
        consultation.save(update_fields=['callback_requested', 'callback_phone', 'callback_preferred_time', 'status', 'updated_at'])
        send_store_app_notification(
            consultation.store, 'Pharmacist callback requested',
            f'A customer requested a callback about {consultation.medicine_name}.',
            {'type': 'PHARMACIST_CALLBACK', 'consultation_id': consultation.id},
            notification_type='PHARMACIST_CONSULTATION',
            dedupe_key=f'pharmacist-consultation:{consultation.id}:callback',
        )
        return Response(_serialize_consultation(request, consultation))


class StorePharmacistConsultationListView(APIView):
    authentication_classes = [StoreTokenAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        consultations = PharmacistConsultation.objects.select_related('store', 'user', 'order', 'order__user', 'order__prescription', 'order__delivery_offer').prefetch_related('messages', 'order__medicines', 'order__status_history').filter(store=request.user)
        return Response([_serialize_consultation(request, item) for item in consultations])


class StorePharmacistAvailabilityView(APIView):
    authentication_classes = [StoreTokenAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        store = request.user
        return Response({'pharmacist_name': store.pharmacist_name, 'license_number': store.pharmacist_license_number, 'verified': store.is_pharmacist_verified, 'available': store.pharmacist_available if store.is_pharmacist_verified else False})

    def patch(self, request):
        store = request.user
        if 'pharmacist_name' in request.data or 'license_number' in request.data:
            name = str(request.data.get('pharmacist_name', '')).strip()
            license_number = str(request.data.get('license_number', '')).strip()
            if len(name) < 3:
                return Response({'pharmacist_name': ['Enter the pharmacist full name.']}, status=400)
            if len(license_number) < 5:
                return Response({'license_number': ['Enter a valid pharmacist registration number.']}, status=400)
            changed = name != store.pharmacist_name or license_number != store.pharmacist_license_number
            store.pharmacist_name = name
            store.pharmacist_license_number = license_number
            if changed:
                store.is_pharmacist_verified = False
                store.pharmacist_available = False
                store.pharmacist_verified_at = None
            store.save(update_fields=['pharmacist_name', 'pharmacist_license_number', 'is_pharmacist_verified', 'pharmacist_available', 'pharmacist_verified_at'])
            return Response({'pharmacist_name': store.pharmacist_name, 'license_number': store.pharmacist_license_number, 'verified': store.is_pharmacist_verified, 'available': False, 'message': 'Details submitted for AARX verification.'})
        if not store.is_pharmacist_verified:
            return Response({'error': 'Pharmacist verification by AARX is required.'}, status=403)
        available = request.data.get('available')
        if not isinstance(available, bool):
            return Response({'available': ['Use true or false.']}, status=400)
        store.pharmacist_available = available
        store.save(update_fields=['pharmacist_available'])
        return Response({'verified': True, 'available': store.pharmacist_available, 'pharmacist_name': store.pharmacist_name})

from .models import OrderReplacementRequest
from .serializers import OrderReplacementRequestSerializer
from django.utils import timezone

REPLACEMENT_WINDOW_HOURS = 48
REPLACEMENT_MAX_PROOF_BYTES = 5 * 1024 * 1024
REPLACEMENT_IMAGE_TYPES = {'image/jpeg', 'image/png', 'image/webp'}


def _replacement_actor(request, kind):
    actor = getattr(request, 'user', None)
    return actor if actor and actor.is_authenticated and getattr(actor, f'is_{kind}', False) else None


def _replacement_error(message, http_status=400):
    return Response({'error': message}, status=http_status)


def _notify_replacement(replacement, recipient, title, body):
    payload = {'type': f'replacement_{replacement.status}', 'replacement_id': replacement.id,
               'order_id': replacement.order_id, 'status': replacement.status}
    kwargs = {'notification_type': payload['type'], 'dedupe_key': f'replacement:{replacement.id}:{replacement.status}:{recipient}'}
    if recipient == 'store':
        send_store_app_notification(replacement.store, title, body, payload, **kwargs)
    else:
        send_user_app_notification(replacement.user, title, body, payload, **kwargs)


def _serialized_replacement(replacement, request, http_status=200):
    return Response(OrderReplacementRequestSerializer(replacement, context={'request': request}).data, status=http_status)


class OrderReplacementCreateView(APIView):
    authentication_classes = [UserTokenAuthentication]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def post(self, request, id):
        user = _replacement_actor(request, 'user')
        if not user:
            return _replacement_error('Unauthorized', 401)
        reason = request.data.get('reason')
        if reason not in dict(OrderReplacementRequest.REASON_CHOICES):
            return _replacement_error('Invalid reason')
        description = str(request.data.get('description', '')).strip()
        if reason == 'other' and not description:
            return _replacement_error('Description is required for Other reason')
        proof = request.FILES.get('proof_image')
        if proof and proof.size > REPLACEMENT_MAX_PROOF_BYTES:
            return _replacement_error('Proof image must be 5 MB or smaller')
        if proof and getattr(proof, 'content_type', '') not in REPLACEMENT_IMAGE_TYPES:
            return _replacement_error('Proof must be a JPEG, PNG, or WebP image')
        with transaction.atomic():
            try:
                order = PrescriptionResponse.objects.select_for_update().get(id=id, user=user)
            except PrescriptionResponse.DoesNotExist:
                return _replacement_error('Order not found', 404)
            if order.user_status != 'completed' or not order.completed_at:
                return _replacement_error('Order must be completed to request replacement')
            if timezone.now() > order.completed_at + timedelta(hours=REPLACEMENT_WINDOW_HOURS):
                return _replacement_error('The 48-hour replacement window has expired')
            if not order.store_id:
                return _replacement_error('This order has no assigned store')
            if OrderReplacementRequest.objects.filter(order=order).exists():
                return _replacement_error('Replacement already requested', 409)
            replacement = OrderReplacementRequest.objects.create(
                order=order, user=user, store=order.store, reason=reason, description=description,
                proof_image=proof, is_walk_in=order.delivery_option == 'walk_in')
            transaction.on_commit(lambda: _notify_replacement(replacement, 'store', 'New replacement request', f'Order #{replacement.order_id} has a replacement request.'))
        return _serialized_replacement(replacement, request, 201)


class UserReplacementListView(APIView):
    authentication_classes = [UserTokenAuthentication]
    def get(self, request):
        user = _replacement_actor(request, 'user')
        if not user:
            return _replacement_error('Unauthorized', 401)
        items = OrderReplacementRequest.objects.filter(user=user).select_related('order', 'order__prescription', 'order__delivery_offer', 'store', 'assigned_delivery_person').prefetch_related('order__medicines', 'order__status_history')
        return Response(OrderReplacementRequestSerializer(items, many=True, context={'request': request}).data)


class UserReplacementCancelView(APIView):
    authentication_classes = [UserTokenAuthentication]
    def post(self, request, id):
        user = _replacement_actor(request, 'user')
        if not user:
            return _replacement_error('Unauthorized', 401)
        with transaction.atomic():
            try:
                replacement = OrderReplacementRequest.objects.select_for_update().get(id=id, user=user)
            except OrderReplacementRequest.DoesNotExist:
                return _replacement_error('Replacement request not found', 404)
            if replacement.status != 'requested':
                return _replacement_error('Only requested replacements can be cancelled', 409)
            replacement.status, replacement.cancelled_at = 'cancelled', timezone.now()
            replacement.save(update_fields=['status', 'cancelled_at', 'updated_at'])
            transaction.on_commit(lambda: _notify_replacement(replacement, 'store', 'Replacement request cancelled', f'The customer cancelled replacement for order #{replacement.order_id}.'))
        return _serialized_replacement(replacement, request)


class StoreReplacementListView(APIView):
    authentication_classes = [StoreTokenAuthentication]
    def get(self, request):
        store = _replacement_actor(request, 'store')
        if not store:
            return _replacement_error('Unauthorized', 401)
        items = OrderReplacementRequest.objects.filter(store=store).select_related('order', 'order__prescription', 'order__delivery_offer', 'user', 'assigned_delivery_person').prefetch_related('order__medicines', 'order__status_history')
        return Response(OrderReplacementRequestSerializer(items, many=True, context={'request': request}).data)


class _StoreReplacementTransitionView(APIView):
    authentication_classes = [StoreTokenAuthentication]
    target_status = None

    def post(self, request, id):
        store = _replacement_actor(request, 'store')
        if not store:
            return _replacement_error('Unauthorized', 401)
        note = str(request.data.get('store_note', '')).strip()
        delivery_person_id = request.data.get('delivery_person_id')
        eta_raw = request.data.get('estimated_delivery_minutes')
        if self.target_status in {'approved', 'rejected', 'completed'} and not note:
            return _replacement_error('Store note is mandatory')
        if self.target_status == 'in_transit':
            if not delivery_person_id:
                return _replacement_error('Select a delivery person before dispatch')
            try:
                eta_minutes = int(eta_raw)
            except (TypeError, ValueError):
                return _replacement_error('Enter estimated delivery time in minutes')
            if not 5 <= eta_minutes <= 240:
                return _replacement_error('Estimated delivery time must be between 5 and 240 minutes')
        else:
            eta_minutes = None
        with transaction.atomic():
            try:
                replacement = OrderReplacementRequest.objects.select_for_update().get(id=id, store=store)
            except OrderReplacementRequest.DoesNotExist:
                return _replacement_error('Not found', 404)
            expected = {'approved': 'requested', 'rejected': 'requested', 'in_transit': 'approved',
                        'completed': 'approved' if replacement.is_walk_in else 'in_transit'}[self.target_status]
            if self.target_status == 'in_transit' and replacement.is_walk_in:
                return _replacement_error('Walk-in replacements do not use in-transit status')
            if replacement.status != expected:
                return _replacement_error(f"Replacement must be {expected.replace('_', ' ')} before this action", 409)
            update_fields = ['status', 'store_note', 'updated_at']
            if self.target_status == 'in_transit':
                try:
                    person = StoreDeliveryPerson.objects.select_for_update().get(
                        id=delivery_person_id, store=store, is_active=True, is_available=True)
                except StoreDeliveryPerson.DoesNotExist:
                    return _replacement_error('Selected delivery person is not available', 409)
                if person.current_order_count >= person.max_concurrent_orders:
                    return _replacement_error('Selected delivery person has reached the order limit', 409)
                replacement.assigned_delivery_person = person
                replacement.estimated_delivery_minutes = eta_minutes
                replacement.estimated_arrival_at = timezone.now() + timedelta(minutes=eta_minutes)
                StoreDeliveryPerson.objects.filter(id=person.id).update(
                    current_order_count=F('current_order_count') + 1,
                    last_assigned_at=timezone.now(), updated_at=timezone.now(),
                )
                update_fields += ['assigned_delivery_person', 'estimated_delivery_minutes', 'estimated_arrival_at']
            replacement.status = self.target_status
            if note:
                replacement.store_note = note
            timestamp_field = {'approved': 'approved_at', 'rejected': 'rejected_at', 'in_transit': 'in_transit_at', 'completed': 'completed_at'}[self.target_status]
            setattr(replacement, timestamp_field, timezone.now())
            update_fields.append(timestamp_field)
            replacement.save(update_fields=update_fields)
            if self.target_status == 'completed' and replacement.assigned_delivery_person_id:
                StoreDeliveryPerson.objects.filter(
                    id=replacement.assigned_delivery_person_id, current_order_count__gt=0,
                ).update(current_order_count=F('current_order_count') - 1)
            titles = {'approved': 'Replacement approved', 'rejected': 'Replacement rejected', 'in_transit': 'Replacement on the way', 'completed': 'Replacement completed'}
            transit_body = (f'{replacement.assigned_delivery_person.name} is delivering your replacement. '
                            f'Expected in about {replacement.estimated_delivery_minutes} minutes.') if replacement.assigned_delivery_person_id else 'Your replacement is in transit.'
            bodies = {'approved': 'Please visit the store for replacement.' if replacement.is_walk_in else 'Your replacement has been approved.', 'rejected': 'Your replacement request was rejected.', 'in_transit': transit_body, 'completed': 'Your replacement has been completed.'}
            transaction.on_commit(lambda: _notify_replacement(replacement, 'user', titles[self.target_status], note or bodies[self.target_status]))
        return _serialized_replacement(replacement, request)


class StoreReplacementApproveView(_StoreReplacementTransitionView):
    target_status = 'approved'


class StoreReplacementRejectView(_StoreReplacementTransitionView):
    target_status = 'rejected'


class StoreReplacementInTransitView(_StoreReplacementTransitionView):
    target_status = 'in_transit'


class StoreReplacementCompleteView(_StoreReplacementTransitionView):
    target_status = 'completed'


# User-owned emergency pharmacy request tracking.
def _emergency_state(prescription, quote_statuses):
    if prescription.emergency_cancelled_at:
        return 'cancelled'
    if any(value in {'completed', 'delivered'} for value in quote_statuses):
        return 'fulfilled'
    if any(value in {'accepted', 'processing', 'locked', 'out_for_delivery'} for value in quote_statuses):
        return 'order_confirmed'
    if quote_statuses:
        return 'quote_received'
    if prescription.dispatch_status == 'exhausted':
        return 'no_store_available'
    if prescription.dispatch_status == 'completed':
        return 'quotes_ready'
    if prescription.dispatch_current_batch > 0:
        return 'stores_notified'
    return 'dispatching'


def _serialize_emergency_request(prescription):
    targets = list(prescription.target_stores.all())
    responses = list(prescription.responses.all())
    response_statuses = [str(item.user_status or '').lower() for item in responses]
    quote_statuses = [value for value in response_statuses if value not in {'rejected', 'dismissed', 'expired', 'cancelled'}]
    stores = []
    for target in targets:
        store = target.store
        stores.append({
            'id': store.id,
            'name': store.name,
            'address': store.address,
            'image': get_file_url(store.store_image) if store.store_image else None,
            'distance_km': float(target.distance_km) if target.distance_km is not None else None,
            'rank_score': float(target.rank_score),
            'average_rating': float(store.average_rating or 0),
            'ratings_count': int(store.total_ratings or 0),
            'typical_response_minutes': int(store.avg_response_time_mins or 30),
            'batch_number': target.batch_number,
            'dispatch_status': target.status,
            'notified_at': target.notified_at,
            'opened_at': target.opened_at,
            'responded_at': target.responded_at,
        })
    charge = getattr(prescription, 'emergency_charge', None)
    billing = None if charge is None else {
        'kind': charge.kind,
        'status': charge.status,
        'amount_paise': charge.amount_paise,
        'amount_rupees': charge.amount_paise / 100,
        'refund_reason': charge.refund_reason,
        'refunded_at': charge.refunded_at,
    }
    return {
        'id': prescription.id,
        'status': _emergency_state(prescription, quote_statuses),
        'dispatch_status': prescription.dispatch_status,
        'dispatch_current_batch': prescription.dispatch_current_batch,
        'dispatch_next_check_at': prescription.dispatch_next_check_at,
        'dispatch_completed_at': prescription.dispatch_completed_at,
        'created_at': prescription.uploaded_at,
        'cancelled_at': prescription.emergency_cancelled_at,
        'cancel_reason': prescription.emergency_cancel_reason,
        'medicine_name': prescription.medicine_name,
        'description': prescription.description,
        'image': get_file_url(prescription.image) if prescription.image else None,
        'address': prescription.user_address,
        'latitude': prescription.latitude,
        'longitude': prescription.longitude,
        'stores_notified': len(targets),
        'stores_opened': sum(1 for target in targets if target.opened_at),
        'stores_responded': sum(1 for target in targets if target.responded_at or target.status == 'responded'),
        'quotes_received': len(quote_statuses),
        'billing': billing,
        'can_cancel': not prescription.emergency_cancelled_at and not any(
            value in {'accepted', 'processing', 'locked', 'out_for_delivery', 'completed', 'delivered'}
            for value in response_statuses
        ),
        'stores': stores,
    }


class UserEmergencyRequestListView(APIView):
    authentication_classes = [UserTokenAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        queryset = Prescription.objects.filter(user=request.user, status='emergency').prefetch_related(
            'target_stores__store', 'responses'
        ).order_by('-uploaded_at')[:100]
        data = [_serialize_emergency_request(item) for item in queryset]
        if request.query_params.get('active') == 'true':
            data = [item for item in data if item['status'] not in {'cancelled', 'fulfilled', 'no_store_available'}]
        return Response({'results': data, 'count': len(data)})


class UserEmergencyRequestDetailView(APIView):
    authentication_classes = [UserTokenAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request, prescription_id):
        try:
            prescription = Prescription.objects.prefetch_related('target_stores__store', 'responses').get(
                id=prescription_id, user=request.user, status='emergency'
            )
        except Prescription.DoesNotExist:
            return Response({'error': 'Emergency request not found.'}, status=404)
        return Response(_serialize_emergency_request(prescription))


class UserEmergencyRequestCancelView(APIView):
    authentication_classes = [UserTokenAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request, prescription_id):
        reason = str(request.data.get('reason') or '').strip()
        with transaction.atomic():
            try:
                prescription = Prescription.objects.select_for_update().get(
                    id=prescription_id, user=request.user, status='emergency'
                )
            except Prescription.DoesNotExist:
                return Response({'error': 'Emergency request not found.'}, status=404)
            if prescription.emergency_cancelled_at:
                return Response({'error': 'Emergency request is already cancelled.'}, status=409)
            if prescription.responses.filter(user_status__in=['accepted', 'processing', 'locked', 'out_for_delivery', 'completed', 'delivered']).exists():
                return Response({'error': 'An accepted order must be cancelled from the Orders screen.'}, status=409)
            now = timezone.now()
            prescription.emergency_cancelled_at = now
            prescription.emergency_cancel_reason = reason
            prescription.dispatch_status = 'exhausted'
            prescription.dispatch_next_check_at = None
            prescription.dispatch_completed_at = now
            prescription.save(update_fields=['emergency_cancelled_at', 'emergency_cancel_reason', 'dispatch_status', 'dispatch_next_check_at', 'dispatch_completed_at'])
            store_ids = list(prescription.target_stores.values_list('store_id', flat=True))
            prescription.target_stores.exclude(status='responded').update(status='skipped')

        event_data = {'prescription_id': prescription.id, 'status': 'cancelled', 'updated_at': now.isoformat()}
        channel_layer = get_channel_layer()
        for store_id in store_ids:
            async_to_sync(channel_layer.group_send)(f'store_{store_id}_fulfillment', {
                'type': 'fulfillment_update', 'event_id': str(uuid.uuid4()), 'seq': prescription.id,
                'action': 'emergency_cancelled', 'data': event_data,
            })
        async_to_sync(channel_layer.group_send)(f'user_{request.user.id}_fulfillment', {
            'type': 'fulfillment_update', 'event_id': str(uuid.uuid4()), 'seq': prescription.id,
            'action': 'emergency_cancelled', 'data': event_data,
        })
        return Response({'message': 'Emergency pharmacy request cancelled.', 'status': 'cancelled'})
