# core/services/capability_service.py
import logging
from enum import Enum
from django.conf import settings
from django.core.cache import cache

logger = logging.getLogger(__name__)

ENABLE_CAPABILITY_FLAGS = getattr(settings, 'ENABLE_CAPABILITY_FLAGS', True)


class Permission:
    CHAT = "chat"
    OFFER = "offer"
    ENQUIRY = "enquiry"
    CALL = "call"
    VIEW_ADDRESS = "view_address"
    ACCEPT_QUOTE = "accept_quote"
    REJECT_QUOTE = "reject_quote"
    PLACE_ORDER = "place_order"
    RATE = "rate"


class _StringEnum(str, Enum):
    def __str__(self):
        return self.value


class Status(_StringEnum):
    ACTIVE = "active"
    STORE_UNVERIFIED = "store_unverified"
    STORE_INACTIVE = "store_inactive"
    STORE_SUSPENDED = "store_suspended"
    STORE_DELETED = "store_deleted"
    USER_VERIFIED = "user_verified"
    USER_INACTIVE = "user_inactive"
    USER_DELETED = "user_deleted"


def get_store_lifecycle_status(store):
    if store is None:
        return Status.ACTIVE

    if getattr(store, 'is_deleted', False):
        return Status.STORE_DELETED
    if not getattr(store, 'is_active', True):
        return Status.STORE_INACTIVE
    if not getattr(store, 'is_verified', True):
        return Status.STORE_UNVERIFIED
    return Status.ACTIVE


def get_user_lifecycle_status(user):
    if user is None:
        return Status.ACTIVE

    if getattr(user, 'is_deleted', False):
        return Status.USER_DELETED
    if not getattr(user, 'is_active', True):
        return Status.USER_INACTIVE
    if getattr(user, 'is_verified', False):
        return Status.USER_VERIFIED
    return Status.ACTIVE


def apply_store_lifecycle(store, *, is_active=None, is_verified=None, reason="", changed_by=None):
    """
    Central write path for Store lifecycle flags.

    Keep this save-based so pre_save/post_save signals can broadcast capability
    changes to WebSocket clients. Avoid QuerySet.update() for these two fields.
    """
    old_state = get_store_lifecycle_status(store)
    update_fields = []

    if is_active is not None and store.is_active != is_active:
        store.is_active = is_active
        update_fields.append('is_active')
    if is_verified is not None and store.is_verified != is_verified:
        store.is_verified = is_verified
        update_fields.append('is_verified')

    if not update_fields:
        return False

    store.save(update_fields=update_fields)
    log_capability_change(
        actor=changed_by,
        resource=store,
        action="store_lifecycle",
        old_state=old_state,
        new_state=get_store_lifecycle_status(store),
        reason=reason,
    )
    return True


def apply_user_lifecycle(user, *, is_active=None, is_verified=None, is_deleted=None, reason="", changed_by=None):
    old_state = get_user_lifecycle_status(user)
    update_fields = []

    if is_active is not None and getattr(user, 'is_active', True) != is_active:
        user.is_active = is_active
        update_fields.append('is_active')
    if is_verified is not None and getattr(user, 'is_verified', False) != is_verified:
        user.is_verified = is_verified
        update_fields.append('is_verified')
    if is_deleted is not None and getattr(user, 'is_deleted', False) != is_deleted:
        user.is_deleted = is_deleted
        update_fields.append('is_deleted')

    if is_deleted is True and getattr(user, 'token', None):
        user.token = None
        update_fields.append('token')

    if not update_fields:
        return False

    user.save(update_fields=update_fields)
    log_capability_change(
        actor=changed_by,
        resource=user,
        action="user_lifecycle",
        old_state=old_state,
        new_state=get_user_lifecycle_status(user),
        reason=reason,
    )
    return True


def deactivate_user(user, *, reason="", changed_by=None):
    return apply_user_lifecycle(user, is_active=False, reason=reason, changed_by=changed_by)


def activate_user(user, *, reason="", changed_by=None):
    return apply_user_lifecycle(user, is_active=True, is_deleted=False, reason=reason, changed_by=changed_by)


def verify_user(user, *, reason="", changed_by=None):
    return apply_user_lifecycle(user, is_verified=True, reason=reason, changed_by=changed_by)


def delete_user_account(user, *, reason="", changed_by=None):
    return apply_user_lifecycle(user, is_active=False, is_deleted=True, reason=reason, changed_by=changed_by)


def delete_store_account(store, *, reason="", changed_by=None):
    old_state = get_store_lifecycle_status(store)
    update_fields = []

    if not getattr(store, 'is_deleted', False):
        store.is_deleted = True
        update_fields.append('is_deleted')
    if getattr(store, 'is_active', True):
        store.is_active = False
        update_fields.append('is_active')
    if getattr(store, 'token', None):
        store.token = None
        update_fields.append('token')

    if not update_fields:
        return False

    store.save(update_fields=update_fields)
    log_capability_change(
        actor=changed_by,
        resource=store,
        action="store_lifecycle",
        old_state=old_state,
        new_state=get_store_lifecycle_status(store),
        reason=reason,
    )
    return True


def deactivate_store(store, *, reason="", changed_by=None):
    return apply_store_lifecycle(store, is_active=False, reason=reason, changed_by=changed_by)


def activate_store(store, *, reason="", changed_by=None):
    return apply_store_lifecycle(store, is_active=True, reason=reason, changed_by=changed_by)


