from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field, HttpUrl


class DispensarySource(BaseModel):
    id: str
    name: str
    base_url: HttpUrl
    crawl_interval_seconds: int = Field(default=10, ge=1)
    robots_mode: Literal["respect", "ignore"] = "respect"
    provider: Literal["mock", "generic", "dutchie", "jane"] = "mock"
    provider_config: dict[str, Any] = Field(default_factory=dict)


class Product(BaseModel):
    id: str
    source_id: str
    source_product_id: str
    name: str
    brand: str | None = None
    category: str | None = None
    in_stock: bool = True
    normalized_at: datetime


class PricePoint(BaseModel):
    product_id: str
    source_id: str
    amount: float
    currency: str = "USD"
    observed_at: datetime


class Review(BaseModel):
    id: str
    product_id: str
    source_id: str
    rating: float = Field(ge=0, le=5)
    title: str
    body: str
    author: str | None = None
    observed_at: datetime


class PennsylvaniaMedicalDispensary(BaseModel):
    permittee: str
    location_name: str
    address: str
    city: str
    state: str
    zip: str
    website: HttpUrl


class IngestionEvent(BaseModel):
    source: DispensarySource
    product: Product
    price: PricePoint
    review: Review
    raw_payload: dict
