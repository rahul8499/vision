from types import SimpleNamespace
from unittest.mock import patch

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import SimpleTestCase, override_settings

from support_admin.views import _support_attachment


class SupportAttachmentSecurityTests(SimpleTestCase):
    @override_settings(SUPPORT_ATTACHMENT_MALWARE_SCAN_REQUIRED=False)
    @patch("support_admin.views.shutil.which", return_value=None)
    def test_rejects_file_whose_signature_does_not_match_mime_type(self, _which):
        upload = SimpleUploadedFile("fake.jpg", b"not-a-jpeg", content_type="image/jpeg")
        with self.assertRaisesMessage(ValueError, "does not match"):
            _support_attachment(SimpleNamespace(FILES={"attachment": upload}))

    @override_settings(SUPPORT_ATTACHMENT_MALWARE_SCAN_REQUIRED=True)
    @patch("support_admin.views.shutil.which", return_value=None)
    def test_production_fails_closed_when_scanner_is_unavailable(self, _which):
        upload = SimpleUploadedFile("safe.jpg", b"\xff\xd8\xff\xe0safe", content_type="image/jpeg")
        with self.assertRaisesMessage(ValueError, "scanning is temporarily unavailable"):
            _support_attachment(SimpleNamespace(FILES={"attachment": upload}))

    @override_settings(SUPPORT_ATTACHMENT_MALWARE_SCAN_REQUIRED=False)
    @patch("support_admin.views.shutil.which", return_value=None)
    def test_accepts_valid_signature_in_development(self, _which):
        upload = SimpleUploadedFile("safe.pdf", b"%PDF-1.7\ncontent", content_type="application/pdf")
        self.assertIs(_support_attachment(SimpleNamespace(FILES={"attachment": upload})), upload)
