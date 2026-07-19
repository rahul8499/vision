from django.urls import path
from prescription.consumers import ChatConsumer, FulfillmentConsumer, StoreFulfillmentConsumer
from complaints.consumers import ComplaintConsumer, SupportTicketConsumer
from support_admin.consumers import EmergencyMonitoringConsumer, AdminNotificationConsumer

websocket_urlpatterns = [
    path('ws/chat/<int:thread_id>/', ChatConsumer.as_asgi()),
    path('ws/orders/', FulfillmentConsumer.as_asgi()),
    path('ws/store-orders/', StoreFulfillmentConsumer.as_asgi()),
    path('ws/complaints/<int:complaint_id>/', ComplaintConsumer.as_asgi()),
    path('ws/support-tickets/<int:ticket_id>/', SupportTicketConsumer.as_asgi()),
    path('ws/support/emergency-monitoring/', EmergencyMonitoringConsumer.as_asgi()),
    path('ws/support/', AdminNotificationConsumer.as_asgi()),
]
