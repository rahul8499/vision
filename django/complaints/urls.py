from django.urls import path

from .views import (
    ComplaintCreateView,
    MyComplaintsView,
    ComplaintsAgainstView,
    ComplaintCountsView,
    ComplaintDetailView,
    ComplaintMessageView,
    ComplaintWithdrawView,
    ComplaintPlatformListView,
    ComplaintPlatformActionView,
    PlatformSupportTicketListCreateView,
    PlatformSupportTicketDetailView,
    PlatformSupportMessageView,
    ComplaintRatingView,
    SupportTicketRatingView,
)

urlpatterns = [
    path('platform-support/', PlatformSupportTicketListCreateView.as_view(), name='platform_support_list_create'),
    path('platform-support/<int:ticket_id>/', PlatformSupportTicketDetailView.as_view(), name='platform_support_detail'),
    path('platform-support/<int:ticket_id>/messages/', PlatformSupportMessageView.as_view(), name='platform_support_message'),
    path('platform-support/<int:ticket_id>/rating/', SupportTicketRatingView.as_view(), name='platform_support_rating'),
    path('', ComplaintCreateView.as_view(), name='complaint_create'),
    path('my/', MyComplaintsView.as_view(), name='complaint_my'),
    path('against/', ComplaintsAgainstView.as_view(), name='complaint_against'),
    path('counts/', ComplaintCountsView.as_view(), name='complaint_counts'),
    path('<int:complaint_id>/', ComplaintDetailView.as_view(), name='complaint_detail'),
    path('<int:complaint_id>/messages/', ComplaintMessageView.as_view(), name='complaint_message'),
    path('<int:complaint_id>/withdraw/', ComplaintWithdrawView.as_view(), name='complaint_withdraw'),
    path('<int:complaint_id>/rating/', ComplaintRatingView.as_view(), name='complaint_rating'),
    path('admin/', ComplaintPlatformListView.as_view(), name='complaint_admin_list'),
    path('admin/<int:complaint_id>/', ComplaintPlatformActionView.as_view(), name='complaint_admin_action'),
]
