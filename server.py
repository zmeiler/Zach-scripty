import json
import socketserver
import threading
import time
from dataclasses import dataclass, field

from shared import MAP_HEIGHT, MAP_WIDTH, generate_map, is_walkable


@dataclass
class Player:
    player_id: int
    name: str
    x: int
    y: int
    color: str


@dataclass
class GameState:
    grid: list[list[str]] = field(default_factory=generate_map)
    players: dict[int, Player] = field(default_factory=dict)
    next_id: int = 1


class GameServer(socketserver.ThreadingTCPServer):
    allow_reuse_address = True

    def __init__(self, server_address):
        super().__init__(server_address, ClientHandler)
        self.state = GameState()
        self.lock = threading.Lock()

    def broadcast(self, message: dict):
        payload = (json.dumps(message) + "\n").encode("utf-8")
        for handler in list(self._threads):
            handler.send(payload)

    @property
    def _threads(self):
        return getattr(self, "handlers", [])


class ClientHandler(socketserver.StreamRequestHandler):
    def setup(self):
        super().setup()
        self.server.handlers = getattr(self.server, "handlers", [])
        self.server.handlers.append(self)
        self.player_id = None

    def send(self, payload: bytes):
        try:
            self.wfile.write(payload)
            self.wfile.flush()
        except Exception:
            pass

    def handle(self):
        line = self.rfile.readline().decode("utf-8").strip()
        if not line:
            return
        hello = json.loads(line)
        if hello.get("type") != "hello":
            return
        name = hello.get("name", "Adventurer")
        with self.server.lock:
            pid = self.server.state.next_id
            self.server.state.next_id += 1
            spawn_x, spawn_y = 2 + pid % (MAP_WIDTH - 4), 2 + pid % (MAP_HEIGHT - 4)
            player = Player(pid, name, spawn_x, spawn_y, hello.get("color", "#44ccff"))
            self.server.state.players[pid] = player
            self.player_id = pid
            players = self._serialize_players()
        self.send(
            json.dumps(
                {
                    "type": "welcome",
                    "player_id": pid,
                    "grid": self.server.state.grid,
                    "players": players,
                }
            ).encode("utf-8")
            + b"\n"
        )
        self.server.broadcast({"type": "state", "players": players})
        while True:
            data = self.rfile.readline()
            if not data:
                break
            message = json.loads(data.decode("utf-8"))
            if message.get("type") == "move":
                self._handle_move(message)
            elif message.get("type") == "chat":
                self.server.broadcast(
                    {"type": "chat", "from": self._player_name(), "text": message.get("text", "")}
                )

    def _player_name(self):
        if self.player_id is None:
            return "Unknown"
        return self.server.state.players[self.player_id].name

    def _handle_move(self, message: dict):
        dx = int(message.get("dx", 0))
        dy = int(message.get("dy", 0))
        with self.server.lock:
            player = self.server.state.players.get(self.player_id)
            if not player:
                return
            target_x = player.x + dx
            target_y = player.y + dy
            if is_walkable(self.server.state.grid, target_x, target_y):
                player.x = target_x
                player.y = target_y
            players = self._serialize_players()
        self.server.broadcast({"type": "state", "players": players})

    def _serialize_players(self):
        return [
            {
                "id": p.player_id,
                "name": p.name,
                "x": p.x,
                "y": p.y,
                "color": p.color,
            }
            for p in self.server.state.players.values()
        ]

    def finish(self):
        with self.server.lock:
            if self.player_id in self.server.state.players:
                del self.server.state.players[self.player_id]
        self.server.handlers.remove(self)
        self.server.broadcast({"type": "state", "players": self._serialize_players()})
        super().finish()


def run_server(host: str = "0.0.0.0", port: int = 5555):
    with GameServer((host, port)) as server:
        print(f"Server listening on {host}:{port}")
        server.serve_forever()


if __name__ == "__main__":
    run_server()
