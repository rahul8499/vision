from asgiref.sync import async_to_sync
from django.core import mail
from django.test import SimpleTestCase, TestCase, override_settings
from rest_framework.exceptions import AuthenticationFailed
from rest_framework.test import APITestCase, APIRequestFactory

from .models import Prescription, PrescriptionResponse, User
from .authentication import DeliveryPersonTokenAuthentication
from .middleware import get_user_or_store
from types import SimpleNamespace
from unittest.mock import patch

from .tasks import _normalize_ai_service_payload
from .utils.app_notifications import (
    create_chat_message_app_notification,
    serialize_app_notification,
    send_store_app_notification,
    send_user_app_notification,
)
from .utils.notifications import is_valid_expo_push_token, send_push_notification_batch
from .views import (
    _build_order_progress_push_payload,
    _normalize_whatsapp_number,
    _run_safe_side_effect,
    _send_completion_otp_email,
    _send_whatsapp_otp,
)
from .serializers import PrescriptionResponseSerializer


class UserOtpLoginTests(APITestCase):
    @patch('prescription.views.verify_access_token')
    def test_verified_phone_reactivates_soft_deleted_user(self, verify_access_token):
        user = User.objects.create(
            name='Returning Customer',
            mobile='9876543210',
            is_active=False,
            is_deleted=True,
            token=None,
        )

        response = self.client.post(
            '/api/user/otp-login/',
            {'mobile': '9876543210', 'access_token': 'verified-access-token'},
            format='json',
        )

        self.assertEqual(response.status_code, 200)
        user.refresh_from_db()
        self.assertTrue(user.is_active)
        self.assertFalse(user.is_deleted)
        self.assertTrue(user.is_verified)
        self.assertTrue(user.token)
        self.assertEqual(response.data['user_id'], user.id)
        self.assertFalse(response.data['is_new_user'])
        self.assertFalse(response.data['needs_name'])
        verify_access_token.assert_called_once_with(
            'verified-access-token',
            '919876543210',
        )

    @patch('prescription.views.verify_access_token')
    def test_verified_phone_does_not_reactivate_inactive_user(self, verify_access_token):
        user = User.objects.create(
            name='Blocked Customer',
            mobile='9876543210',
            is_active=False,
            is_deleted=False,
            token=None,
        )

        response = self.client.post(
            '/api/user/otp-login/',
            {'mobile': '9876543210', 'access_token': 'verified-access-token'},
            format='json',
        )

        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.data['error'], 'User account is inactive.')
        user.refresh_from_db()
        self.assertFalse(user.is_active)
        self.assertFalse(user.is_deleted)
        self.assertIsNone(user.token)


@override_settings(
    EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend',
    DEFAULT_FROM_EMAIL='no-reply@aarx.test',
)
class CompletionOTPEmailTests(SimpleTestCase):
    def test_sends_the_existing_completion_code_to_customer_email(self):
        sent = _send_completion_otp_email(
            'customer@example.com',
            '483921',
            'Care Pharmacy',
        )

        self.assertTrue(sent)
        self.assertEqual(len(mail.outbox), 1)
        email = mail.outbox[0]
        self.assertEqual(email.to, ['customer@example.com'])
        self.assertEqual(email.from_email, 'no-reply@aarx.test')
        self.assertIn('483921', email.body)
        self.assertIn('Care Pharmacy', email.body)
        self.assertIn('10 minutes', email.body)

    def test_missing_customer_email_does_not_attempt_delivery(self):
        sent = _send_completion_otp_email('', '483921', 'Care Pharmacy')

        self.assertFalse(sent)
        self.assertEqual(len(mail.outbox), 0)


