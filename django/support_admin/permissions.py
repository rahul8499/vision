from rest_framework import permissions


class IsSupportStaff(permissions.BasePermission):
    def has_permission(self, request, view):
        return bool(getattr(request, "support_staff", None) and request.support_staff.is_active)


class IsSupportAgent(permissions.BasePermission):
    def has_permission(self, request, view):
        staff = getattr(request, "support_staff", None)
        return bool(staff and staff.is_active and staff.role in ("agent", "supervisor", "admin"))


class IsSupportSupervisor(permissions.BasePermission):
    def has_permission(self, request, view):
        staff = getattr(request, "support_staff", None)
        return bool(staff and staff.is_active and staff.role in ("supervisor", "admin"))


class IsSupportAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        staff = getattr(request, "support_staff", None)
        return bool(staff and staff.is_active and staff.role == "admin")


class CanApproveRefund(permissions.BasePermission):
    def has_permission(self, request, view):
        staff = getattr(request, "support_staff", None)
        return bool(staff and staff.is_active and staff.role in ("supervisor", "admin"))


class CanProcessRefund(permissions.BasePermission):
    def has_permission(self, request, view):
        staff = getattr(request, "support_staff", None)
        return bool(staff and staff.is_active and staff.role == "admin")


class CanManageStaff(permissions.BasePermission):
    def has_permission(self, request, view):
        staff = getattr(request, "support_staff", None)
        return bool(staff and staff.is_active and staff.role == "admin")


class CanBulkAssign(permissions.BasePermission):
    def has_permission(self, request, view):
        staff = getattr(request, "support_staff", None)
        return bool(staff and staff.is_active and staff.role in ("supervisor", "admin"))


class CanViewAuditLogs(permissions.BasePermission):
    def has_permission(self, request, view):
        staff = getattr(request, "support_staff", None)
        return bool(staff and staff.is_active and staff.role in ("supervisor", "admin"))
