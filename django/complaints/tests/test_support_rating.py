from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIRequestFactory, force_authenticate

from complaints.models import Complaint, SupportCaseRating
from complaints.views import ComplaintRatingView
from prescription.models import User
from support_admin.models import SupportStaff
from support_admin.services.complaint_service import reply_to_complaint, update_complaint_status


class SupportRatingTests(TestCase):
    def setUp(self):
        self.customer = User.objects.create(name="Customer", mobile="9000000001", email="customer-rating@example.test", password="password", address="Address", pincode="400001")
        self.other = User.objects.create(name="Other", mobile="9000000002", email="other-rating@example.test", password="password", address="Address", pincode="400001")
        self.complaint = Complaint.objects.create(complainant_type="user", complainant_user=self.customer, respondent_type="user", respondent_user=self.other, scope="GLOBAL", category="other", subject="Support rating case", description="Description", status="resolved")
        self.factory = APIRequestFactory()

    def submit(self, user, rating):
        request = self.factory.post(f"/complaints/{self.complaint.id}/rating/", {"rating": rating, "feedback": "Helpful"}, format="json")
        force_authenticate(request, user=user)
        return ComplaintRatingView.as_view()(request, complaint_id=self.complaint.id)

    def test_complainant_can_rate_completed_case(self):
        response = self.submit(self.customer, 5)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(SupportCaseRating.objects.get(complaint=self.complaint).rating, 5)

    def test_other_party_cannot_submit_complainant_rating(self):
        self.assertEqual(self.submit(self.other, 5).status_code, 403)

    def test_rating_must_be_between_one_and_five(self):
        self.assertEqual(self.submit(self.customer, 6).status_code, 400)

    def test_support_reply_and_status_change_store_actual_agent(self):
        auth_user = get_user_model().objects.create_user(username="rating-agent", email="rating-agent@example.test", password="password-123")
        staff = SupportStaff.objects.create(user=auth_user, role="agent", employee_id="RATING-AGENT")
        self.complaint.status = "open"
        self.complaint.save(update_fields=["status"])
        message = reply_to_complaint(self.complaint.id, "We are checking this.", staff)
        update_complaint_status(self.complaint.id, "resolved", "platform", changed_by_staff=staff)
        self.assertEqual(message.support_staff, staff)
        self.assertEqual(self.complaint.status_history.first().changed_by_staff, staff)
