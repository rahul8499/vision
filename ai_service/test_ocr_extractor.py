import unittest
from unittest.mock import patch

import ocr_extractor


class FakeResult:
    def __init__(self, texts, scores):
        self.txts = tuple(texts)
        self.scores = tuple(scores)


class OcrExtractorTests(unittest.TestCase):
    def test_extracts_conservative_medicine_suggestions(self):
        result = FakeResult(
            [
                "Patient: Rahul",
                "Tab Augmentin 625 mg 1-0-1 after food",
                "Cap Pan 40 mg OD",
                "Date 12/07/2026",
                "1-0-1",
            ],
            [0.99, 0.91, 0.82, 0.98, 0.88],
        )

        with patch.object(ocr_extractor, "_get_engine", return_value=lambda *args, **kwargs: result):
            output = ocr_extractor.extract_prescription_text("unused.jpg")

        self.assertEqual(output["ocr_engine"], "rapidocr")
        self.assertEqual(
            [item["suggested_name"] for item in output["extracted_medicines"]],
            ["Augmentin 625 mg", "Pan 40 mg"],
        )
        self.assertTrue(all(item["needs_verification"] for item in output["extracted_medicines"]))

    def test_deduplicates_equivalent_lines(self):
        result = FakeResult(["Tab Dolo-650 mg", "Dolo 650 mg"], [0.9, 0.8])

        with patch.object(ocr_extractor, "_get_engine", return_value=lambda *args, **kwargs: result):
            output = ocr_extractor.extract_prescription_text("unused.jpg")

        self.assertEqual(len(output["extracted_medicines"]), 1)

    def test_failure_returns_manual_fallback(self):
        with patch.object(ocr_extractor, "_get_engine", side_effect=RuntimeError("model error")):
            output = ocr_extractor.extract_prescription_text("unused.jpg")

        self.assertEqual(output["ocr_engine"], "failed")
        self.assertEqual(output["extracted_medicines"], [])
        self.assertEqual(output["ocr_text"], "")

    def test_accepts_explicit_medicine_without_strength(self):
        result = FakeResult(["Tab Crocin", "Patient Rahul"], [0.84, 0.98])
        with patch.object(ocr_extractor, "_get_engine", return_value=lambda *args, **kwargs: result):
            output = ocr_extractor.extract_prescription_text("unused.jpg")
        self.assertEqual(
            [item["suggested_name"] for item in output["extracted_medicines"]],
            ["Crocin"],
        )

    def test_rejects_prescription_metadata_dosage_and_totals(self):
        result = FakeResult(
            [
                "M.B.B.S., M.D. | Reg. No: 270988",
                "Mob. No: 8",
                "Timing: 09:00",
                "Temp (deg): 36, BP: 120/80 mmHg",
                "1 Morning, 1 Aft, 1 Eve, 1 Night",
                "(Tot:40 Tab)",
                "3) TAB. DEMO MEDICINE 3",
            ],
            [0.99] * 7,
        )
        with patch.object(ocr_extractor, "_get_engine", return_value=lambda *args, **kwargs: result):
            output = ocr_extractor.extract_prescription_text("unused.jpg")
        self.assertEqual(
            [item["suggested_name"] for item in output["extracted_medicines"]],
            ["DEMO MEDICINE 3"],
        )

    def test_accepts_ors_and_dextrose_lines(self):
        result = FakeResult(
            [
                "10 5% Dextrose (iv) stat.",
                "ORS 2 sachets.",
                "Patient Name: Rahul",
            ],
            [0.9, 0.96, 0.99],
        )
        with patch.object(ocr_extractor, "_get_engine", return_value=lambda *args, **kwargs: result):
            output = ocr_extractor.extract_prescription_text("unused.jpg")
        self.assertEqual(
            [item["suggested_name"] for item in output["extracted_medicines"]],
            ["10 5% Dextrose (iv)", "ORS 2 sachets"],
        )


if __name__ == "__main__":
    unittest.main()
