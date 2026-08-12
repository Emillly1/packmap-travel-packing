import importlib.util
import json
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "skills" / "packmap-travel-packing" / "scripts" / "packmap_json_to_text.py"
EXAMPLE = ROOT / "examples" / "long-trip-study-exchange.json"
EXAMPLE_FILES = sorted((ROOT / "examples").glob("*.json"))

spec = importlib.util.spec_from_file_location("packmap_converter", SCRIPT)
converter = importlib.util.module_from_spec(spec)
assert spec.loader is not None
spec.loader.exec_module(converter)


class ConverterTests(unittest.TestCase):
    def test_all_examples_validate_and_convert(self):
        self.assertGreaterEqual(len(EXAMPLE_FILES), 4)
        for path in EXAMPLE_FILES:
            with self.subTest(example=path.name):
                data = json.loads(path.read_text(encoding="utf-8"))
                expected_text = path.with_suffix(".txt").read_text(encoding="utf-8")
                exported_at = expected_text.splitlines()[1].split("：", 1)[1]
                self.assertEqual(data.get("schema_version"), "1.0")
                output = converter.convert(data, exported_at)
                converter.validate(data)
                self.assertEqual(output, expected_text)
                item_count = output.count("[已装]") + output.count("[未装]")

                def count_items(nodes):
                    return sum(
                        (1 if node.get("type") == "item" else 0)
                        + count_items(node.get("children", []) or [])
                        for node in nodes
                    )

                self.assertEqual(item_count, count_items(data["containers"]))
                for container in data["containers"]:
                    self.assertIn(container["name"], output)

    def test_long_trip_example_converts_to_importable_text(self):
        data = json.loads(EXAMPLE.read_text(encoding="utf-8"))
        output = converter.convert(data, "2026/7/1 08:00:00")

        self.assertTrue(output.startswith("PackMap 行李位置地图\n"))
        self.assertIn("Checked suitcase A - first stage", output)
        self.assertIn("[未装] Passport and required visas · 1 set（必须随身）", output)
        self.assertIn("[未装] Power bank · 1（必须随身）", output)
        self.assertIn("[未装] Short-sleeve tops · 7", output)
        self.assertNotIn("Six-month multi-city study trip\n", output)

    def test_quantities_and_transport_survive_txt_conversion(self):
        data = {
            "schema_version": "1.0",
            "containers": [
                {
                    "id": "cabin-bag",
                    "type": "luggage",
                    "name": "Cabin bag",
                    "transport": "carry_on",
                    "children": [
                        {
                            "id": "main-pocket",
                            "type": "compartment",
                            "name": "Main pocket",
                            "children": [
                                {
                                    "id": "power-bank",
                                    "type": "item",
                                    "name": "Power bank",
                                    "quantity": "1 shared",
                                    "packed": False,
                                    "transport_rule": "carry_on"
                                }
                            ]
                        }
                    ]
                }
            ]
        }

        output = converter.convert(data, "2026/7/1 08:00:00")
        self.assertIn("[未装] Power bank · 1 shared（必须随身）", output)

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

    def test_top_level_container_must_be_luggage(self):
        data = {
            "containers": [
                {"id": "wrong-root", "type": "compartment", "name": "Wrong root"}
            ]
        }
        with self.assertRaisesRegex(ValueError, "must be a luggage node"):
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
