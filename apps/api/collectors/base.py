from __future__ import annotations

from abc import ABC, abstractmethod

from packages.shared.contracts import DispensarySource


class SourceAdapter(ABC):
    """Common interface for all source connectors."""

    def __init__(self, source: DispensarySource) -> None:
        self.source = source

    @abstractmethod
    async def fetch_catalog(self) -> list[dict]:
        """Return source-specific product catalog payload."""

    @abstractmethod
    async def fetch_prices(self) -> list[dict]:
        """Return source-specific product price payload."""

    @abstractmethod
    async def fetch_reviews(self) -> list[dict]:
        """Return source-specific product review payload."""
