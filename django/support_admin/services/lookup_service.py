from django.db.models import Q
from prescription.models import User, Store
from ..selectors.lookup_selectors import get_user_by_id, get_store_by_id, search_users, search_stores


def lookup_users(query=None, user_id=None, page=1, page_size=20):
    if user_id:
        user = get_user_by_id(user_id)
        if not user:
            return []
        return [user]
    if query:
        return search_users(query, page, page_size)
    return []


def lookup_stores(query=None, store_id=None, page=1, page_size=20):
    if store_id:
        store = get_store_by_id(store_id)
        if not store:
            return []
        return [store]
    if query:
        return search_stores(query, page, page_size)
    return []
