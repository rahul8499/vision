from django.db.models import Q
from complaints.models import Complaint, ComplaintMessage, ComplaintAttachment, ComplaintStatusHistory
from prescription.models import User, Store


def get_complaint_by_id(complaint_id):
    try:
        return Complaint.objects.select_related(
            "complainant_user", "complainant_store",
            "respondent_user", "respondent_store", "order", "city", "service_zone"
        ).prefetch_related("attachments", "messages", "status_history").get(id=complaint_id)
    except Complaint.DoesNotExist:
        return None


def get_complaint_queryset():
    return Complaint.objects.select_related(
        "complainant_user", "complainant_store",
        "respondent_user", "respondent_store", "order", "city", "service_zone"
    ).all()


def search_complaints(query=None, status=None, category=None, priority=None, page=1, page_size=20):
    qs = get_complaint_queryset()
    if query:
        qs = qs.filter(
            Q(subject__icontains=query) |
            Q(description__icontains=query) |
            Q(complainant_user__name__icontains=query) |
            Q(complainant_store__name__icontains=query) |
            Q(respondent_user__name__icontains=query) |
            Q(respondent_store__name__icontains=query)
        )
    if status:
        qs = qs.filter(status=status)
    if category:
        qs = qs.filter(category=category)
    if priority:
        qs = qs.filter(priority=priority)
    return qs.order_by("-created_at"), qs.count()
