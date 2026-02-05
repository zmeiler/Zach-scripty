from __future__ import annotations

from datetime import datetime, timedelta
from random import random

from zachary_tracker.models import TrackingItem
from zachary_tracker.providers.base import Provider


class GenericSiteProvider(Provider):
    name = "generic"

    def fetch_update(self, item: TrackingItem):
        status = item.current_status
        if random() > 0.65:
            status = self.next_status(status)
        eta = item.eta or (datetime.now() + timedelta(days=7)).strftime("%Y-%m-%d")
        location = item.last_location or "Tracking via website feed"
        return self.mk_update(
            item,
            status=status,
            message=f"{item.label} update from {item.provider}",
            location=location,
            eta=eta,
        )
