# Oakridge Online (Late-90s Graphical MUD Tribute)

Oakridge Online is a self-contained, original 2D isometric multiplayer RPG inspired by late-1990s graphical MUDs. It provides offline single-player (embedded server) and multiplayer modes with movement, combat, skills, resource gathering, chat, and persistence.

## Features
- Isometric 2D rendering with chunky pixel-art tiles and sprites.
- Offline single-player (embedded server) or online multiplayer (2–10 players).
- Server-authoritative movement, combat, and resource gathering.
- Chat, NPC dialogue, shop, inventory, equipment slots.
- Skills: Attack, Strength, Defense, Hitpoints, Mining, Woodcutting, Fishing.
- Persistent accounts with PBKDF2 password hashing stored as JSON.
- Basic audio with synthesized chiptune-style beeps.
- 20+ named areas with roads, castle, and dungeon ladder transitions.

## Requirements
- Windows 11 (recommended) or any OS with Java 21.
- JDK 21 installed and `javac` available in PATH.

## Build
### Windows (PowerShell or Command Prompt)
```
./build.bat
```

### macOS/Linux
```
./build.sh
```

The build outputs:
- `build/server.jar`
- `build/client.jar`

If the JARs are missing, re-run the build after ensuring JDK 21 (javac + jar) is on your PATH (not just a JRE) and delete any old `build/*-sources.txt` files so the source list is fresh.

## Run Multiplayer (Local)
Start the server in one terminal:
```
java -jar build/server.jar 5555
```

Start one or more clients in other terminals:
```
java -jar build/client.jar
```

## Run Single-Player (Offline)
Start the client and check **Single-player (offline)** on the login screen. The client automatically starts an embedded server.

## Gameplay Basics
- **Move:** WASD/Arrow keys or left-click a destination (pathfinding).
- **Attack:** Right-click a monster.
- **Gather:** Right-click a tree, ore vein, or fishing spot.
- **Chat:** Type in the chat box and press Enter.
- **Shop:** Stand near Joran and type `/buy bread` or `/sell log|ore|fish`.
- **Equipment:** Monsters can drop bronze sword/armor. Equip with `/equip sword` or `/equip armor`.
- **Eat:** `/eat` to consume bread and heal.
- **UI Scale:** Press 1 (2x) or 2 (3x).
- **Ladders:** Step onto the ladder in the castle to descend into the dungeon and back.

## Persistence
Account data is stored as JSON files under `data/accounts/`. Passwords are hashed with PBKDF2.

## Packaging for Windows (.exe)
If you want a Windows native executable, use `jpackage`:
```
jpackage --type exe --name OakridgeOnline --input build --main-jar client.jar --main-class rpgclient.RpgClientApp --java-options "-Xmx512m"
```

For the server:
```
jpackage --type exe --name OakridgeServer --input build --main-jar server.jar --main-class rpgserver.GameServer
```

## Legal Notice
All art, names, lore, maps, and assets are original or generic fantasy equivalents. No copyrighted assets or branding are used.
