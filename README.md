# Ashenfall — Expanded Python Survival Title Prototype

Ashenfall is a deterministic survival game prototype in Python, designed with a
production-minded architecture so gameplay can scale while engine boundaries stay clean.

## Expanded features

- **Core survival attributes**: health, stamina, hunger, warmth, morale
- **Inventory economy**: food, wood, scrap, medicine, ammo
- **Action set**: forage, rest, craft, hunt, scavenge, explore, heal
- **Biome loop**: forest → ruins → swamp → tundra migration over campaign time
- **World pressure systems**: storm risk growth, threat escalation, environmental penalties
- **Deterministic simulations** via seed control (useful for balancing + QA)

## Quick start

```bash
python -m venv .venv
source .venv/bin/activate
pip install -e . pytest
pytest -q
ashenfall --seed 9 --days 18
ashenfall --seed 9 --days 18 --show-log
```

### Windows one-click build + run

Use the included batch file:

```bat
scripts\build_and_run_ashenfall.bat
scripts\build_and_run_ashenfall.bat 7 14
scripts\build_and_run_ashenfall.bat 7 14 --show-log
scripts\build_and_run_ashenfall.bat 7 14 --show-log --debug
```

This script will:
- create `.venv` if missing
- install/update dependencies
- run `pytest -q`
- verify `engine3d` import before launch
- run the Ashenfall CLI with the provided seed/days
- print diagnostics automatically if launch fails

## Gameplay architecture

- `src/engine3d/core.py`: ECS-inspired engine orchestration
- `src/engine3d/subsystems.py`: render/physics/audio domain placeholders
- `src/engine3d/game.py`: Ashenfall gameplay loop, simulation rules, and campaign report
- `src/engine3d/cli.py`: runnable title entrypoint

## Why this structure is strong

This is close to how high-end teams separate concerns:

- Engine-level stability for runtime constraints
- Data/gameplay iteration velocity in title-level systems
- Repeatable simulations for fast balancing and test confidence

## Suggested next expansions

- Multi-region world map with route choices and risk-reward travel
- NPC survivors, faction reputation, and dynamic events
- Equipment tiers + modular crafting recipes
- Save/load snapshots with deterministic replays for QA
- Native rendering/physics bindings for real 3D runtime visuals

## HTML5 banking demo

A standalone HTML5 banking demo is available in `webapp/` (client-side only, localStorage-backed):

```bash
cd webapp
python -m http.server 8080
# open http://localhost:8080
```

Includes demo sign-in with MFA field, account balances, internal transfer flow, transaction search, and dark mode.
