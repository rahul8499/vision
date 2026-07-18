from django.utils import timezone
from prescription.models import SafetyReport
from ..models import SupportStaff, SafetyReportAction, SupportNotification
from ..selectors.lookup_selectors import get_user_by_id, get_store_by_id
from ..selectors.safety_selectors import get_safety_report_by_id, search_safety_reports


def list_safety_reports(filters=None):
    filters = filters or {}
    results, total = search_safety_reports(
        query=filters.get("query"),
        status=filters.get("status"),
        category=filters.get("category"),
        assigned_to=filters.get("assigned_to"),
        date_from=filters.get("date_from"),
        date_to=filters.get("date_to"),
        page=filters.get("page", 1),
        page_size=filters.get("page_size", 20),
    )
    return results, total


def get_safety_report(report_id):
    return get_safety_report_by_id(report_id)


def create_safety_report_action(report_id, action, admin, note, target_user_id=None, target_store_id=None):
    try:
        report = SafetyReport.objects.get(id=report_id)
    except SafetyReport.DoesNotExist:
        raise ValueError("Safety report not found.")

    target_user = None
    target_store = None
    if target_user_id:
        target_user = get_user_by_id(target_user_id)
    if target_store_id:
        target_store = get_store_by_id(target_store_id)

    action_obj = SafetyReportAction.objects.create(
        report=report,
        action=action,
        admin=admin,
        note=note,
        target_user=target_user,
        target_store=target_store,
    )

    if action in ("account_suspended", "account_restored", "escalated"):
        if target_user:
            SupportNotification.objects.create(
                recipient=admin,
                notification_type="safety_report_action",
                title="Safety Report Action",
                message=f"Action '{action}' taken on user {target_user.name} for report #{report.id}",
                entity_type="safety_report",
                entity_id=str(report.id),
            )
        elif target_store:
            SupportNotification.objects.create(
                recipient=admin,
                notification_type="safety_report_action",
                title="Safety Report Action",
                message=f"Action '{action}' taken on store {target_store.name} for report #{report.id}",
                entity_type="safety_report",
                entity_id=str(report.id),
            )

    return action_obj
