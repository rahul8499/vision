from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIRequestFactory

from complaints.models import Complaint
from prescription.models import User
from support_admin.models import CaseRelation, SupportStaff
from support_admin.views import CaseManagementView


class DuplicateCaseMergeTests(TestCase):
    def setUp(self):
        auth_user = get_user_model().objects.create_user(username="merge-supervisor", email="merge-supervisor@example.test", password="password-123")
        self.supervisor = SupportStaff.objects.create(user=auth_user, role="supervisor", employee_id="MERGE-SUP-1", all_cities_access=True)
        self.customer = User.objects.create(name="Merge Customer", mobile="9111111111", email="merge-customer@example.test", password="password", address="Address", pincode="400001")
        self.other = User.objects.create(name="Other User", mobile="9222222222", email="merge-other@example.test", password="password", address="Address", pincode="400001")
        values = dict(complainant_type="user", complainant_user=self.customer, respondent_type="user", respondent_user=self.other, scope="GLOBAL", category="other", description="Same problem")
        self.main = Complaint.objects.create(subject="Main case", **values)
        self.duplicate = Complaint.objects.create(subject="Duplicate case", **values)
        self.factory = APIRequestFactory()

    def test_merge_closes_duplicate_without_deleting_it(self):
        raw = self.factory.post("/", {"action": "merge_duplicate", "duplicate_id": self.duplicate.id, "reason": "Same customer and problem"}, format="json")
        request = CaseManagementView().initialize_request(raw)
        request.support_staff = self.supervisor
        response = CaseManagementView().post(request, "complaint", self.main.id)

        self.assertEqual(response.status_code, 201)
        self.main.refresh_from_db()
        self.duplicate.refresh_from_db()
        self.assertEqual(self.main.status, "open")
        self.assertEqual(self.duplicate.status, "closed")
        self.assertTrue(Complaint.objects.filter(pk=self.duplicate.id).exists())
        relation = CaseRelation.objects.get(source_id=self.main.id, target_id=self.duplicate.id)
        self.assertEqual(relation.relation, "duplicate")
        self.assertIsNotNone(relation.merged_at)
