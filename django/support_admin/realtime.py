import logging

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer

logger = logging.getLogger(__name__)


def broadcast_support_case_event(event_type, *, object_id, message="Support case updated"):
    """Broadcast only an ID; each client refetches data through its permissions."""
    try:
        async_to_sync(get_channel_layer().group_send)(
            "support_admin_dashboard",
            {"type": event_type.replace("_", "."), "data": {"id": object_id, "message": message}},
        )
    except Exception:
        logger.exception("Could not broadcast support case event %s", event_type)


def broadcast_monitoring_event(event_type, *, target_id=None, prescription_id=None, city_id=None):
    """Notify authorized support dashboards that monitoring data changed."""
    try:
        async_to_sync(get_channel_layer().group_send)(
            "support_emergency_monitoring",
            {
                "type": "monitoring.event",
                "event_type": event_type,
                "data": {
                    "target_id": target_id,
                    "prescription_id": prescription_id,
                    "city_id": city_id,
                },
            },
        )
    except Exception:
        # Monitoring WebSocket delivery must never break prescription workflows.
        logger.exception("Could not broadcast support monitoring event %s", event_type)
