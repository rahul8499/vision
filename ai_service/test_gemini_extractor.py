import unittest
from unittest.mock import Mock, patch

import gemini_extractor


class GeminiExtractorTests(unittest.TestCase):
    def test_normalizes_structured_medicines(self):
        result = gemini_extractor._normalize({
            "prescription_readable": True,
            "review_reason": "Verify handwriting",
            "medicines": [{
                "medicine_name": "Dolo",
                "strength": "650 mg",
                "dosage": "1 tablet",
                "frequency": "twice daily",
                "duration": "3 days",
                "raw_text": "Tab Dolo 650 mg",
                "confidence": 0.82,
            }],
        })
        self.assertEqual(result["ocr_engine"], "gemini")
        self.assertEqual(result["extracted_medicines"][0]["suggested_name"], "Dolo 650 mg")
        self.assertTrue(result["extracted_medicines"][0]["needs_verification"])

    def test_does_not_repeat_strength_already_in_name(self):
        result = gemini_extractor._normalize({
            "prescription_readable": True,
            "review_reason": "",
            "medicines": [{
                "medicine_name": "5% Dextrose", "strength": "5%", "dosage": "1",
                "frequency": "stat", "duration": "", "raw_text": "5% Dextrose IV stat",
                "confidence": 0.95,
            }],
        })
        self.assertEqual(result["extracted_medicines"][0]["suggested_name"], "5% Dextrose")

    def test_prepares_multiple_gemini_variants(self):
        variants = gemini_extractor._prepare_gemini_variants("test.jpg")
        self.assertGreaterEqual(len(variants), 2)
        names = [name for name, _ in variants]
        self.assertIn("original", names)
        self.assertIn("sharpened_contrast", names)

    @patch.dict("os.environ", {}, clear=True)
    def test_missing_key_uses_fallback(self):
        self.assertIsNone(gemini_extractor.extract_with_gemini("unused.jpg"))

    @patch("gemini_extractor.requests.post")
    @patch.dict("os.environ", {"GEMINI_API_KEY": "test-key"}, clear=True)
    def test_network_failure_uses_fallback(self, post):
        post.side_effect = gemini_extractor.requests.Timeout("timeout")
        with patch("builtins.open", unittest.mock.mock_open(read_data=b"image")):
            self.assertIsNone(gemini_extractor.extract_with_gemini("test.jpg"))


if __name__ == "__main__":
    unittest.main()