def verify_store(store, *, reason="", changed_by=None):
    return apply_store_lifecycle(store, is_verified=True, reason=reason, changed_by=changed_by)


def unverify_store(store, *, reason="", changed_by=None):
    return apply_store_lifecycle(store, is_verified=False, reason=reason, changed_by=changed_by)


def increment_metric(name, amount=1):
    key = f"capability_metric:{name}"
    try:
        cache.incr(key, amount)
    except ValueError:
        cache.set(key, amount, timeout=None)
    except Exception:
        logger.debug("Capability metric increment failed: %s", name, exc_info=True)


def log_capability_change(actor, resource, action, old_state, new_state, reason=""):
    logger.info(
        "CAPABILITY_CHANGE: actor=%s resource=%s action=%s transition=%s->%s reason=%s",
        getattr(actor, 'id', None),
        getattr(resource, 'id', None),
        action,
        old_state,
        new_state,
        reason,
    )


def _resolve_subjects(actor=None, resource=None, user=None, store=None):
    resolved_user = user
    resolved_store = store

    if resource is not None:
        if resolved_user is None:
            resolved_user = getattr(resource, 'user', None)
            if resolved_user is None:
                prescription = getattr(resource, 'prescription', None)
                resolved_user = getattr(prescription, 'user', None) if prescription else None
        if resolved_store is None:
            resolved_store = getattr(resource, 'store', None)

    if actor is not None:
        if resolved_user is None and getattr(actor, 'is_user', False):
            resolved_user = actor
        if resolved_store is None and getattr(actor, 'is_store', False):
            resolved_store = actor

    return resolved_user, resolved_store


def get_capability_flags(actor=None, resource=None, action=None, user=None, store=None):
    resolved_user, resolved_store = _resolve_subjects(actor=actor, resource=resource, user=user, store=store)

    payload = {
        "availability": {
            "user": True,
            "store": True,
            "store_verified": True,
        },
        "permissions": {
            Permission.CHAT: True,
            Permission.OFFER: True,
            Permission.ENQUIRY: True,
            Permission.CALL: True,
            Permission.VIEW_ADDRESS: True,
            Permission.ACCEPT_QUOTE: True,
            Permission.REJECT_QUOTE: True,
            Permission.PLACE_ORDER: True,
            Permission.RATE: True,
        },
        "status": {
            "code": Status.ACTIVE.value,
            "message": "",
        },
    }

    if not ENABLE_CAPABILITY_FLAGS:
        return payload

    user_active = getattr(resolved_user, 'is_active', True) if resolved_user else True
    store_active = getattr(resolved_store, 'is_active', True) if resolved_store else True
    store_verified = getattr(resolved_store, 'is_verified', True) if resolved_store else True
    user_status = get_user_lifecycle_status(resolved_user)
    store_status = get_store_lifecycle_status(resolved_store)

    payload["availability"]["user"] = bool(user_active)
    payload["availability"]["store"] = bool(store_active)
    payload["availability"]["store_verified"] = bool(store_verified)

    if resolved_store and store_status == Status.STORE_DELETED:
        payload["status"] = {
            "code": Status.STORE_DELETED.value,
            "message": "Store account has been deleted.",
        }
        for key in payload["permissions"]:
            payload["permissions"][key] = False

    elif resolved_store and store_status == Status.STORE_INACTIVE:
        payload["status"] = {
            "code": Status.STORE_INACTIVE.value,
            "message": "Store is currently inactive and cannot receive orders.",
        }
        for key in payload["permissions"]:
            payload["permissions"][key] = False

    elif resolved_store and store_status == Status.STORE_UNVERIFIED:
        payload["status"] = {
            "code": Status.STORE_UNVERIFIED.value,
            "message": "Verify your store to continue.",
        }
        for key in (
            Permission.CHAT,
            Permission.OFFER,
            Permission.ACCEPT_QUOTE,
            Permission.REJECT_QUOTE,
            Permission.PLACE_ORDER,
            Permission.VIEW_ADDRESS,
        ):
            payload["permissions"][key] = False

    elif resolved_user and user_status == Status.USER_DELETED:
        payload["status"] = {
            "code": Status.USER_DELETED.value,
            "message": "User account has been deleted.",
        }
        for key in payload["permissions"]:
            payload["permissions"][key] = False

    elif resolved_user and user_status == Status.USER_INACTIVE:
        payload["status"] = {
            "code": Status.USER_INACTIVE.value,
            "message": "User account is inactive.",
        }
        for key in payload["permissions"]:
            payload["permissions"][key] = False

    return payload


def get_cached_capability_flags(context=None, actor=None, resource=None, action=None, user=None, store=None):
    cache_bucket = None
    if context is not None:
        cache_bucket = context.setdefault('_capability_cache', {})

    resource_key = f"{resource.__class__.__name__}:{getattr(resource, 'pk', id(resource))}" if resource is not None else "none"
    actor_key = f"{getattr(actor, 'is_store', False)}:{getattr(actor, 'id', None)}" if actor is not None else "none"
    user_key = getattr(user, 'id', None)
    store_key = getattr(store, 'id', None)
    key = (actor_key, resource_key, action, user_key, store_key)

    if cache_bucket is not None and key in cache_bucket:
        return cache_bucket[key]

    flags = get_capability_flags(actor=actor, resource=resource, action=action, user=user, store=store)
    if cache_bucket is not None:
        cache_bucket[key] = flags
    return flags
