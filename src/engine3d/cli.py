"""CLI entry point for the Ashenfall survival title prototype."""

from __future__ import annotations

import argparse

from .game import SurvivalGame, run_title


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

    if args.show_log:
        game = SurvivalGame(seed=args.seed, target_days=args.days)
        _, _ = game.autoplay()
        print(run_title(seed=args.seed, target_days=args.days))
        for event in game.log:
            print(f" - {event}")
        return

    print(run_title(seed=args.seed, target_days=args.days))


if __name__ == "__main__":
    main()
