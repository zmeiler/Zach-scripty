from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime


@dataclass
class TrackingItem:
    item_id: str
    provider: str
    label: str
    current_status: str = "created"
    eta: str = ""
    last_location: str = ""
    url: str = ""


@dataclass
class TrackingUpdate:
    item_id: str
    provider: str
    status: str
    message: str
    eta: str
    location: str
    updated_at: datetime
