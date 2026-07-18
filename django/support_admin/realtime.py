import logging

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer

logger = logging.getLogger(__name__)


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
