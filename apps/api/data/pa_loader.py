from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from packages.shared.contracts import DispensarySource


def _slug(value: str) -> str:
    return "".join(ch.lower() if ch.isalnum() else "-" for ch in value).strip("-").replace("--", "-")


def load_pa_medical_dispensaries(path: Path) -> list[dict[str, Any]]:
    with path.open("r", encoding="utf-8") as file:
        return json.load(file)


def load_provider_overrides(path: Path) -> dict[str, dict[str, Any]]:
    if not path.exists():
        return {}
    with path.open("r", encoding="utf-8") as file:
        payload = json.load(file)
    return payload if isinstance(payload, dict) else {}


def source_id_for(record: dict[str, Any]) -> str:
    permittee = record["permittee"]
    location_name = record["location_name"]
    city = record["city"]
    return f"pa-{_slug(permittee)}-{_slug(location_name)}-{_slug(city)}"


def build_sources_from_pa_data(
    records: list[dict[str, Any]],
    crawl_interval_seconds: int = 30,
    provider_overrides: dict[str, dict[str, Any]] | None = None,
) -> list[DispensarySource]:
    provider_overrides = provider_overrides or {}
    sources: list[DispensarySource] = []
    for record in records:
        source_id = source_id_for(record)
        override = provider_overrides.get(source_id, {})
        sources.append(
            DispensarySource(
                id=source_id,
                name=f"{record['permittee']} - {record['location_name']}, {record['city']}",
                base_url=record["website"],
                crawl_interval_seconds=int(override.get("crawl_interval_seconds", crawl_interval_seconds)),
                robots_mode=override.get("robots_mode", "respect"),
                provider=override.get("provider", "mock"),
                provider_config=override.get("provider_config", {}),
            )
        )
    return sources
