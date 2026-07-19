from types import SimpleNamespace
from unittest.mock import Mock, patch

from django.test import SimpleTestCase, TestCase

from support_admin.permissions import CanManageStaff, CanProcessRefund, IsSupportSupervisor
from support_admin.services.refund_service import review_refund


class RefundMakerCheckerTests(TestCase):
    @patch("support_admin.services.refund_service.get_refund_by_id")
    def test_approver_cannot_process_same_refund(self, get_refund):
        refund = SimpleNamespace(id=1, status="approved", reviewed_by_id=7, save=Mock())
        get_refund.return_value = refund
        with self.assertRaisesMessage(ValueError, "different admin"):
            review_refund(1, "process", SimpleNamespace(id=7))
        refund.save.assert_not_called()

    @patch("support_admin.services.refund_service.get_refund_by_id")
    def test_different_admin_can_record_processed_refund(self, get_refund):
        refund = SimpleNamespace(id=1, status="approved", reviewed_by_id=7, save=Mock(), payment_reference="", processed_at=None)
        get_refund.return_value = refund
        processor = SimpleNamespace(id=8)
        result = review_refund(1, "process", processor, payment_reference="rfnd_123")
        self.assertEqual(result.status, "processed")
        self.assertEqual(result.payment_reference, "rfnd_123")
        self.assertEqual(result.reviewed_by, processor)
        refund.save.assert_called_once()


class RolePermissionTests(SimpleTestCase):
    def request(self, role, active=True):
        return SimpleNamespace(support_staff=SimpleNamespace(role=role, is_active=active))

    def test_only_admin_can_manage_staff_and_process_refund(self):
        for role in ("agent", "supervisor"):
            self.assertFalse(CanManageStaff().has_permission(self.request(role), None))
            self.assertFalse(CanProcessRefund().has_permission(self.request(role), None))
        self.assertTrue(CanManageStaff().has_permission(self.request("admin"), None))
        self.assertTrue(CanProcessRefund().has_permission(self.request("admin"), None))

    def test_inactive_admin_has_no_permission(self):
        self.assertFalse(CanManageStaff().has_permission(self.request("admin", active=False), None))

    def test_user_and_store_lookup_roles_match_supervisor_permission(self):
        self.assertFalse(IsSupportSupervisor().has_permission(self.request("agent"), None))
        self.assertTrue(IsSupportSupervisor().has_permission(self.request("supervisor"), None))
        self.assertTrue(IsSupportSupervisor().has_permission(self.request("admin"), None))
