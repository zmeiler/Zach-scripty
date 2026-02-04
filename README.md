# Oakridge Online (Python Edition)

This is a minimal, self-contained Python remake of the project. It uses a lightweight TCP server and a Panda3D client for a simple 3D multiplayer RPG sandbox.

## Requirements
- Python 3.10+.
- Windows 11 recommended.
- Panda3D (see install step below).

## Install Dependencies
```
python -m pip install -r requirements.txt
```

## Run Multiplayer (Local)
Start the server in one terminal:
```
python server.py
```

Start one or more clients in other terminals:
```
python client.py --name "PlayerOne"
```

## Run Single-Player (Offline)
```
python client.py --offline --name "Solo"
```

## Controls
- Move: WASD or arrow keys.
- Chat: press Enter to focus, type, then Enter to send.
## Notes
- The map is generated deterministically at startup.
- This is a fresh Python rewrite with a 3D client using Panda3D.
