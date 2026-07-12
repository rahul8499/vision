# core/services/action_validator.py
from rest_framework import status
from rest_framework.exceptions import APIException
from rest_framework.response import Response
from core.services.capability_service import get_capability_flags, increment_metric, log_capability_change


def blocked_error_payload(code, message, permission):
    return {
        "error": {
            "code": (code or "capability_blocked").upper(),
            "message": message or "Action blocked.",
            "permission": permission,
        }
    }


class CapabilityBlocked(APIException):
    status_code = status.HTTP_403_FORBIDDEN
    default_detail = 'Action blocked by capability policy.'
    default_code = 'capability_blocked'

    def __init__(self, detail, code=None, permission=None):
        super().__init__(detail=blocked_error_payload(code or self.default_code, detail, permission))


def blocked_response(code, message, permission, http_status=status.HTTP_403_FORBIDDEN):
    return Response(blocked_error_payload(code, message, permission), status=http_status)


def validate_action_capability(permission_key, actor=None, resource=None, user=None, store=None):
    flags = get_capability_flags(actor=actor, resource=resource, user=user, store=store, action=permission_key)

    if not flags["permissions"].get(permission_key, False):
        status_code = flags["status"].get("code")
        message = flags["status"].get("message") or "Action blocked."
        increment_metric(f"blocked.{permission_key}.{status_code}")
        log_capability_change(
            actor=actor,
            resource=resource,
            action=permission_key,
            old_state="attempt",
            new_state="denied",
            reason=status_code,
        )
        raise CapabilityBlocked(detail=message, code=status_code, permission=permission_key)

    return True


def action_blocked_response(permission_key, actor=None, resource=None, user=None, store=None):
    flags = get_capability_flags(actor=actor, resource=resource, user=user, store=store, action=permission_key)
    if flags["permissions"].get(permission_key, False):
        return None
    code = flags["status"].get("code")
    message = flags["status"].get("message") or "Action blocked."
    increment_metric(f"blocked.{permission_key}.{code}")
    return blocked_response(code, message, permission_key)