class WhatsAppOTPTests(SimpleTestCase):
    @override_settings(WHATSAPP_DEFAULT_COUNTRY_CODE='91')
    def test_normalizes_local_and_international_mobile_numbers(self):
        self.assertEqual(_normalize_whatsapp_number('98765 43210'), '919876543210')
        self.assertEqual(_normalize_whatsapp_number('+91-98765-43210'), '919876543210')

    @override_settings(
        WHATSAPP_ENABLED=True,
        WHATSAPP_GRAPH_API_VERSION='v23.0',
        WHATSAPP_PHONE_NUMBER_ID='123456789',
        WHATSAPP_ACCESS_TOKEN='test-access-token',
        WHATSAPP_TEMPLATE_LANGUAGE='en_US',
        WHATSAPP_DEFAULT_COUNTRY_CODE='91',
        WHATSAPP_OTP_COPY_CODE_BUTTON=True,
    )
    @patch('prescription.views.requests.post')
    def test_sends_same_otp_in_meta_authentication_template(self, post):
        post.return_value.raise_for_status.return_value = None

        sent = _send_whatsapp_otp(
            '9876543210',
            '483921',
            'aarx_order_completion_otp',
        )

        self.assertTrue(sent)
        post.assert_called_once()
        request = post.call_args
        self.assertEqual(
            request.args[0],
            'https://graph.facebook.com/v23.0/123456789/messages',
        )
        payload = request.kwargs['json']
        self.assertEqual(payload['to'], '919876543210')
        self.assertEqual(payload['template']['name'], 'aarx_order_completion_otp')
        self.assertEqual(
            payload['template']['components'][0]['parameters'][0]['text'],
            '483921',
        )
        self.assertEqual(
            payload['template']['components'][1]['parameters'][0]['text'],
            '483921',
        )


    @override_settings(WHATSAPP_ENABLED=False)
    @patch('prescription.views.requests.post')
    def test_disabled_provider_never_calls_network(self, post):
        sent = _send_whatsapp_otp('9876543210', '483921', 'otp_template')

        self.assertFalse(sent)
        post.assert_not_called()


class DeliveryPersonAuthenticationTests(SimpleTestCase):
    def test_malformed_bearer_token_is_rejected_without_raising_validation_error(self):
        factory = APIRequestFactory()
        request = factory.get('/delivery-person/profile', HTTP_AUTHORIZATION='Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0b2tlbl90eXBlIjoiYWNjZXNzIn0.fake')

        auth = DeliveryPersonTokenAuthentication()

        with self.assertRaises(AuthenticationFailed):
            auth.authenticate(request)

    def test_malformed_websocket_token_is_treated_as_anonymous(self):
        result = async_to_sync(get_user_or_store)('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0b2tlbl90eXBlIjoiYWNjZXNzIn0.fake')

        self.assertEqual(result.__class__.__name__, 'AnonymousUser')


class AiPayloadNormalizationTests(SimpleTestCase):
    def test_uses_item_confidence_when_top_level_score_is_missing(self):
        payload = {
            "classification": "prescription",
            "score": 0.0,
            "reason": "OCR fallback",
            "extracted_medicines": [
                {"suggested_name": "Paracetamol", "confidence": 0.82},
                {"suggested_name": "Amoxicillin", "confidence": 0.74},
            ],
        }

        normalized = _normalize_ai_service_payload(payload)

        self.assertEqual(normalized['classification'], 'prescription')
        self.assertEqual(normalized['score'], 0.82)
        self.assertEqual(len(normalized['extracted_medicines']), 2)
        self.assertEqual(normalized['extracted_medicines'][0]['suggested_name'], 'Paracetamol')

    def test_accepts_alternative_keys_for_medicine_payloads(self):
        payload = {
            "class": "medicine",
            "confidence": 0.91,
            "medicines": [
                {"name": "Dolo 650", "confidence": 0.88},
            ],
        }

        normalized = _normalize_ai_service_payload(payload)

        self.assertEqual(normalized['classification'], 'medicine')
        self.assertEqual(normalized['score'], 0.91)
        self.assertEqual(normalized['extracted_medicines'][0]['suggested_name'], 'Dolo 650')


class PrescriptionResponseSerializerTests(TestCase):
    def test_exposes_extracted_medicines_from_prescription(self):
        prescription = Prescription(id=99, extracted_medicines=[
            {
                "suggested_name": "ORS",
                "medicine_name": "ORS",
                "confidence": 0.95,
                "needs_verification": True,
            }
        ])
        response = PrescriptionResponse(id=7, prescription=prescription)

        data = PrescriptionResponseSerializer(response).data

        self.assertEqual(data['extracted_medicines'][0]['suggested_name'], 'ORS')


