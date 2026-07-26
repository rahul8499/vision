import re

import requests
from django.conf import settings


class Msg91ConfigurationError(RuntimeError):
    pass


class Msg91VerificationError(RuntimeError):
    pass


def normalize_indian_mobile(value):
    digits = re.sub(r'\D', '', str(value or ''))
    if len(digits) == 10 and digits[0] in '6789':
        return f'91{digits}'
    if len(digits) == 12 and digits.startswith('91') and digits[2] in '6789':
        return digits
    raise ValueError('Enter a valid Indian mobile number.')


def _find_identifier(value):
    if isinstance(value, dict):
        preferred = ('identifier', 'mobile', 'phone', 'phone_number')
        for key in preferred:
            if key in value:
                try:
                    return normalize_indian_mobile(value[key])
                except ValueError:
                    pass
        for nested in value.values():
            result = _find_identifier(nested)
            if result:
                return result
    elif isinstance(value, list):
        for nested in value:
            result = _find_identifier(nested)
            if result:
                return result
    elif isinstance(value, str):
        for candidate in re.findall(r'(?:\+?91[\s-]?)?[6-9]\d{9}', value):
            try:
                return normalize_indian_mobile(candidate)
            except ValueError:
                pass
    return None


def verify_access_token(access_token, expected_mobile):
    auth_key = settings.MSG91_AUTH_KEY.strip()
    if not auth_key:
        raise Msg91ConfigurationError('MSG91_AUTH_KEY is not configured on the server.')
    if not str(access_token or '').strip():
        raise Msg91VerificationError('MSG91 access token is required.')

    try:
        response = requests.post(
            settings.MSG91_VERIFY_ACCESS_TOKEN_URL,
            json={'authkey': auth_key, 'access-token': str(access_token).strip()},
            timeout=settings.MSG91_HTTP_TIMEOUT_SECONDS,
        )
        payload = response.json()
    except (requests.RequestException, ValueError) as exc:
        raise Msg91VerificationError('Could not verify OTP with MSG91.') from exc

    provider_success = response.ok and str(payload.get('type', '')).lower() == 'success'
    verified_mobile = _find_identifier(payload)
    expected_mobile = normalize_indian_mobile(expected_mobile)
    if not provider_success or verified_mobile != expected_mobile:
        raise Msg91VerificationError('OTP verification is invalid or belongs to another number.')
    return verified_mobile
