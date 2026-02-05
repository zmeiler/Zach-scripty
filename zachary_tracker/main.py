from __future__ import annotations

import argparse
import os
import sys
import time
from datetime import datetime

from zachary_tracker.models import TrackingItem
from zachary_tracker.providers import get_provider
from zachary_tracker.storage import add_item, ensure_config, load_config, load_items, save_config


def clear() -> None:
    os.system("cls" if os.name == "nt" else "clear")


def color_status(status: str) -> str:
    mapping = {
        "ordered": "\033[36m",
        "shipped": "\033[34m",
        "in_transit": "\033[33m",
        "out_for_delivery": "\033[35m",
        "delivered": "\033[32m",
    }
    default = "\033[0m"
    return f"{mapping.get(status, default)}{status}\033[0m"


def watch() -> None:
    config = ensure_config()
    refresh = int(config.get("refresh_seconds", 3))
    items = load_items(config)
    ticker_events: list[str] = []

    while True:
        clear()
        now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        print(f"ZACHARY TRACKER LIVE | {now} | refresh={refresh}s")
        print("=" * 100)
        print(f"{'PROVIDER':10} {'ID':12} {'LABEL':24} {'STATUS':20} {'ETA':12} LOCATION")
        print("-" * 100)

        for item in items:
            provider = get_provider(item.provider)
            update = provider.fetch_update(item)
            changed = update.status != item.current_status
            item.current_status = update.status
            item.eta = update.eta
            item.last_location = update.location
            if changed:
                event = (
                    f"{update.updated_at.strftime('%H:%M:%S')} {item.provider.upper()} {item.item_id} "
                    f"{update.status.upper()}"
                )
                ticker_events.append(event)
            print(
                f"{item.provider:10} {item.item_id:12} {item.label[:24]:24} {color_status(item.current_status):20} "
                f"{item.eta[:12]:12} {item.last_location}"
            )

        print("=" * 100)
        tape = "  |  ".join(ticker_events[-8:]) if ticker_events else "No status changes yet..."
        print(f"TICKER ▶ {tape}")

        config["items"] = [i.__dict__ for i in items]
        save_config(config)
        time.sleep(refresh)


def add(provider: str, item_id: str, label: str, url: str) -> None:
    config = ensure_config()
    item = TrackingItem(
        item_id=item_id,
        provider=provider,
        label=label,
        current_status="ordered",
        url=url,
    )
    updated = add_item(config, item)
    save_config(updated)
    print(f"Added {provider} tracker for {item_id}")


def set_profile(name: str, address1: str, city: str, state: str, zip_code: str) -> None:
    config = ensure_config()
    config["profile"] = {
        "name": name,
        "address_line1": address1,
        "city": city,
        "state": state,
        "zip_plus4": zip_code,
    }
    save_config(config)
    print("Profile updated.")


def show_profile() -> None:
    config = ensure_config()
    profile = config.get("profile", {})
    print("Profile")
    for key, value in profile.items():
        print(f"- {key}: {value}")


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Real-time package ticker for Zachary")
    sub = parser.add_subparsers(dest="cmd", required=True)

    sub.add_parser("watch", help="Run live terminal ticker")

    add_parser = sub.add_parser("add", help="Add a tracking target (amazon/ebay/other)")
    add_parser.add_argument("provider", help="Provider name, e.g., amazon, ebay, etsy")
    add_parser.add_argument("item_id", help="Order or tracking id")
    add_parser.add_argument("label", help="Display label")
    add_parser.add_argument("--url", default="", help="Optional tracking URL")

    profile_parser = sub.add_parser("profile-set", help="Set profile/address details")
    profile_parser.add_argument("--name", required=True)
    profile_parser.add_argument("--address1", required=True)
    profile_parser.add_argument("--city", required=True)
    profile_parser.add_argument("--state", required=True)
    profile_parser.add_argument("--zip", required=True)

    sub.add_parser("profile-show", help="Show saved profile")

    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv if argv is not None else sys.argv[1:])
    if args.cmd == "watch":
        watch()
    elif args.cmd == "add":
        add(args.provider, args.item_id, args.label, args.url)
    elif args.cmd == "profile-set":
        set_profile(args.name, args.address1, args.city, args.state, args.zip)
    elif args.cmd == "profile-show":
        show_profile()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
