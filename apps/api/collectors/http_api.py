from __future__ import annotations

import asyncio
import json
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from .base import SourceAdapter


class HttpApiAdapter(SourceAdapter):
    """Generic JSON adapter for sources that expose direct API endpoints."""

    async def fetch_catalog(self) -> list[dict]:
        return await self._fetch_endpoint("catalog_endpoint")

    async def fetch_prices(self) -> list[dict]:
        return await self._fetch_endpoint("prices_endpoint")

    async def fetch_reviews(self) -> list[dict]:
        return await self._fetch_endpoint("reviews_endpoint")

    async def _fetch_endpoint(self, field: str) -> list[dict]:
        endpoint = self.source.provider_config.get(field)
        if not endpoint:
            return []

        headers = {"User-Agent": "DispensaryAggregatorBot/0.3"}
        token = self.source.provider_config.get("api_token")
        if token:
            headers["Authorization"] = f"Bearer {token}"

        def _read() -> list[dict]:
            req = Request(endpoint, headers=headers)
            try:
                with urlopen(req, timeout=20) as response:
                    payload = json.loads(response.read().decode("utf-8"))
            except (HTTPError, URLError, TimeoutError, json.JSONDecodeError):
                return []
            if isinstance(payload, list):
                return payload
            if isinstance(payload, dict):
                for key in ("items", "results", "data"):
                    if isinstance(payload.get(key), list):
                        return payload[key]
            return []

        return await asyncio.to_thread(_read)
