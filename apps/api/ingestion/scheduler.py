from __future__ import annotations

import asyncio
from datetime import datetime, timezone

from packages.shared.contracts import DispensarySource, IngestionEvent

from apps.api.collectors.http_api import HttpApiAdapter
from apps.api.collectors.mock_source import MockDispensaryAdapter
from apps.api.normalizers.parser import normalize_price, normalize_product, normalize_review
from apps.api.realtime.broker import EventBroker
from apps.api.storage.repository import Repository


class IngestionScheduler:
    def __init__(self, repository: Repository, broker: EventBroker, sources: list[DispensarySource]) -> None:
        self.repository = repository
        self.broker = broker
        self.sources = sources
        self._running = False
        self._tasks: list[asyncio.Task] = []

    async def start(self) -> None:
        self._running = True
        for source in self.sources:
            task = asyncio.create_task(self._run_source_loop(source))
            self._tasks.append(task)

    async def stop(self) -> None:
        self._running = False
        for task in self._tasks:
            task.cancel()
        self._tasks.clear()

    async def _run_source_loop(self, source: DispensarySource) -> None:
        adapter = self._build_adapter(source)
        while self._running:
            await self._ingest_once(source, adapter)
            await asyncio.sleep(source.crawl_interval_seconds)

    def _build_adapter(self, source: DispensarySource):
        if source.provider == "mock":
            return MockDispensaryAdapter(source)
        return HttpApiAdapter(source)

    async def _ingest_once(self, source: DispensarySource, adapter) -> None:
        catalog = await adapter.fetch_catalog()
        prices = await adapter.fetch_prices()
        reviews = await adapter.fetch_reviews()

        if not catalog:
            await self.broker.publish(
                {
                    "type": "heartbeat",
                    "source_id": source.id,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "message": "No catalog data returned yet",
                }
            )
            return

        prices_by_product = {item["source_product_id"]: item for item in prices if "source_product_id" in item}
        reviews_by_product = {item["source_product_id"]: item for item in reviews if "source_product_id" in item}

        for raw_product in catalog:
            source_product_id = raw_product.get("source_product_id")
            if not source_product_id:
                continue

            raw_price = prices_by_product.get(source_product_id)
            raw_review = reviews_by_product.get(source_product_id)
            if not raw_price or not raw_review:
                continue

            product_id = f"{source.id}:{source_product_id}"
            if self.repository.is_duplicate(source.id, product_id, float(raw_price["amount"]), raw_price["observed_at"]):
                continue

            product = normalize_product(source, raw_product, in_stock=bool(raw_price.get("in_stock", True)))
            price = normalize_price(source, product_id, raw_price)
            review = normalize_review(source, product_id, raw_review)

            payload = {
                "source": source.model_dump(),
                "raw_product": raw_product,
                "raw_price": raw_price,
                "raw_review": raw_review,
                "ingested_at": datetime.now(timezone.utc).isoformat(),
                "parse_status": "ok",
            }

            event = IngestionEvent(
                source=source,
                product=product,
                price=price,
                review=review,
                raw_payload=payload,
            )
            self.repository.save(event)
            await self.broker.publish(
                {
                    "type": "price_update",
                    "product": product.model_dump(mode="json"),
                    "price": price.model_dump(mode="json"),
                    "review": review.model_dump(mode="json"),
                }
            )
