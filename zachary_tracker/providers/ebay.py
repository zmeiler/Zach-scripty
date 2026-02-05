from __future__ import annotations

from datetime import datetime, timedelta
from random import random

from zachary_tracker.models import TrackingItem
from zachary_tracker.providers.base import Provider


class EbayProvider(Provider):
    name = "ebay"

    def fetch_update(self, item: TrackingItem):
        status = item.current_status
        if random() > 0.5:
            status = self.next_status(status)
        eta = item.eta or (datetime.now() + timedelta(days=5)).strftime("%Y-%m-%d")
        location = item.last_location or "Seller Warehouse"
        if status == "in_transit":
            location = "USPS Network"
        elif status == "out_for_delivery":
            location = "Carrier Vehicle"
        elif status == "delivered":
            location = "Delivered to mailbox"
        return self.mk_update(
            item,
            status=status,
            message=self.default_message(status, item.label),
            location=location,
            eta=eta,
        )
