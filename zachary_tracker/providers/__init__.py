from zachary_tracker.providers.amazon import AmazonProvider
from zachary_tracker.providers.base import Provider
from zachary_tracker.providers.ebay import EbayProvider
from zachary_tracker.providers.generic_site import GenericSiteProvider


def get_provider(name: str) -> Provider:
    key = name.lower()
    if key == "amazon":
        return AmazonProvider()
    if key == "ebay":
        return EbayProvider()
    return GenericSiteProvider()
