from __future__ import annotations

import json
from pathlib import Path

from packages.shared.contracts import IngestionEvent


class Repository:
    def __init__(self, data_dir: Path) -> None:
        self.data_dir = data_dir
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.raw_file = self.data_dir / "raw_records.jsonl"
        self.normalized_file = self.data_dir / "normalized_records.jsonl"
        self.events: list[IngestionEvent] = []
        self._seen_signatures: set[str] = set()

    def is_duplicate(self, source_id: str, product_id: str, amount: float, observed_at: str) -> bool:
        signature = f"{source_id}|{product_id}|{amount:.2f}|{observed_at}"
        if signature in self._seen_signatures:
            return True
        self._seen_signatures.add(signature)
        return False

    def save(self, event: IngestionEvent) -> None:
        self.events.append(event)
        with self.raw_file.open("a", encoding="utf-8") as raw:
            raw.write(json.dumps(event.raw_payload, default=str) + "\n")
        with self.normalized_file.open("a", encoding="utf-8") as normalized:
            normalized.write(event.model_dump_json() + "\n")

    def recent_events(self, limit: int = 100) -> list[IngestionEvent]:
        return self.events[-limit:]

    def source_health(self) -> list[dict]:
        health: dict[str, dict] = {}
        for event in self.events:
            health[event.source.id] = {
                "source_id": event.source.id,
                "source_name": event.source.name,
                "base_url": str(event.source.base_url),
                "crawl_interval_seconds": event.source.crawl_interval_seconds,
                "last_sync": event.price.observed_at.isoformat(),
            }
        return list(health.values())
