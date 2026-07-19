from django.contrib.auth import get_user_model
from django.test import TestCase

from emergency_services.models import City
from support_admin.models import SupportNotification, SupportStaff
from support_admin.services.notification_service import create_scoped_notifications


class ScopedSupportNotificationTests(TestCase):
    def setUp(self):
        self.mumbai = City.objects.create(name="Mumbai", state="Maharashtra")
        self.pune = City.objects.create(name="Pune", state="Maharashtra")
        self.mumbai_agent = self._staff("mumbai", SupportStaff.ROLE_AGENT, self.mumbai)
        self.pune_agent = self._staff("pune", SupportStaff.ROLE_AGENT, self.pune)
        self.admin = self._staff("admin", SupportStaff.ROLE_ADMIN)
        self.all_cities = self._staff("all", SupportStaff.ROLE_SUPERVISOR, all_cities=True)

    def _staff(self, name, role, city=None, all_cities=False):
        user = get_user_model().objects.create_user(
            username=f"{name}-support", email=f"{name}@support.test", password="test-pass-123"
        )
        staff = SupportStaff.objects.create(
            user=user, role=role, employee_id=f"EMP-{name}", all_cities_access=all_cities,
        )
        if city:
            staff.cities.add(city)
        return staff

    def _notify(self, **overrides):
        values = {
            "notification_type": "ticket", "title": "New message", "message": "Message",
            "entity_type": "ticket", "entity_id": 42, "scope": "CITY", "city_id": self.mumbai.id,
        }
        values.update(overrides)
        return create_scoped_notifications(**values)

    def test_city_notification_only_reaches_authorized_staff(self):
        self._notify()
        recipients = set(SupportNotification.objects.values_list("recipient_id", flat=True))
        self.assertEqual(recipients, {self.mumbai_agent.id, self.admin.id, self.all_cities.id})
        self.assertNotIn(self.pune_agent.id, recipients)

    def test_assigned_notification_only_reaches_eligible_assignee(self):
        self._notify(assigned_to_id=str(self.mumbai_agent.id))
        self.assertEqual(
            list(SupportNotification.objects.values_list("recipient_id", flat=True)),
            [self.mumbai_agent.id],
        )

    def test_wrong_city_assignee_receives_nothing(self):
        self._notify(assigned_to_id=self.pune_agent.id)
        self.assertFalse(SupportNotification.objects.exists())

    def test_global_notification_reaches_every_active_staff(self):
        self._notify(scope="GLOBAL", city_id=None)
        recipients = set(SupportNotification.objects.values_list("recipient_id", flat=True))
        self.assertEqual(
            recipients,
            {self.mumbai_agent.id, self.pune_agent.id, self.admin.id, self.all_cities.id},
        )
