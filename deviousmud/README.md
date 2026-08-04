# DeviousMud

A family-friendly, isometric browser MMORPG. Explore Emberfall Village, train ten
skills, finish four quests, fight mischievous (never gruesome) creatures, and meet
other players in a shared world. Prefer the classic flat view? One switch in
Options turns the whole world top-down.

* **No dependencies.** No npm install, no build step, no image or audio files.
  Clone it and run `npm start`.
* **Runs anywhere.** Desktop, tablet and phone, mouse, touch or keyboard.
* **Plays offline.** If no server is reachable, the client runs the *same*
  simulation in the browser tab and saves progress to `localStorage`.

```
git clone <this repo>
cd deviousmud
npm start          # http://localhost:8080
```

---

## Contents

| Path | What it is |
| --- | --- |
| `client/` | The browser game: HTML shell, one stylesheet, ES modules |
| `server/` | Node game server: WebSocket, static files, accounts |
| `shared/` | Game data and the simulation engine, run by **both** sides |
| `tests/` | Node test-runner suite (`npm test`) |
| `tools/` | Single-file build, icon generation, Android asset sync |
| `android/` | Android WebView wrapper — build an APK with one command |
| `dist/` | Output of `npm run build`: the whole game as one HTML file |
| `docs/DESIGN.md` | Full design specification: UI, mechanics, architecture, protocol |
| `docs/DEVELOPMENT_LOG.md` | How it was built, what broke, and how it was fixed |

---

## Playing

### Controls

| Action | Mouse / keyboard | Touch |
| --- | --- | --- |
| Walk | Left click the ground, or arrow keys / WASD | Tap the ground |
| Primary action (chop, mine, talk, attack, take) | Left click the target | Tap the target |
| All actions menu | Right click | Long press |
| Chat | `Enter`, type, `Enter` | 💬 button |
| Panels | `I` bag · `E` worn · `K` skills · `Q` quests · `P` people · `O` options | Tab bar / 📋 button |
| Toggle run | `R`, or click the green orb | 🏃 button |
| Close menu or window | `Esc` | Tap outside |
| Zoom | Options → Zoom | Pinch |
| Switch view | Options → View (isometric or top-down) | Options → View |

### The first ten minutes

1. Talk to **Tutor Pip** by the fountain if anything is unclear.
2. Take **Welcome to Emberfall** from **Mayor Aldric** — it walks you through
   woodcutting, firemaking, fishing and cooking, and pays for your first axe.
3. **Bea's General Store** (north-east building) sells tools; **Banker Cyrus**
   (north-west) stores anything you do not want to carry.
4. North is the **Whispering Woods** (trees, wolves), west is **Copper Hollow**
   (ore, imps, golems), east is **Lake Serene** (fishing), south is the
   **Sunny Meadow** (gentle creatures for a first fight).

Being defeated costs you nothing but a walk back: you wake by the fountain with
your items and experience intact.

---

## Running a server

### Requirements

Node.js 18 or newer. Nothing else.

### Commands

```bash
npm start           # start the server on port 8080
npm run dev         # same, restarting on file changes (node --watch)
npm test            # run the engine test suite
npm run build       # bundle the whole game into dist/deviousmud.html
npm run android:sync # bundle into the Android app and refresh its icons
```

### Configuration

Every option is an environment variable:

| Variable | Default | Meaning |
| --- | --- | --- |
| `PORT` | `8080` | HTTP/WebSocket port |
| `HOST` | `0.0.0.0` | Bind address |
| `DM_DATA` | `server/data/accounts.json` | Character database file |
| `DM_MAX_PLAYERS` | `200` | Concurrent player cap |

```bash
PORT=3000 DM_DATA=/var/lib/deviousmud/accounts.json npm start
```

### Endpoints

| Path | Purpose |
| --- | --- |
| `/` | Redirects to the client |
| `/client/` | The game |
| `/ws` | WebSocket game protocol |
| `/api/status` | JSON health check: players online, tick, uptime, world checksum |

### Behind nginx (TLS and a friendly hostname)

The client picks `wss://` automatically when the page is served over HTTPS, so a
standard WebSocket-aware proxy block is all that is needed:

```nginx
server {
    listen 443 ssl;
    server_name play.example.com;

    ssl_certificate     /etc/letsencrypt/live/play.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/play.example.com/privkey.pem;

    location / {
        proxy_pass         http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade $http_upgrade;   # required for /ws
        proxy_set_header   Connection "upgrade";
        proxy_set_header   Host $host;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 3600s;                   # game sockets are long-lived
    }
}
```

### As a systemd service

```ini
# /etc/systemd/system/deviousmud.service
[Unit]
Description=DeviousMud game server
After=network.target

[Service]
Type=simple
User=deviousmud
WorkingDirectory=/opt/deviousmud
Environment=PORT=8080
Environment=DM_DATA=/var/lib/deviousmud/accounts.json
ExecStart=/usr/bin/node server/index.js
Restart=on-failure
RestartSec=5
StateDirectory=deviousmud

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable --now deviousmud
journalctl -u deviousmud -f
```

