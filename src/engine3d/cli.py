"""CLI entry point for the Ashenfall survival title prototype."""

from __future__ import annotations

import argparse

from .game import SurvivalGame


def main() -> None:
    parser = argparse.ArgumentParser(description="Ashenfall: survival title prototype")
    parser.add_argument("--seed", type=int, default=7, help="Random seed for deterministic runs")
    parser.add_argument("--days", type=int, default=14, help="Target survival days")
    parser.add_argument(
        "--show-log",
        action="store_true",
        help="Print day-by-day event log after simulation",
    )
    args = parser.parse_args()

    game = SurvivalGame(seed=args.seed, target_days=args.days)
    victory, summary = game.autoplay()

    outcome = "VICTORY" if victory else "DEFEAT"
    print(f"{outcome}: {summary} | {game.campaign_report()}")

    if args.show_log:
        for event in game.log:
            print(f" - {event}")


if __name__ == "__main__":
    main()
