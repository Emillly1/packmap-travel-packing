#!/usr/bin/env python3
"""Convert PackMap JSON into indented PackMap import text."""

from __future__ import annotations

import argparse
import json
from datetime import datetime
from pathlib import Path
from typing import Any


def item_label(node: dict[str, Any]) -> str:
    packed = "已装" if node.get("packed") else "未装"
    name = str(node.get("name", "Unnamed item"))
    quantity = str(node.get("quantity", "")).strip()
    if quantity:
        name = f"{name} · {quantity}"
    transport = node.get("transport_rule") or node.get("transport") or "none"
    suffix = ""
    if transport in {"carry_on", "carry-on"}:
        suffix = "（必须随身）"
    elif transport == "checked":
        suffix = "（必须托运）"
    return f"[{packed}] {name}{suffix}"


def append_node(lines: list[str], node: dict[str, Any], depth: int) -> None:
    prefix = "  " * depth
    node_type = node.get("type")
    if node_type == "item":
        lines.append(f"{prefix}{item_label(node)}")
        return

    lines.append(f"{prefix}{node.get('name', 'Unnamed')}")
    for child in node.get("children", []) or []:
        append_node(lines, child, depth + 1)


def validate(data: dict[str, Any]) -> None:
    if not isinstance(data, dict):
        raise ValueError("PackMap input must be a JSON object")
    containers = data.get("containers")
    if not isinstance(containers, list) or not containers:
        raise ValueError("PackMap input must contain a non-empty containers list")

    valid_types = {"luggage", "compartment", "bag", "item"}
    valid_transport = {None, "", "none", "carry_on", "carry-on", "checked"}
    seen_ids: set[str] = set()

    def validate_node(node: Any, path: str) -> None:
        if not isinstance(node, dict):
            raise ValueError(f"{path} must be an object")
        node_id = node.get("id")
        if not isinstance(node_id, str) or not node_id:
            raise ValueError(f"{path} must have a non-empty id")
        if node_id in seen_ids:
            raise ValueError(f"Duplicate node id: {node_id}")
        seen_ids.add(node_id)
        if node.get("type") not in valid_types:
            raise ValueError(f"{path} has an invalid type")
        if not isinstance(node.get("name"), str) or not node["name"].strip():
            raise ValueError(f"{path} must have a non-empty name")
        children = node.get("children", []) or []
        if node["type"] == "item" and children:
            raise ValueError(f"Item {node_id} cannot contain children")
        if node["type"] == "item" and node.get("transport_rule") not in valid_transport:
            raise ValueError(f"Item {node_id} has an invalid transport_rule")
        if node["type"] == "luggage" and node.get("transport") not in valid_transport:
            raise ValueError(f"Luggage {node_id} has an invalid transport")
        if not isinstance(children, list):
            raise ValueError(f"{path}.children must be a list")
        for index, child in enumerate(children):
            validate_node(child, f"{path}.children[{index}]")

    for index, container in enumerate(containers):
        if not isinstance(container, dict) or container.get("type") != "luggage":
            raise ValueError(f"containers[{index}] must be a luggage node")
        validate_node(container, f"containers[{index}]")


def convert(data: dict[str, Any], timestamp: str | None = None) -> str:
    validate(data)
    if timestamp is None:
        now = datetime.now()
        timestamp = f"{now.year}/{now.month}/{now.day} {now:%H:%M:%S}"
    lines = ["PackMap 行李位置地图", f"导出时间：{timestamp}", ""]
    for container in data.get("containers", []) or []:
        append_node(lines, container, 0)
    return "\n".join(lines)


def main() -> None:
    parser = argparse.ArgumentParser(description="Convert PackMap JSON to import text.")
    parser.add_argument("input", help="Path to PackMap JSON file")
    parser.add_argument("-o", "--output", help="Optional output text file")
    parser.add_argument("--timestamp", help="Optional fixed export timestamp for reproducible output")
    args = parser.parse_args()

    data = json.loads(Path(args.input).read_text(encoding="utf-8"))
    text = convert(data, args.timestamp)
    if args.output:
        Path(args.output).write_text(text, encoding="utf-8")
    else:
        print(text)


if __name__ == "__main__":
    main()
