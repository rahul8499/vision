import logging

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer

logger = logging.getLogger(__name__)


def broadcast_complaint_event(complaint_id, event_type, data):
    """Publish one complaint event without coupling REST views to Channels."""
    channel_layer = get_channel_layer()
    if not channel_layer:
        return
    try:
        async_to_sync(channel_layer.group_send)(
            f"complaint_{complaint_id}",
            {
                "type": "complaint.event",
                "event_type": event_type,
                "data": data,
            },
        )
    except Exception:
        # Realtime is additive: a channel-layer outage must never fail a saved reply.
        logger.exception("Complaint realtime broadcast failed", extra={"complaint_id": complaint_id})
        return


def broadcast_support_ticket_event(ticket_id, event_type, data):
    """Publish an isolated platform-support ticket event."""
    channel_layer = get_channel_layer()
    if not channel_layer:
        return
    try:
        async_to_sync(channel_layer.group_send)(
            f"support_ticket_{ticket_id}",
            {
                "type": "support.ticket.event",
                "event_type": event_type,
                "data": data,
            },
        )
    except Exception:
        logger.exception("Support-ticket realtime broadcast failed", extra={"ticket_id": ticket_id})
        return
