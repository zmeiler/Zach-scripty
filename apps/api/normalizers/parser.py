from __future__ import annotations

from datetime import datetime, timezone

from packages.shared.contracts import DispensarySource, Product, PricePoint, Review


def normalize_product(source: DispensarySource, raw_product: dict, in_stock: bool) -> Product:
    return Product(
        id=f"{source.id}:{raw_product['source_product_id']}",
        source_id=source.id,
        source_product_id=raw_product["source_product_id"],
        name=raw_product["name"],
        brand=raw_product.get("brand"),
        category=raw_product.get("category"),
        in_stock=in_stock,
        normalized_at=datetime.now(timezone.utc),
    )


def normalize_price(source: DispensarySource, product_id: str, raw_price: dict) -> PricePoint:
    return PricePoint(
        product_id=product_id,
        source_id=source.id,
        amount=float(raw_price["amount"]),
        currency=raw_price.get("currency", "USD"),
        observed_at=datetime.fromisoformat(raw_price["observed_at"]),
    )


def normalize_review(source: DispensarySource, product_id: str, raw_review: dict) -> Review:
    return Review(
        id=str(raw_review["id"]),
        product_id=product_id,
        source_id=source.id,
        rating=float(raw_review["rating"]),
        title=raw_review["title"],
        body=raw_review["body"],
        author=raw_review.get("author"),
        observed_at=datetime.fromisoformat(raw_review["observed_at"]),
    )
