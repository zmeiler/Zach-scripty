from __future__ import annotations

import json
from dataclasses import asdict
from pathlib import Path
from typing import Any

from zachary_tracker.models import TrackingItem

DATA_DIR = Path.home() / ".zachary_tracker"
CONFIG_FILE = DATA_DIR / "config.json"

DEFAULT_CONFIG: dict[str, Any] = {
    "profile": {
        "name": "Zachary Meiler",
        "address_line1": "23 bloomingdale ct",
        "city": "york",
        "state": "pa",
        "zip_plus4": "17402-2606",
    },
    "refresh_seconds": 3,
    "items": [
        {
            "item_id": "AMZ-001",
            "provider": "amazon",
            "label": "Amazon Package",
            "current_status": "ordered",
            "eta": "",
            "last_location": "",
            "url": "",
        },
        {
            "item_id": "EBY-001",
            "provider": "ebay",
            "label": "eBay Package",
            "current_status": "ordered",
            "eta": "",
            "last_location": "",
            "url": "",
        },
    ],
}


def ensure_config() -> dict[str, Any]:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    if not CONFIG_FILE.exists():
        save_config(DEFAULT_CONFIG)
        return DEFAULT_CONFIG
    return load_config()


def load_config() -> dict[str, Any]:
    return json.loads(CONFIG_FILE.read_text())


def save_config(config: dict[str, Any]) -> None:
    CONFIG_FILE.write_text(json.dumps(config, indent=2))


def load_items(config: dict[str, Any]) -> list[TrackingItem]:
    return [TrackingItem(**item) for item in config.get("items", [])]


def add_item(config: dict[str, Any], item: TrackingItem) -> dict[str, Any]:
    config.setdefault("items", []).append(asdict(item))
    return config
