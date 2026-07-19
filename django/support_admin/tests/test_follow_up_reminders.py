from datetime import timedelta

from django.contrib.auth import get_user_model
from django.contrib.contenttypes.models import ContentType
from django.test import TestCase
from django.utils import timezone

from support_admin.models import ContactLog, SupportNotification, SupportStaff
from support_admin.tasks import send_due_follow_up_reminders


class FollowUpReminderTests(TestCase):
    def setUp(self):
        user = get_user_model().objects.create_user(
            username="follow-up-agent", email="follow-up@example.test", password="test-pass-123",
        )
        self.staff = SupportStaff.objects.create(
            user=user, role=SupportStaff.ROLE_AGENT, employee_id="FOLLOW-UP-1",
        )

    def _log(self, follow_up_at, outcome="callback"):
        return ContactLog.objects.create(
            content_type=ContentType.objects.get_for_model(SupportStaff),
            object_id=self.staff.id,
            channel="call",
            outcome=outcome,
            note="Call the customer",
            follow_up_at=follow_up_at,
            created_by=self.staff,
        )

    def test_due_follow_up_creates_only_one_notification(self):
        self._log(timezone.now() - timedelta(minutes=1))
        send_due_follow_up_reminders()
        send_due_follow_up_reminders()
        self.assertEqual(SupportNotification.objects.filter(notification_type="follow_up").count(), 1)

    def test_future_or_resolved_follow_up_does_not_notify(self):
        self._log(timezone.now() + timedelta(hours=1))
        self._log(timezone.now() - timedelta(minutes=1), outcome="resolved")
        send_due_follow_up_reminders()
        self.assertFalse(SupportNotification.objects.exists())

    def test_completed_or_cancelled_follow_up_does_not_notify(self):
        completed = self._log(timezone.now() - timedelta(minutes=1))
        completed.status = "completed"
        completed.save(update_fields=["status"])
        cancelled = self._log(timezone.now() - timedelta(minutes=1))
        cancelled.status = "cancelled"
        cancelled.save(update_fields=["status"])
        send_due_follow_up_reminders()
        self.assertFalse(SupportNotification.objects.exists())
