from __future__ import annotations

import random
from datetime import datetime, timezone

from packages.shared.contracts import DispensarySource

from .base import SourceAdapter


class MockDispensaryAdapter(SourceAdapter):
    """Reference adapter used to validate the ingestion and streaming pipeline."""

    def __init__(self, source: DispensarySource) -> None:
        super().__init__(source)
        self._products = [
            {"source_product_id": "flower-001", "name": "Blue Dream 3.5g", "brand": "North Farm", "category": "Flower"},
            {"source_product_id": "vape-002", "name": "Pineapple Express Cart", "brand": "Sky Labs", "category": "Vape"},
            {"source_product_id": "gummy-003", "name": "Mango Gummies 100mg", "brand": "Happy Leaf", "category": "Edible"},
        ]

    async def fetch_catalog(self) -> list[dict]:
        return self._products

    async def fetch_prices(self) -> list[dict]:
        prices: list[dict] = []
        for product in self._products:
            prices.append(
                {
                    "source_product_id": product["source_product_id"],
                    "amount": round(random.uniform(18, 65), 2),
                    "currency": "USD",
                    "observed_at": datetime.now(timezone.utc).isoformat(),
                    "in_stock": random.random() > 0.2,
                }
            )
        return prices

    async def fetch_reviews(self) -> list[dict]:
        snippets = ["Great effects and flavor.", "Solid value for the price.", "Would buy again."]
        reviews: list[dict] = []
        for product in self._products:
            reviews.append(
                {
                    "source_product_id": product["source_product_id"],
                    "id": f"{product['source_product_id']}-{int(datetime.now(timezone.utc).timestamp())}",
                    "rating": round(random.uniform(3.5, 5.0), 1),
                    "title": "Live feedback",
                    "body": random.choice(snippets),
                    "author": "anonymous",
                    "observed_at": datetime.now(timezone.utc).isoformat(),
                }
            )
        return reviews
