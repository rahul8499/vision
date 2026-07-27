from django.conf import settings
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token


class GoogleIdentityConfigurationError(Exception):
    pass


class GoogleIdentityVerificationError(Exception):
    pass


def verify_google_id_token(raw_token):
    audience = settings.GOOGLE_OAUTH_WEB_CLIENT_ID
    if not audience:
        raise GoogleIdentityConfigurationError('Google Sign-In is not configured.')
    if not raw_token or not isinstance(raw_token, str):
        raise GoogleIdentityVerificationError('Google ID token is required.')

    try:
        claims = id_token.verify_oauth2_token(
            raw_token,
            google_requests.Request(),
            audience,
        )
    except ValueError as exc:
        raise GoogleIdentityVerificationError('Google sign-in could not be verified.') from exc

    subject = str(claims.get('sub') or '').strip()
    email = str(claims.get('email') or '').strip().lower()
    if not subject:
        raise GoogleIdentityVerificationError('Google account identifier is missing.')
    if not email or claims.get('email_verified') is not True:
        raise GoogleIdentityVerificationError('A verified Google email is required.')

    return {
        'sub': subject,
        'email': email,
        'name': ' '.join(str(claims.get('name') or '').split())[:100],
    }
