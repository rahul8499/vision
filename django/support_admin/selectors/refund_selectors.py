from ..models import RefundRequest
from emergency_services.models import EmergencyBroadcastCharge
from django.db.models import Q


def get_refund_by_id(refund_id):
    try:
        return RefundRequest.objects.select_related(
            "charge", "prescription_response", "requested_by", "assigned_to", "reviewed_by"
        ).get(id=refund_id)
    except RefundRequest.DoesNotExist:
        return None


def get_refund_queryset():
    return RefundRequest.objects.select_related(
        "charge", "prescription_response", "requested_by", "assigned_to", "reviewed_by"
    ).all()


def search_refunds(query=None, status=None, assigned_to=None, requested_by=None, page=1, page_size=20):
    qs = get_refund_queryset()
    if query:
        qs = qs.filter(
            Q(reason__icontains=query) |
            Q(payment_reference__icontains=query) |
            Q(charge__id__icontains=query)
        )
    if status:
        qs = qs.filter(status=status)
    if assigned_to:
        qs = qs.filter(assigned_to_id=assigned_to)
    if requested_by:
        qs = qs.filter(requested_by_id=requested_by)
    return qs.order_by("-created_at"), qs.count()