class ExpoNotificationTests(SimpleTestCase):
    def test_accepts_current_and_legacy_expo_push_token_prefixes(self):
        self.assertTrue(is_valid_expo_push_token('ExpoPushToken[current]'))
        self.assertTrue(is_valid_expo_push_token('ExponentPushToken[legacy]'))
        self.assertFalse(is_valid_expo_push_token('NotExpo[token]'))
        self.assertFalse(is_valid_expo_push_token(None))

    @patch('prescription.utils.notifications.requests.post')
    def test_batch_filters_invalid_tokens_before_sending(self, post):
        post.return_value.raise_for_status.return_value = None
        post.return_value.json.return_value = {'data': [{'status': 'ok'}]}

        results = send_push_notification_batch([
            {'to': 'invalid-token', 'title': 'Skip', 'body': 'Nope'},
            {'to': 'ExpoPushToken[current]', 'title': 'Send', 'body': 'Yes'},
        ])

        post.assert_called_once()
        self.assertEqual(post.call_args.kwargs['json'], [
            {'to': 'ExpoPushToken[current]', 'title': 'Send', 'body': 'Yes'},
        ])
        self.assertEqual(results, [{'status': 'ok'}])

class AppNotificationHelperTests(SimpleTestCase):
    @patch('prescription.utils.app_notifications.create_app_notification_for_store')
    def test_user_chat_message_creates_store_bell_item_with_dedupe_key(self, create_notification):
        thread = SimpleNamespace(
            id=31,
            user=SimpleNamespace(name='Asha'),
            store=SimpleNamespace(id=8),
        )

        create_chat_message_app_notification(thread, 'user', 'Is this available?', message_id=45)

        create_notification.assert_called_once_with(
            thread.store,
            'New message from Asha',
            'Is this available?',
            {'type': 'NEW_CHAT_MESSAGE', 'thread_id': 31, 'message_id': 45},
            notification_type='NEW_CHAT_MESSAGE',
            dedupe_key='chat:31:message:45:store:8',
        )

    @patch('prescription.utils.app_notifications.create_app_notification_for_user')
    def test_store_media_message_creates_user_bell_item(self, create_notification):
        thread = SimpleNamespace(
            id=31,
            user=SimpleNamespace(id=9),
            store=SimpleNamespace(name='Care Pharmacy'),
        )

        create_chat_message_app_notification(thread, 'store', 'Sent you a photo', message_id=46)

        create_notification.assert_called_once_with(
            thread.user,
            'New message from Care Pharmacy',
            'Sent you a photo',
            {'type': 'NEW_CHAT_MESSAGE', 'thread_id': 31, 'message_id': 46},
            notification_type='NEW_CHAT_MESSAGE',
            dedupe_key='chat:31:message:46:user:9',
        )

    def test_serializes_notification_for_bell_sheet(self):
        notification = SimpleNamespace(
            id=17,
            title='Order packed',
            body='Your order is packed.',
            notification_type='ORDER_PACKED',
            data={'response_id': 44, 'type': 'ORDER_PACKED'},
            is_read=False,
            read_at=None,
            created_at=SimpleNamespace(isoformat=lambda: '2026-07-05T10:00:00+05:30'),
        )

        payload = serialize_app_notification(notification)

        self.assertEqual(payload['id'], 17)
        self.assertEqual(payload['notification_type'], 'ORDER_PACKED')
        self.assertEqual(payload['data']['response_id'], 44)
        self.assertFalse(payload['is_read'])

    @patch('prescription.utils.app_notifications.logger.exception')
    @patch('prescription.utils.app_notifications.send_push_notification', side_effect=RuntimeError('expo down'))
    @patch('prescription.utils.app_notifications.create_app_notification_for_user')
    def test_user_push_failure_does_not_break_bell_notification(self, create_notification, send_push, log_exception):
        saved = SimpleNamespace(id=21)
        create_notification.return_value = saved
        user = SimpleNamespace(id=9, expo_push_token='ExpoPushToken[current]')

        result = send_user_app_notification(user, 'Title', 'Body', {'type': 'ORDER_PACKED'})

        self.assertIs(result, saved)
        create_notification.assert_called_once()
        send_push.assert_called_once()
        log_exception.assert_called_once()

    @patch('prescription.utils.app_notifications.logger.exception')
    @patch('prescription.utils.app_notifications.send_push_notification', side_effect=RuntimeError('expo down'))
    @patch('prescription.utils.app_notifications.create_app_notification_for_store')
    def test_store_push_failure_does_not_break_bell_notification(self, create_notification, send_push, log_exception):
        saved = SimpleNamespace(id=22)
        create_notification.return_value = saved
        store = SimpleNamespace(id=5, expo_push_token='ExpoPushToken[current]')

        result = send_store_app_notification(store, 'Title', 'Body', {'type': 'NEW_PRESCRIPTION'})

        self.assertIs(result, saved)
        create_notification.assert_called_once()
        send_push.assert_called_once()
        log_exception.assert_called_once()

