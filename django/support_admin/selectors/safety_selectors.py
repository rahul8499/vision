from django.db.models import Q
from prescription.models import SafetyReport


def get_safety_report_by_id(report_id):
    try:
        return SafetyReport.objects.select_related(
            "reporter_user", "reporter_store", "reported_user", "reported_store",
            "prescription", "response"
        ).get(id=report_id)
    except SafetyReport.DoesNotExist:
        return None


def get_safety_report_queryset():
    return SafetyReport.objects.select_related(
        "reporter_user", "reporter_store", "reported_user", "reported_store"
    ).all()


def search_safety_reports(query=None, status=None, severity=None, category=None, assigned_to=None, date_from=None, date_to=None, page=1, page_size=20):
    qs = get_safety_report_queryset()
    if query:
        qs = qs.filter(
            Q(description__icontains=query) |
            Q(reporter_user__name__icontains=query) |
            Q(reported_user__name__icontains=query) |
            Q(reported_store__name__icontains=query)
        )
    if status:
        qs = qs.filter(status=status)
    if category:
        qs = qs.filter(category=category)
    if date_from:
        qs = qs.filter(created_at__gte=date_from)
    if date_to:
        qs = qs.filter(created_at__lte=date_to)
    total = qs.count()
    start = (page - 1) * page_size
    end = start + page_size
    results = qs.order_by("-created_at")[start:end]
    return results, total
