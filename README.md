# Oakridge Online (Python Edition)

This is a minimal, self-contained Python remake of the project. It uses a lightweight TCP server and a Tkinter client for a simple top-down multiplayer RPG sandbox.

## Requirements
- Python 3.10+ (standard library only).
- Windows 11 recommended.

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
- Chat: type in the box and press Enter.

## Notes
- The map is generated deterministically at startup.
- This is a fresh Python rewrite; the previous Java implementation has been removed.
