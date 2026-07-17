# store_app/authentication.py

from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed
from .models import Store, User  # ✅ दोनों models import करो
from django.utils import translation

class StoreTokenAuthentication(BaseAuthentication):
    def authenticate(self, request):
        auth_header = request.headers.get('Authorization')

        if not auth_header:
            return None

        parts = auth_header.split()

        if len(parts) != 2 or parts[0].lower() != 'bearer':
            raise AuthenticationFailed('Authorization token must be provided as Bearer <token>.')

        token = parts[1]

        store = Store.objects.filter(token=token).first()

        if not store:
            return None

        if getattr(store, 'is_deleted', False):
            raise AuthenticationFailed('Store account has been deleted.')
        if not getattr(store, 'is_active', True):
            raise AuthenticationFailed('Store account is inactive.')

        language = getattr(store, 'preferred_language', 'en') or 'en'
        translation.activate(language)
        request.LANGUAGE_CODE = language
        getattr(request, '_request', request).LANGUAGE_CODE = language
        return (store, None)  # Django expects (user, auth)


class UserTokenAuthentication(BaseAuthentication):
    def authenticate(self, request):
        auth_header = request.headers.get('Authorization')

        if not auth_header:
            return None

        parts = auth_header.split()

        if len(parts) != 2 or parts[0].lower() != 'bearer':
            raise AuthenticationFailed('Authorization token must be provided as Bearer <token>.')

        token = parts[1]

        user = User.objects.filter(token=token).first()

        if not user:
            return None

        if getattr(user, 'is_deleted', False):
            raise AuthenticationFailed('User account has been deleted.')
        if not getattr(user, 'is_active', True):
            raise AuthenticationFailed('User account is inactive.')

        language = getattr(user, 'preferred_language', 'en') or 'en'
        translation.activate(language)
        request.LANGUAGE_CODE = language
        getattr(request, '_request', request).LANGUAGE_CODE = language
        return (user, None)  # Django expects (user, auth)
