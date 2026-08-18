import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / "web" / "index.html"


class WebContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.html = WEB.read_text(encoding="utf-8")

    def test_json_and_txt_auto_detection_exists(self):
        self.assertIn("function parseImportJson(raw)", self.html)
        self.assertIn("function parseImportText(raw)", self.html)
        self.assertIn('trimmed.startsWith("{")', self.html)

    def test_lossless_json_fields_are_mapped(self):
        for field in ["quantity", "stage_ids", "recommendation", "reason", "departure_checks", "warnings"]:
            with self.subTest(field=field):
                self.assertIn(field, self.html)

    def test_json_round_trip_export_exists(self):
        self.assertIn("function buildExportJson()", self.html)
        self.assertIn("function downloadExportJson()", self.html)
        self.assertIn('schema_version: "1.0"', self.html)
        self.assertIn("document.body.appendChild(link);", self.html)
        self.assertIn("setTimeout(() => URL.revokeObjectURL(url), 0);", self.html)

    def test_transport_uses_luggage_metadata(self):
        self.assertIn("rootTransport", self.html)
        self.assertIn("inferRootTransport", self.html)
        self.assertIn("carry_on", self.html)

    def test_txt_import_clears_stale_trip_specific_state(self):
        self.assertIn('trip = { ...trip, stages: [], departureChecks: [], warnings: [] };', self.html)
        self.assertIn('departureChecks = {};', self.html)

    def test_tactile_drag_supports_pointer_and_touch_input(self):
        for contract in [
            '.drag-ghost',
            'handle.addEventListener("pointerdown"',
            'handle.setPointerCapture(event.pointerId)',
            'document.elementFromPoint(event.clientX, event.clientY)',
        ]:
            with self.subTest(contract=contract):
                self.assertIn(contract, self.html)

    def test_motion_is_accessible_and_intentional(self):
        self.assertIn('@media (prefers-reduced-motion: reduce)', self.html)
        self.assertIn('--ease-out: cubic-bezier(.23, 1, .32, 1);', self.html)
        self.assertNotIn('transition: all', self.html)

    def test_status_feedback_is_announced(self):
        self.assertIn('role="status" aria-live="polite"', self.html)


if __name__ == "__main__":
    unittest.main()
