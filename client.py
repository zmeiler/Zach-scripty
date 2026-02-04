import argparse
import json
import queue
import socket
import threading
import tkinter as tk
from tkinter import ttk

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


class GameClient(tk.Tk):
    def __init__(self, net: NetworkClient):
        super().__init__()
        self.title("Oakridge Online - Python Edition")
        self.resizable(False, False)
        self.net = net
        self.player_id = None
        self.grid = generate_map()
        self.players = []
        self._build_ui()
        self._bind_controls()
        self.after(50, self._poll_network)

    def _build_ui(self):
        container = ttk.Frame(self, padding=8)
        container.grid(row=0, column=0)
        canvas_width = MAP_WIDTH * TILE_SIZE
        canvas_height = MAP_HEIGHT * TILE_SIZE
        self.canvas = tk.Canvas(container, width=canvas_width, height=canvas_height, bg="#111")
        self.canvas.grid(row=0, column=0, rowspan=2)
        self.chat = tk.Text(container, width=32, height=18, state="disabled")
        self.chat.grid(row=0, column=1, padx=(8, 0))
        self.chat_entry = ttk.Entry(container, width=32)
        self.chat_entry.grid(row=1, column=1, padx=(8, 0), pady=(8, 0), sticky="ew")
        self.chat_entry.bind("<Return>", self._send_chat)
        self.status = ttk.Label(container, text="Connecting...")
        self.status.grid(row=2, column=0, columnspan=2, pady=(6, 0))

    def _bind_controls(self):
        self.bind("<Up>", lambda _: self._move(0, -1))
        self.bind("<Down>", lambda _: self._move(0, 1))
        self.bind("<Left>", lambda _: self._move(-1, 0))
        self.bind("<Right>", lambda _: self._move(1, 0))
        self.bind("w", lambda _: self._move(0, -1))
        self.bind("s", lambda _: self._move(0, 1))
        self.bind("a", lambda _: self._move(-1, 0))
        self.bind("d", lambda _: self._move(1, 0))

    def _send_chat(self, _event=None):
        text = self.chat_entry.get().strip()
        if text:
            self.net.send({"type": "chat", "text": text})
        self.chat_entry.delete(0, tk.END)

    def _move(self, dx: int, dy: int):
        self.net.send({"type": "move", "dx": dx, "dy": dy})

    def _poll_network(self):
        while True:
            try:
                message = self.net.inbox.get_nowait()
            except queue.Empty:
                break
            self._handle_message(message)
        self._render()
        self.after(50, self._poll_network)

    def _handle_message(self, message: dict):
        msg_type = message.get("type")
        if msg_type == "welcome":
            self.player_id = message["player_id"]
            self.grid = message["grid"]
            self.players = message["players"]
            self.status.config(text=f"Connected as #{self.player_id}")
        elif msg_type == "state":
            self.players = message["players"]
        elif msg_type == "chat":
            self._append_chat(f"{message.get('from')}: {message.get('text')}")

    def _append_chat(self, line: str):
        self.chat.configure(state="normal")
        self.chat.insert(tk.END, line + "\n")
        self.chat.configure(state="disabled")
        self.chat.see(tk.END)

    def _render(self):
        self.canvas.delete("all")
        for y, row in enumerate(self.grid):
            for x, tile in enumerate(row):
                color = "#2b5b2b" if tile == "." else "#1f1f1f"
                self.canvas.create_rectangle(
                    x * TILE_SIZE,
                    y * TILE_SIZE,
                    (x + 1) * TILE_SIZE,
                    (y + 1) * TILE_SIZE,
                    fill=color,
                    outline="#111",
                )
        for player in self.players:
            x = player["x"]
            y = player["y"]
            color = player.get("color", "#44ccff")
            self.canvas.create_oval(
                x * TILE_SIZE + 4,
                y * TILE_SIZE + 4,
                (x + 1) * TILE_SIZE - 4,
                (y + 1) * TILE_SIZE - 4,
                fill=color,
                outline="#000",
            )
            self.canvas.create_text(
                x * TILE_SIZE + TILE_SIZE // 2,
                y * TILE_SIZE + 6,
                text=player["name"],
                fill="#fff",
                font=("Consolas", 8),
            )


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
        app.mainloop()
    finally:
        net.stop()
        if server:
            server.shutdown()


if __name__ == "__main__":
    main()
