from django.db.models import Q
from prescription.models import User, Store


def get_user_by_id(user_id):
    try:
        return User.objects.get(id=user_id, is_deleted=False)
    except User.DoesNotExist:
        return None


def get_store_by_id(store_id):
    try:
        return Store.objects.get(id=store_id, is_deleted=False)
    except Store.DoesNotExist:
        return None


def search_users(query, page=1, page_size=20):
    qs = User.objects.filter(is_deleted=False)
    if query:
        qs = qs.filter(
            Q(name__icontains=query) |
            Q(email__icontains=query) |
            Q(mobile__icontains=query)
        )
    # The legacy User model has no created_at column. Primary-key ordering is
    # deterministic and keeps the newest-created records first.
    return qs.order_by("-id"), qs.count()


def search_stores(query, page=1, page_size=20):
    qs = Store.objects.filter(is_deleted=False)
    if query:
        qs = qs.filter(
            Q(name__icontains=query) |
            Q(owner_name__icontains=query) |
            Q(email__icontains=query) |
            Q(mobile__icontains=query)
        )
    return qs.order_by("-created_at"), qs.count()
