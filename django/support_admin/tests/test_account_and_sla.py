from datetime import datetime, time

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone

from support_admin.models import SLAConfiguration, SupportHoliday, SupportStaff
from support_admin.serializers import SLAConfigurationSerializer
from support_admin.services.auth_service import change_staff_password, login_staff, refresh_staff_token
from support_admin.services.sla_service import add_sla_minutes, sla_seconds_between
from support_admin.authentication import invalidate_staff_sessions


class AccountSecurityTests(TestCase):
    def test_refresh_token_requires_live_support_session(self):
        user = get_user_model().objects.create_user(username="session", email="session@example.test", password="old-password")
        staff = SupportStaff.objects.create(user=user, role="agent", employee_id="SESSION-1")
        tokens = login_staff(user.email, "old-password")
        self.assertIn("access", refresh_staff_token(tokens["refresh"]))
        invalidate_staff_sessions(staff)
        with self.assertRaisesMessage(ValueError, "session has expired"):
            refresh_staff_token(tokens["refresh"])

    def test_password_change_uses_django_hashing(self):
        user = get_user_model().objects.create_user(username="secure", email="secure@example.test", password="old-password")
        staff = SupportStaff.objects.create(user=user, role="agent", employee_id="SECURE-1")
        change_staff_password(staff, "old-password", "new-password-123")
        user.refresh_from_db()
        self.assertNotEqual(user.password, "new-password-123")
        self.assertTrue(user.check_password("new-password-123"))

    def test_short_password_is_rejected(self):
        user = get_user_model().objects.create_user(username="short", email="short@example.test", password="old-password")
        staff = SupportStaff.objects.create(user=user, role="agent", employee_id="SECURE-2")
        with self.assertRaisesMessage(ValueError, "at least 8 characters"):
            change_staff_password(staff, "old-password", "short")


class SLAConfigurationTests(TestCase):
    def setUp(self):
        self.policy = SLAConfiguration.objects.create(
            entity_type="complaint", priority="urgent", first_response_minutes=60,
            resolution_minutes=240, working_hours_only=True,
            workday_start=time(9), workday_end=time(18), working_days=[0, 1, 2, 3, 4],
        )

    def test_deadline_skips_weekend(self):
        friday = timezone.make_aware(datetime(2026, 7, 17, 17, 30))
        self.assertEqual(timezone.localtime(add_sla_minutes(friday, 120, self.policy)), timezone.make_aware(datetime(2026, 7, 20, 10, 30)))

    def test_deadline_skips_active_holiday(self):
        SupportHoliday.objects.create(date=datetime(2026, 7, 20).date(), name="Holiday")
        friday = timezone.make_aware(datetime(2026, 7, 17, 17, 30))
        self.assertEqual(timezone.localtime(add_sla_minutes(friday, 120, self.policy)), timezone.make_aware(datetime(2026, 7, 21, 10, 30)))

    def test_invalid_office_hours_are_rejected(self):
        serializer = SLAConfigurationSerializer(self.policy, data={"workday_start": "18:00", "workday_end": "09:00"}, partial=True)
        self.assertFalse(serializer.is_valid())
        self.assertIn("workday_end", serializer.errors)

    def test_pause_across_weekend_counts_only_working_seconds(self):
        friday = timezone.make_aware(datetime(2026, 7, 17, 17, 0))
        monday = timezone.make_aware(datetime(2026, 7, 20, 10, 0))
        self.assertEqual(sla_seconds_between(friday, monday, self.policy), 2 * 60 * 60)
