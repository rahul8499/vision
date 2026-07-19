from django.conf import settings
from django.contrib.auth import authenticate
from django.contrib.auth.models import AnonymousUser
from django.utils import timezone
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from rest_framework import exceptions
from .models import SupportStaff, SupportSession
import uuid


class SupportJWTAuthentication(JWTAuthentication):
    def get_user(self, validated_token):
        user = super().get_user(validated_token)
        try:
            staff = SupportStaff.objects.select_related("user").get(user=user, is_active=True)
        except SupportStaff.DoesNotExist:
            raise exceptions.AuthenticationFailed("Support staff not found or inactive.")
        session_key = validated_token.get("support_session")
        session = SupportSession.objects.filter(
            staff=staff, session_key=session_key, expires_at__gt=timezone.now(),
        ).first()
        if not session:
            raise exceptions.AuthenticationFailed("Support session has expired. Please sign in again.")
        now = timezone.now()
        if session.last_activity_at < now - timezone.timedelta(minutes=2):
            SupportSession.objects.filter(pk=session.pk).update(last_activity_at=now)
        return user, staff

    def authenticate(self, request):
        header = self.get_header(request)
        if header is None:
            return None
        raw_token = self.get_raw_token(header)
        if raw_token is None:
            return None
        validated_token = self.get_validated_token(raw_token)
        user, staff = self.get_user(validated_token)
        now = timezone.now()
        if not staff.last_seen_at or staff.last_seen_at < now - timezone.timedelta(minutes=2):
            SupportStaff.objects.filter(pk=staff.pk).update(last_seen_at=now)
            staff.last_seen_at = now
        request.user = user
        request.support_staff = staff
        return user, staff


def create_staff_session(staff):
    session = SupportSession.objects.create(
        staff=staff,
        session_key=str(uuid.uuid4()),
        expires_at=timezone.now() + timezone.timedelta(hours=12),
    )
    return session


def invalidate_staff_sessions(staff):
    SupportSession.objects.filter(staff=staff).delete()


def get_tokens_for_user(user):
    refresh = RefreshToken.for_user(user)
    return {
        "refresh": str(refresh),
        "access": str(refresh.access_token),
    }