Characters autosave every 30 seconds, on logout, and on `SIGTERM`, so
`systemctl restart` never loses more than half a minute of progress.

## Playing on a phone

Three ways, in order of effort:

1. **Install the web app.** Open the client in Chrome on the phone and choose
   *Install app*, or press "Install on this device" on the title screen. You get
   a home-screen icon, a full-screen window and offline play — the service
   worker caches the game after the first visit. (Installing needs the page to
   be served over https, or over http from localhost.)
2. **Copy one file.** `npm run build` produces `dist/deviousmud.html`: the entire
   game, about 300 KB, in a single document. Put it on the phone and open it
   from Downloads. No install, no server, works in aeroplane mode.
3. **Build the APK.** `android/` holds a small WebView wrapper.
   `npm run android:sync && cd android && ./gradlew assembleDebug` produces
   `app/build/outputs/apk/debug/app-debug.apk`. See `android/README.md` for
   signing and for pointing the app at a multiplayer server.

A packaged client (APK or a file opened from disk) has no server of its own. It
plays solo by default, and can be pointed at one with
`?server=192.168.1.20:8080`, which it then remembers.

### Static hosting (offline mode only)

The client also runs from any static file host — copy `client/` and `shared/`,
keeping their relative positions, and open `client/index.html`. With no server to
talk to, the title screen offers solo play; multiplayer needs the Node server.

---

## Safety and moderation

DeviousMud is built to be readable over a child's shoulder, and to be
*operable* by one adult.

### For players

* **Report anyone, in two taps.** People panel → Report, or right-click a
  player → Report. Six plain-language reasons, an optional note, and the
  surrounding chat is attached automatically so a moderator can see for
  themselves. `/report <name> [what happened]` does the same from the chat box.
* **Public chat is filtered server-side** for URLs, email addresses, phone
  numbers and unkind words, before any other player receives it.
* **Chat is recorded** so moderators can review what happened. Players are told
  this on login. Set `DM_CHAT_LOG=off` to disable it.
* No player-versus-player combat, no gambling, no item loss on defeat, no voice
  chat, no external links, no advertising, no third-party requests of any kind.

### For moderators

Name your moderators at boot; they can appoint others in game.

```bash
DM_ADMINS="Zach,Rowan" npm start
```

| Command | What it does |
| --- | --- |
| `/help` | Lists the commands you can use |
| `/who` | Who is online |
| `/mute <name> <minutes> [reason]` | Stops someone chatting; `0` = until lifted |
| `/unmute <name>` | Lifts it |
| `/kick <name> [reason]` | Disconnects someone |
| `/ban <name> <hours> [reason]` | Keeps someone out; `0` = until lifted |
| `/unban <name>` | Lets them back |
| `/reports [count]` | The most recent reports |
| `/mod <name>` · `/unmod <name>` | Grant or remove moderator |
| `/say <message>` | Announce to everyone |

Every action is logged to the console with who did it and why. Moderators
online are pinged when a new report arrives.

Three files under the data directory hold the record:

| File | Contents |
| --- | --- |
| `moderation.json` | Mutes, bans and moderators (atomic writes, survives restart) |
| `reports.jsonl` | One report per line, with the chat around it |
| `chat.log` | Public chat, tab-separated, rotated at 8 MB |

### Abuse limits

All are environment variables, with defaults suited to a small friendly server.

| Limit | Variable | Default |
| --- | --- | --- |
| Connections per address | `DM_MAX_CONN_PER_IP` | 8 |
| Commands per second (signed in) | `DM_MAX_COMMANDS` | 40 |
| Commands per second (before sign in) | `DM_MAX_PREAUTH_COMMANDS` | 8 |
| Seconds before an unauthenticated socket is dropped | `DM_PREAUTH_TIMEOUT` | 45,000 ms |
| Failed logins before a cool-off | `DM_LOGIN_FAILURES` | 6 |
| New characters per address per hour | `DM_REGISTRATIONS_PER_HOUR` | 4 |
| Total accounts the server will hold | `DM_MAX_ACCOUNTS` | 5,000 |
| Chat messages per ten seconds | `DM_CHAT_PER_10S` | 8 |
| Idle disconnect | `DM_IDLE_TIMEOUT` | 30 min |
| Reports per player per hour | `DM_REPORTS_PER_HOUR` | 10 |

Failed logins back off exponentially, keyed by **both** address and account
name, so neither "one password against many accounts" nor "many passwords
against one account" gets far. Names that read as staff (`admin`, `M0derator`)
or as an NPC are refused at creation. Passwords are stored only as scrypt hashes
with a per-account salt.

---

## Testing

```bash
npm test
```

56 tests cover world generation and reachability, pathfinding, the experience
curve, inventory rules, combat maths, quest progression, shops, banking, trading,
chat filtering, the isometric projection, and the moderation and abuse limits —
mutes, bans that survive a restart, report context, flood and repeat detection,
reserved names, connection caps and login backoff.

---

## License

MIT. All artwork is generated procedurally by `client/js/sprites.js`; there are no
third-party assets in this repository.
