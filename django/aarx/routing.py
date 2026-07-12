from django.urls import path
from prescription.consumers import ChatConsumer, FulfillmentConsumer, StoreFulfillmentConsumer

websocket_urlpatterns = [
    path('ws/chat/<int:thread_id>/', ChatConsumer.as_asgi()),
    path('ws/orders/', FulfillmentConsumer.as_asgi()),
    path('ws/store-orders/', StoreFulfillmentConsumer.as_asgi()),
]
