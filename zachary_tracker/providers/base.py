from __future__ import annotations

from abc import ABC, abstractmethod
from datetime import datetime

from zachary_tracker.models import TrackingItem, TrackingUpdate


STATUS_FLOW = [
    "created",
    "ordered",
    "shipped",
    "in_transit",
    "out_for_delivery",
    "delivered",
]


class Provider(ABC):
    name: str

    @abstractmethod
    def fetch_update(self, item: TrackingItem) -> TrackingUpdate:
        raise NotImplementedError

    def next_status(self, current_status: str) -> str:
        try:
            idx = STATUS_FLOW.index(current_status)
        except ValueError:
            idx = 0
        return STATUS_FLOW[min(idx + 1, len(STATUS_FLOW) - 1)]

    def default_message(self, status: str, label: str) -> str:
        return f"{label} is now {status.replace('_', ' ')}"

    def mk_update(
        self,
        item: TrackingItem,
        status: str,
        message: str,
        location: str = "",
        eta: str = "",
    ) -> TrackingUpdate:
        return TrackingUpdate(
            item_id=item.item_id,
            provider=item.provider,
            status=status,
            message=message,
            eta=eta,
            location=location,
            updated_at=datetime.now(),
        )
