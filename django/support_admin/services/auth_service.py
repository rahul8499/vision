from django.contrib.auth import get_user_model
from django.utils import timezone
from django.conf import settings
from rest_framework_simplejwt.tokens import RefreshToken, TokenError
from ..models import SupportStaff, SupportSession
from ..authentication import create_staff_session, invalidate_staff_sessions
from ..serializers import SupportStaffSerializer
from ..selectors.staff_selectors import get_staff_by_id, get_staff_by_employee_id

User = get_user_model()


def login_staff(email, password, ip_address=None, user_agent=None):
    try:
        user = User.objects.get(email=email, is_active=True)
    except User.DoesNotExist:
        raise ValueError("Invalid credentials.")

    if not user.check_password(password):
        raise ValueError("Invalid credentials.")

    try:
        staff = SupportStaff.objects.select_related("user").get(user=user, is_active=True)
    except SupportStaff.DoesNotExist:
        raise ValueError("Invalid credentials.")

    invalidate_staff_sessions(staff)
    tokens = RefreshToken.for_user(user)
    session = create_staff_session(staff)

    return {
        "access": str(tokens.access_token),
        "refresh": str(tokens),
        "staff": SupportStaffSerializer(staff).data,
        "session_key": session.session_key,
    }


def refresh_staff_token(refresh_token_str):
    try:
        refresh = RefreshToken(refresh_token_str)
        user_id = refresh["user_id"]
        user = User.objects.get(id=user_id, is_active=True)
        staff = SupportStaff.objects.select_related("user").get(user=user, is_active=True)
    except (TokenError, User.DoesNotExist, SupportStaff.DoesNotExist):
        raise ValueError("Invalid or expired refresh token.")

    new_tokens = RefreshToken.for_user(user)
    return {
        "access": str(new_tokens.access_token),
        "refresh": str(new_tokens),
    }


def logout_staff(staff, refresh_token_str=None):
    invalidate_staff_sessions(staff)
    if refresh_token_str:
        try:
            token = RefreshToken(refresh_token_str)
            token.blacklist()
        except TokenError:
            pass


def get_staff_profile(staff):
    return SupportStaffSerializer(staff).data


def change_staff_password(staff, old_password, new_password):
    user = staff.user
    if not user.check_password(old_password):
        raise ValueError("Current password is incorrect.")
    user.password = new_password
    user.save()
    invalidate_staff_sessions(staff)
