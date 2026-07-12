from django.urls import path
from .views import (
    AvailablePlansView,
    CurrentSubscriptionView,
    CreateSubscriptionView,
    VerifyPaymentView,
    SyncSubscriptionView,
    RazorpayWebhookView
)

urlpatterns = [
    path('plans/', AvailablePlansView.as_view(), name='available_plans'),
    path('my-subscription/', CurrentSubscriptionView.as_view(), name='my_subscription'),
    path('create/', CreateSubscriptionView.as_view(), name='create_subscription'),
    path('verify/', VerifyPaymentView.as_view(), name='verify_payment'),
    path('sync/', SyncSubscriptionView.as_view(), name='sync_subscription'),
    path('webhook/', RazorpayWebhookView.as_view(), name='razorpay_webhook'),
]
