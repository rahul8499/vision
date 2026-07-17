from django.urls import path

from .views import (
    EmergencyChargeCreateView,
    EmergencyChargeHistoryView,
    EmergencyChargeVerifyView,
    EmergencyEligibilityView,
    EmergencyRazorpayWebhookView,
    StoreEmergencyRewardView,
)

urlpatterns = [
    path("eligibility/", EmergencyEligibilityView.as_view()),
    path("charges/", EmergencyChargeCreateView.as_view()),
    path("charges/history/", EmergencyChargeHistoryView.as_view()),
    path("charges/<uuid:charge_id>/verify/", EmergencyChargeVerifyView.as_view()),
    path("store/rewards/", StoreEmergencyRewardView.as_view()),
    path("webhooks/razorpay/", EmergencyRazorpayWebhookView.as_view()),
]