class OrderProgressPushPayloadTests(SimpleTestCase):
    def _response(self, delivery_option='pickup'):
        return SimpleNamespace(
            id=12,
            prescription_id=34,
            store_name='Care Pharmacy',
            delivery_option=delivery_option,
            store=SimpleNamespace(name='Fallback Pharmacy'),
        )

    def test_builds_billing_and_packed_payloads(self):
        billing = _build_order_progress_push_payload(self._response(), 'start_processing')
        packed = _build_order_progress_push_payload(self._response(), 'mark_packed')

        self.assertEqual(billing['title'], 'Billing started')
        self.assertEqual(billing['data']['type'], 'BILLING_STARTED')
        self.assertEqual(packed['title'], 'Order packed')
        self.assertEqual(packed['data']['type'], 'ORDER_PACKED')
        self.assertEqual(packed['data']['response_id'], 12)
        self.assertEqual(packed['data']['prescription_id'], 34)

    def test_builds_delivery_specific_ready_payloads(self):
        pickup = _build_order_progress_push_payload(self._response(), 'mark_locked')
        delivery = _build_order_progress_push_payload(self._response('online'), 'mark_locked')

        self.assertEqual(pickup['title'], 'Ready for pickup')
        self.assertEqual(pickup['data']['type'], 'ORDER_READY_FOR_PICKUP')
        self.assertEqual(delivery['title'], 'Out for delivery')
        self.assertEqual(delivery['data']['type'], 'OUT_FOR_DELIVERY')

    def test_builds_completion_payloads(self):
        otp = _build_order_progress_push_payload(self._response(), 'completion_otp_requested')
        completed = _build_order_progress_push_payload(self._response(), 'mark_completed')

        self.assertEqual(otp['data']['type'], 'COMPLETION_OTP_REQUESTED')
        self.assertEqual(completed['title'], 'Order completed')
        self.assertEqual(completed['data']['type'], 'ORDER_COMPLETED')

class SafeSideEffectTests(SimpleTestCase):
    def test_side_effect_errors_are_logged_not_raised(self):
        def broken_callback():
            raise RuntimeError('push provider down')

        with self.assertLogs('prescription.views', level='ERROR') as logs:
            result = _run_safe_side_effect('test notification', broken_callback)

        self.assertIsNone(result)
        self.assertTrue(any('test notification failed after commit.' in line for line in logs.output))



class EmergencyRequestApiTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create(
            name='Emergency User', mobile='9000000001', email='emergency-user@example.com',
            password='secret', address='Test address', pincode='411001', token='emergency-user-token',
        )
        self.other_user = User.objects.create(
            name='Other User', mobile='9000000002', email='other-user@example.com',
            password='secret', address='Other address', pincode='411002', token='other-user-token',
        )
        self.request = Prescription.objects.create(
            user=self.user, status='emergency', latitude=18.5204, longitude=73.8567,
            user_address='Confirmed test location', medicine_name='Test medicine', dispatch_status='active',
        )
        self.other_request = Prescription.objects.create(
            user=self.other_user, status='emergency', latitude=19.0760, longitude=72.8777,
            user_address='Private other location', dispatch_status='active',
        )
        self.client.credentials(HTTP_AUTHORIZATION='Bearer emergency-user-token')

    def test_list_is_scoped_to_authenticated_user_even_with_user_id_query(self):
        response = self.client.get(f'/api/emergency-requests/?user_id={self.other_user.id}')
        self.assertEqual(response.status_code, 200)
        self.assertEqual([item['id'] for item in response.data['results']], [self.request.id])

    def test_detail_rejects_another_users_request(self):
        response = self.client.get(f'/api/emergency-requests/{self.other_request.id}/')
        self.assertEqual(response.status_code, 404)

    def test_cancel_is_atomic_and_terminal(self):
        response = self.client.post(
            f'/api/emergency-requests/{self.request.id}/cancel/',
            {'reason': 'Medicine arranged elsewhere'}, format='json',
        )
        self.assertEqual(response.status_code, 200)
        self.request.refresh_from_db()
        self.assertIsNotNone(self.request.emergency_cancelled_at)
        self.assertEqual(self.request.dispatch_status, 'exhausted')
        self.assertEqual(self.request.emergency_cancel_reason, 'Medicine arranged elsewhere')
