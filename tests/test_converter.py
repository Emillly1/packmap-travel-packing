import importlib.util
import json
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "skills" / "packmap-travel-packing" / "scripts" / "packmap_json_to_text.py"
EXAMPLE = ROOT / "examples" / "long-trip-study-exchange.json"

spec = importlib.util.spec_from_file_location("packmap_converter", SCRIPT)
converter = importlib.util.module_from_spec(spec)
assert spec.loader is not None
spec.loader.exec_module(converter)


class ConverterTests(unittest.TestCase):
    def test_long_trip_example_converts_to_importable_text(self):
        data = json.loads(EXAMPLE.read_text(encoding="utf-8"))
        output = converter.convert(data, "2026/7/1 08:00:00")

        self.assertTrue(output.startswith("PackMap 行李位置地图\n"))
        self.assertIn("Checked suitcase A - first stage", output)
        self.assertIn("[未装] Passport and required visas（必须随身）", output)
        self.assertIn("[未装] Power bank（必须随身）", output)
        self.assertNotIn("Six-month multi-city study trip\n", output)

    def test_duplicate_ids_are_rejected(self):
        data = {
            "containers": [
                {
                    "id": "bag",
                    "type": "luggage",
                    "name": "Bag",
                    "children": [
                        {"id": "bag", "type": "item", "name": "Duplicate"}
                    ],
                }
            ]
        }

        with self.assertRaisesRegex(ValueError, "Duplicate node id"):
            converter.convert(data)

    def test_output_can_be_written_as_utf8(self):
        data = json.loads(EXAMPLE.read_text(encoding="utf-8"))
        output = converter.convert(data, "2026/7/1 08:00:00")
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "packmap.txt"
            path.write_text(output, encoding="utf-8")
            self.assertEqual(path.read_text(encoding="utf-8"), output)


if __name__ == "__main__":
    unittest.main()
