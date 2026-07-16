from django.urls import path
from .views import PrescriptionUploadView
from .views import PrescriptionSendToStoresView

from .views import PublicPrescriptionListView
from rest_framework.authtoken import views


from .views import (
    StoreRegisterView, StoreLoginView,StoreLogoutView,
    StoreListView, StoreDetailUpdateDeleteView,UserRegisterView, UserLoginView, UserLogoutView,
    UserListView, UserDetailUpdateDeleteView,NearbyPrescriptionsView,LoggedInUserView,GetPrescriptionByIdView,SubmitResponseToUserPrescription,GetResponsesForUserPrescription,DeletePrescriptionResponse, GetResponseByIdViewForUserPrescription,StoreSubmittedResponsesView, StoreSubmittedResponseDetailView,StoreDashboardSummaryView,StoreMeView,UpdateResponseStatusAPIView,UserContactNoteUpdateView,StoreContactNoteView,SaveExpoPushTokenView,SaveUserExpoPushTokenView,
    LocationSearchView, LocationDetailsView, ChatInboxView, ChatThreadMessagesView, ChatInitView, ChatAudioUploadView, ChatMessageMediaUploadView,
    RequestStockRefreshView, VerifyStockAPIView,
    UserCancelOrderView, StoreCancelOrderView, StoreUpdateProgressView, VerifyCompletionOTPView, OrderAgainView,
    SubmitRatingView, PendingRatingsView, StoreReviewsView, SubmitAppRatingView,
    RequestPasswordResetOTPView, VerifyPasswordResetOTPView, ConfirmPasswordResetView, AccountDeleteView, AppNotificationListView, AppNotificationMarkReadView,
    StoreRejectEnquiryView, SafetyReportListCreateView,
    PharmacistConsultationOrderView, PharmacistConsultationDetailView, PharmacistCallbackView,
    StorePharmacistConsultationListView, StorePharmacistAvailabilityView,
    StoreDeliverySettingsView, StoreDeliveryPersonListCreateView,
    StoreDeliveryPersonDetailView, PrescriptionDeliveryPreviewView,
)
urlpatterns = [
    path('upload/', PrescriptionUploadView.as_view(), name='upload'),
    path('send-prescription-to-stores/', PrescriptionSendToStoresView.as_view(), name='send_prescription_to_stores'),

    path("save-expo-token/", SaveExpoPushTokenView.as_view(), name="save-expo-token"),
    path("user-save-expo-token/", SaveUserExpoPushTokenView.as_view(), name="user-save-expo-token"),
    path("notifications/", AppNotificationListView.as_view(), name="app-notifications"),
    path("notifications/mark-read/", AppNotificationMarkReadView.as_view(), name="app-notifications-mark-read"),

    path('nearby-prescriptions/', NearbyPrescriptionsView.as_view(), name='nearby-prescriptions'),
    path('search-location/', LocationSearchView.as_view(), name='search-location'),
    path('location-details/', LocationDetailsView.as_view(), name='location-details'),
    path('api-token-auth/', views.obtain_auth_token),
    path('me/', LoggedInUserView.as_view(), name='logged-in-user'),
    path("store-me/", StoreMeView.as_view(), name="store-me"),
    path("store/delivery-settings/", StoreDeliverySettingsView.as_view(), name="store-delivery-settings"),
    path("store/delivery-persons/", StoreDeliveryPersonListCreateView.as_view(), name="store-delivery-person-list"),
    path("store/delivery-persons/<int:person_id>/", StoreDeliveryPersonDetailView.as_view(), name="store-delivery-person-detail"),
    path("account/delete/", AccountDeleteView.as_view(), name="account-delete"),

    path('store/register/', StoreRegisterView.as_view(), name='store_register'),
    path('store/login/', StoreLoginView.as_view(), name='store_login'),
    path('store/logout/', StoreLogoutView.as_view(), name='store_logout'),

    path('stores/', StoreListView.as_view(), name='store_list'),
    path('store/<int:pk>/', StoreDetailUpdateDeleteView.as_view(), name='store_detail'),
    path('user/register/', UserRegisterView.as_view(), name='user_register'),
    path('user/login/', UserLoginView.as_view(), name='user_login'),
    path('user/logout/', UserLogoutView.as_view(), name='user_logout'),

    path('users/', UserListView.as_view(), name='user_list'),
    path('user/<int:pk>/', UserDetailUpdateDeleteView.as_view(), name='user_detail'),
    path('prescriptions/', PublicPrescriptionListView.as_view(), name='public_prescriptions'),
    path('prescription/<int:id>/', GetPrescriptionByIdView.as_view(), name='get-prescription-by-id'),
    path('prescriptions/<int:prescription_id>/delivery-preview/', PrescriptionDeliveryPreviewView.as_view(), name='prescription-delivery-preview'),
    path('user/<int:user_id>/send-response/', SubmitResponseToUserPrescription.as_view(), name='submit-response-to-user'),

    # ✅ Specific sub-paths MUST come before generic responses/<int>/
    path('responses/delete/<int:response_id>/', DeletePrescriptionResponse.as_view(), name='delete_prescription_response'),
    path('responses/<int:response_id>/status/', UpdateResponseStatusAPIView.as_view(), name='update_response_status'),
    path('responses/<int:response_id>/user-contact-note/', UserContactNoteUpdateView.as_view(), name='user_contact_note'),
    path('responses/<int:response_id>/store-contact-note/', StoreContactNoteView.as_view(), name='store-contact-note'),
    path('responses/<int:response_id>/report/', StoreContactNoteView.as_view(), name='store-report'),
    path('store-reports/<int:response_id>/', StoreContactNoteView.as_view(), name='store-report-stable'),
    path('safety-reports/', SafetyReportListCreateView.as_view(), name='safety-report-list-create'),
    path('pharmacist/order/<int:order_id>/', PharmacistConsultationOrderView.as_view(), name='pharmacist-order'),
    path('pharmacist/consultations/<int:consultation_id>/', PharmacistConsultationDetailView.as_view(), name='pharmacist-consultation-detail'),
    path('pharmacist/consultations/<int:consultation_id>/callback/', PharmacistCallbackView.as_view(), name='pharmacist-callback'),
    path('pharmacist/store/inbox/', StorePharmacistConsultationListView.as_view(), name='pharmacist-store-inbox'),
    path('pharmacist/store/availability/', StorePharmacistAvailabilityView.as_view(), name='pharmacist-store-availability'),
    path('responses/<int:response_id>/refresh-request/', RequestStockRefreshView.as_view(), name='request_stock_refresh'),
    path('responses/<int:response_id>/verify-stock/', VerifyStockAPIView.as_view(), name='verify_stock'),
    path('responses/<int:response_id>/cancel/', UserCancelOrderView.as_view(), name='user_cancel_order'),
    path('responses/<int:response_id>/store-cancel/', StoreCancelOrderView.as_view(), name='store_cancel_order'),
    path('prescriptions/<int:prescription_id>/store-reject/', StoreRejectEnquiryView.as_view(), name='store_reject_enquiry'),
    path('responses/<int:response_id>/progress/', StoreUpdateProgressView.as_view(), name='store_update_progress'),
    path('responses/<int:response_id>/completion-otp/verify/', VerifyCompletionOTPView.as_view(), name='verify_completion_otp'),
    path('responses/<int:response_id>/order-again/', OrderAgainView.as_view(), name='order_again'),

    # Generic: used by user to list their responses
    path('responses/<int:user_id>/', GetResponsesForUserPrescription.as_view(), name='get_responses_for_user'),

    path('response/<int:response_id>/',  GetResponseByIdViewForUserPrescription.as_view(), name='get_response_by_id'),
    path('store/dashboard-summary/', StoreDashboardSummaryView.as_view(), name='store_dashboard_summary'),
    path('store/my-responses/', StoreSubmittedResponsesView.as_view(), name='store_submitted_responses'),
    path('store/my-responses/<int:id>/', StoreSubmittedResponseDetailView.as_view(), name='store_response_detail'),

    path('chat/inbox/', ChatInboxView.as_view(), name='chat_inbox'),
    path('chat/<int:thread_id>/messages/', ChatThreadMessagesView.as_view(), name='chat_messages'),
    path('chat/<int:thread_id>/upload-audio/', ChatAudioUploadView.as_view(), name='chat_audio_upload'),
    path('chat/<int:thread_id>/upload-media/', ChatMessageMediaUploadView.as_view(), name='chat_media_upload'),
    path('chat/init/', ChatInitView.as_view(), name='chat_init'),
    
    path('ratings/submit/', SubmitRatingView.as_view(), name='submit_rating'),
    path('ratings/pending/', PendingRatingsView.as_view(), name='pending_ratings'),
    path('ratings/store/<int:store_id>/', StoreReviewsView.as_view(), name='store_reviews'),
    path('app-ratings/submit/', SubmitAppRatingView.as_view(), name='submit_app_rating'),
    
    # Password Reset
    path('password-reset/request-otp/', RequestPasswordResetOTPView.as_view(), name='password_reset_request_otp'),
    path('password-reset/verify-otp/', VerifyPasswordResetOTPView.as_view(), name='password_reset_verify_otp'),
    path('password-reset/confirm/', ConfirmPasswordResetView.as_view(), name='password_reset_confirm'),
]
