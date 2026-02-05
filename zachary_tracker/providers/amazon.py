from __future__ import annotations

from datetime import datetime, timedelta
from random import random

from zachary_tracker.models import TrackingItem
from zachary_tracker.providers.base import Provider


class AmazonProvider(Provider):
    name = "amazon"

    def fetch_update(self, item: TrackingItem):
        status = item.current_status
        if random() > 0.55:
            status = self.next_status(status)
        eta = item.eta or (datetime.now() + timedelta(days=3)).strftime("%Y-%m-%d")
        location = item.last_location or "Amazon Fulfillment Center"
        if status == "in_transit":
            location = "Regional Carrier Hub"
        elif status == "out_for_delivery":
            location = "Local Delivery Route"
        elif status == "delivered":
            location = "Delivered at front door"
        return self.mk_update(
            item,
            status=status,
            message=self.default_message(status, item.label),
            location=location,
            eta=eta,
        )
