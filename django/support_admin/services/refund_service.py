from django.db import transaction
from django.utils import timezone
from emergency_services.models import EmergencyBroadcastCharge
from ..models import RefundRequest, SupportStaff, SupportNotification
from ..selectors.refund_selectors import get_refund_by_id, get_refund_queryset
from ..selectors.staff_selectors import get_staff_by_id
from .notification_service import create_assignment_notification, eligible_staff_for_case
from emergency_services.models import EmergencyBroadcastCharge
from prescription.models import PrescriptionResponse


def assign_refund(refund_id, assigned_to_id):
    refund = get_refund_by_id(refund_id)
    if not refund:
        raise ValueError("Refund request not found.")

    staff = get_staff_by_id(assigned_to_id)
    if not staff or not staff.is_active:
        raise ValueError("Assigned staff not found or inactive.")
    city_id = refund.charge.city_id
    if not eligible_staff_for_case("CITY", city_id).filter(id=staff.id).exists():
        raise ValueError("Assigned staff does not have access to this refund city.")

    refund.assigned_to = staff
    refund.save(update_fields=["assigned_to", "updated_at"])
    create_assignment_notification(
        recipient=staff,
        title="Refund assigned to you",
        message=f"Refund #{refund.id}",
        entity_type="refund",
        entity_id=refund.id,
    )
    return refund


@transaction.atomic
def claim_unassigned_refund(refund_id, staff):
    refund = RefundRequest.objects.select_for_update().filter(id=refund_id).first()
    if not refund:
        raise ValueError("Refund request not found.")
    if refund.assigned_to_id:
        raise ValueError("This refund is already assigned.")
    return assign_refund(refund_id, staff.id)


def create_refund_request(charge_id, amount, reason, requested_by, prescription_response_id=None, metadata=None):
    try:
        charge = EmergencyBroadcastCharge.objects.get(id=charge_id)
    except EmergencyBroadcastCharge.DoesNotExist:
        raise ValueError("Emergency broadcast charge not found.")

    if prescription_response_id:
        try:
            prescription_response = PrescriptionResponse.objects.get(id=prescription_response_id)
        except PrescriptionResponse.DoesNotExist:
            raise ValueError("Prescription response not found.")
    else:
        prescription_response = None

    if RefundRequest.objects.filter(
        charge=charge,
        amount=amount,
        status__in=[RefundRequest.STATUS_PENDING, RefundRequest.STATUS_APPROVED],
    ).exists():
        raise ValueError("An active refund request for this payment and amount already exists.")

    refund = RefundRequest.objects.create(
        charge=charge,
        prescription_response=prescription_response,
        requested_by=requested_by,
        status="pending",
        amount=amount,
        reason=reason,
        metadata=metadata or {},
    )
    return refund


def review_refund(refund_id, action, admin, admin_note=None, payment_reference=None):
    refund = get_refund_by_id(refund_id)
    if not refund:
        raise ValueError("Refund request not found.")

    with transaction.atomic():
        if action == "approve":
            if refund.status != RefundRequest.STATUS_PENDING:
                raise ValueError("Only pending refunds can be approved.")
            refund.status = RefundRequest.STATUS_APPROVED
            refund.approved_at = timezone.now()
            refund.reviewed_by = admin
            if admin_note:
                refund.rejection_reason = admin_note
        elif action == "reject":
            if refund.status not in (RefundRequest.STATUS_PENDING, RefundRequest.STATUS_APPROVED):
                raise ValueError("Cannot reject refund in current status.")
            refund.status = RefundRequest.STATUS_REJECTED
            refund.reviewed_by = admin
            if admin_note:
                refund.rejection_reason = admin_note
        elif action == "process":
            if refund.status != RefundRequest.STATUS_APPROVED:
                raise ValueError("Only approved refunds can be processed.")
            if refund.reviewed_by_id == admin.id:
                raise ValueError("A different admin must process this refund after approval.")
            refund.status = RefundRequest.STATUS_PROCESSED
            refund.processed_at = timezone.now()
            refund.reviewed_by = admin
            if payment_reference:
                refund.payment_reference = payment_reference
        elif action == "retry":
            if refund.status != RefundRequest.STATUS_FAILED:
                raise ValueError("Only failed refunds can be retried.")
            refund.status = RefundRequest.STATUS_PENDING
            refund.reviewed_by = admin
        elif action == "cancel":
            if refund.status not in (RefundRequest.STATUS_PENDING, RefundRequest.STATUS_APPROVED):
                raise ValueError("Only pending or approved refunds can be cancelled.")
            refund.status = RefundRequest.STATUS_CANCELLED
            refund.reviewed_by = admin
            if admin_note:
                refund.rejection_reason = admin_note
        else:
            raise ValueError("Invalid action.")

        refund.save()
    return refund
