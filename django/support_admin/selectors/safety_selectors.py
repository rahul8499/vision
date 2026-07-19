from django.db.models import Q
from prescription.models import SafetyReport


def get_safety_report_by_id(report_id):
    try:
        return SafetyReport.objects.select_related(
            "reporter_user", "reporter_store", "reported_user", "reported_store",
            "prescription", "response", "city", "service_zone"
        ).get(id=report_id)
    except SafetyReport.DoesNotExist:
        return None


def get_safety_report_queryset():
    return SafetyReport.objects.select_related(
        "reporter_user", "reporter_store", "reported_user", "reported_store"
    ).all()


def search_safety_reports(
    query=None, status=None, severity=None, category=None, assigned_to=None,
    date_from=None, date_to=None, reporter_type=None, target_type=None,
    scope=None, city_id=None, allowed_city_ids=None, page=1, page_size=20,
):
    qs = get_safety_report_queryset()
    if query:
        search_filter = (
            Q(description__icontains=query) |
            Q(reporter_user__name__icontains=query) |
            Q(reporter_store__name__icontains=query) |
            Q(reported_user__name__icontains=query) |
            Q(reported_store__name__icontains=query)
        )
        if str(query).isdigit():
            search_filter |= Q(id=int(query)) | Q(prescription_id=int(query)) | Q(response_id=int(query))
        qs = qs.filter(search_filter)
    if status:
        qs = qs.filter(status=status)
    if category:
        qs = qs.filter(category=category)
    if severity:
        qs = qs.filter(severity=severity)
    if assigned_to == "unassigned":
        qs = qs.filter(assigned_to_id__isnull=True)
    elif assigned_to:
        qs = qs.filter(assigned_to_id=assigned_to)
    if reporter_type:
        qs = qs.filter(reporter_type=reporter_type)
    if target_type:
        qs = qs.filter(target_type=target_type)
    if scope:
        qs = qs.filter(scope=scope)
    if city_id:
        qs = qs.filter(Q(scope='GLOBAL') | Q(city_id=city_id))
    elif allowed_city_ids is not None:
        qs = qs.filter(Q(scope='GLOBAL') | Q(city_id__in=allowed_city_ids))
    if date_from:
        qs = qs.filter(created_at__date__gte=date_from)
    if date_to:
        qs = qs.filter(created_at__date__lte=date_to)
    total = qs.count()
    start = (page - 1) * page_size
    end = start + page_size
    results = qs.order_by("-created_at")[start:end]
    return results, total
