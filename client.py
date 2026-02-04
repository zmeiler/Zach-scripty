import argparse
import json
import queue
import socket
import sys
import threading

try:
    from direct.gui.DirectEntry import DirectEntry
    from direct.gui.OnscreenText import OnscreenText
    from direct.showbase.ShowBase import ShowBase
    from panda3d.core import AmbientLight, DirectionalLight, LPoint3f, LVector3f, TextNode
except ImportError as exc:
    raise SystemExit(
        "Panda3D is required to run the 3D client. "
        "Install it with: python -m pip install -r requirements.txt"
    ) from exc

from shared import MAP_HEIGHT, MAP_WIDTH, TILE_SIZE, generate_map


class NetworkClient(threading.Thread):
    def __init__(self, host: str, port: int, name: str, color: str):
        super().__init__(daemon=True)
        self.host = host
        self.port = port
        self.name = name
        self.color = color
        self.socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        self.inbox = queue.Queue()
        self._running = True

    def run(self):
        self.socket.connect((self.host, self.port))
        hello = {"type": "hello", "name": self.name, "color": self.color}
        self.socket.sendall((json.dumps(hello) + "\n").encode("utf-8"))
        buffer = ""
        while self._running:
            data = self.socket.recv(4096)
            if not data:
                break
            buffer += data.decode("utf-8")
            while "\n" in buffer:
                line, buffer = buffer.split("\n", 1)
                if line:
                    self.inbox.put(json.loads(line))

    def send(self, message: dict):
        self.socket.sendall((json.dumps(message) + "\n").encode("utf-8"))

    def stop(self):
        self._running = False
        try:
            self.socket.close()
        except OSError:
            pass


class GameClient(ShowBase):
    def __init__(self, net: NetworkClient):
        super().__init__()
        self.net = net
        self.player_id = None
        self.grid = generate_map()
        self.players = {}
        self.tiles = []
        self.player_nodes = {}
        self._setup_scene()
        self._setup_ui()
        self._bind_controls()
        self.taskMgr.add(self._poll_network, "poll_network")

    def _setup_scene(self):
        self.disableMouse()
        self.setBackgroundColor(0.08, 0.09, 0.12, 1)
        ambient = AmbientLight("ambient")
        ambient.setColor((0.5, 0.5, 0.55, 1))
        ambient_np = self.render.attachNewNode(ambient)
        self.render.setLight(ambient_np)
        directional = DirectionalLight("directional")
        directional.setDirection(LVector3f(-1, -1.5, -2))
        directional.setColor((0.7, 0.7, 0.7, 1))
        directional_np = self.render.attachNewNode(directional)
        self.render.setLight(directional_np)
        self._build_world()
        self._position_camera()

    def _setup_ui(self):
        self.chat_log = OnscreenText(
            text="",
            pos=(-1.2, 0.9),
            align=TextNode.ALeft,
            scale=0.05,
            fg=(1, 1, 1, 1),
            shadow=(0, 0, 0, 0.8),
            mayChange=True,
        )
        self.status = OnscreenText(
            text="Connecting...",
            pos=(-1.2, -0.9),
            align=TextNode.ALeft,
            scale=0.05,
            fg=(0.8, 0.9, 1, 1),
            shadow=(0, 0, 0, 0.8),
            mayChange=True,
        )
        self.chat_entry = DirectEntry(
            text="",
            scale=0.05,
            pos=(-1.2, 0, -0.8),
            width=24,
            numLines=1,
            focus=0,
            command=self._send_chat,
            focusInCommand=self._on_chat_focus,
        )

    def _bind_controls(self):
        self.accept("arrow_up", self._move, [0, -1])
        self.accept("arrow_down", self._move, [0, 1])
        self.accept("arrow_left", self._move, [-1, 0])
        self.accept("arrow_right", self._move, [1, 0])
        self.accept("w", self._move, [0, -1])
        self.accept("s", self._move, [0, 1])
        self.accept("a", self._move, [-1, 0])
        self.accept("d", self._move, [1, 0])
        self.accept("enter", self._focus_chat)
        self.accept("escape", self._unfocus_chat)

    def _focus_chat(self):
        self.chat_entry["focus"] = 1

    def _unfocus_chat(self):
        self.chat_entry["focus"] = 0

    def _on_chat_focus(self):
        self.chat_entry.enterText("")

    def _send_chat(self, text):
        clean = text.strip()
        if clean:
            self.net.send({"type": "chat", "text": clean})
        self.chat_entry.enterText("")
        self._unfocus_chat()

    def _move(self, dx, dy):
        self.net.send({"type": "move", "dx": dx, "dy": dy})

    def _poll_network(self, _task):
        while True:
            try:
                message = self.net.inbox.get_nowait()
            except queue.Empty:
                break
            self._handle_message(message)
        return _task.cont

    def _handle_message(self, message: dict):
        msg_type = message.get("type")
        if msg_type == "welcome":
            self.player_id = message["player_id"]
            self.grid = message["grid"]
            self._rebuild_world()
            self._sync_players(message["players"])
            self.status.setText(f"Connected as #{self.player_id}")
        elif msg_type == "state":
            self._sync_players(message["players"])
        elif msg_type == "chat":
            self._append_chat(f"{message.get('from')}: {message.get('text')}")

    def _append_chat(self, line: str):
        current = self.chat_log.getText()
        lines = (current + "\n" + line).strip().splitlines()
        self.chat_log.setText("\n".join(lines[-8:]))

    def _build_world(self):
        tile_model = self.loader.loadModel("models/box")
        tile_model.setScale(0.5, 0.5, 0.1)
        for y, row in enumerate(self.grid):
            for x, tile in enumerate(row):
                node = tile_model.copyTo(self.render)
                node.setPos(LPoint3f(x, y, -0.5))
                if tile == ".":
                    node.setColor(0.18, 0.35, 0.2, 1)
                else:
                    node.setColor(0.12, 0.12, 0.12, 1)
                self.tiles.append(node)

    def _rebuild_world(self):
        for tile in self.tiles:
            tile.removeNode()
        self.tiles.clear()
        self._build_world()

    def _sync_players(self, players):
        active_ids = set()
        for player in players:
            pid = player["id"]
            active_ids.add(pid)
            node = self.player_nodes.get(pid)
            if node is None:
                node = self.loader.loadModel("models/smiley")
                node.setScale(0.3)
                node.reparentTo(self.render)
                self.player_nodes[pid] = node
            node.setPos(LPoint3f(player["x"], player["y"], 0.2))
        for pid in list(self.player_nodes.keys()):
            if pid not in active_ids:
                self.player_nodes[pid].removeNode()
                del self.player_nodes[pid]

    def _position_camera(self):
        self.camera.setPos(MAP_WIDTH / 2, MAP_HEIGHT * 1.8, 18)
        self.camera.lookAt(LPoint3f(MAP_WIDTH / 2, MAP_HEIGHT / 2, 0))


def start_offline_server():
    from server import GameServer

    server = GameServer(("127.0.0.1", 5555))
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    return server


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=5555)
    parser.add_argument("--name", default="Adventurer")
    parser.add_argument("--color", default="#44ccff")
    parser.add_argument("--offline", action="store_true")
    args = parser.parse_args()

    server = None
    if args.offline:
        server = start_offline_server()

    net = NetworkClient(args.host, args.port, args.name, args.color)
    net.start()
    app = GameClient(net)
    try:
        app.run()
    finally:
        net.stop()
        if server:
            server.shutdown()


if __name__ == "__main__":
    main()
