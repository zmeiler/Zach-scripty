#!/usr/bin/env python3
"""Standalone dispensary ticker app (single file, stdlib only).

Double-click on Windows (if .py associated with Python) or run:
    python standalone_ticker.py
"""

from __future__ import annotations

import json
import random
import threading
import time
import webbrowser
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from queue import Empty, Queue

HOST = "0.0.0.0"
PORT = 8765
DATA_FILE = Path(__file__).parent / "apps" / "api" / "data" / "pa_medical_dispensaries.json"

SUBSCRIBERS: set[Queue[str]] = set()
EVENTS: list[dict] = []
LOCK = threading.Lock()

INDEX_HTML = """<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>PA Dispensary Live Ticker</title>
  <style>
    :root { color-scheme: dark; font-family: Segoe UI, Arial, sans-serif; }
    body { margin: 0; background:#0e1017; color:#edf1ff; }
    main { max-width: 1100px; margin: 0 auto; padding: 20px; }
    .status { color:#6ad6ff; margin-bottom:12px; }
    .tape-wrap { overflow:hidden; border:1px solid #2a2c35; border-radius:8px; background:#161822; padding:8px; margin-bottom:14px; }
    .tape { display:inline-flex; gap:16px; white-space:nowrap; animation:ticker 18s linear infinite; }
    .tape-item { color:#92f7b6; font-weight:600; }
    @keyframes ticker { 0%{transform:translateX(15%);} 100%{transform:translateX(-60%);} }
    table { width:100%; border-collapse:collapse; margin-bottom:18px; }
    th, td { border-bottom:1px solid #2a2c35; padding:8px; text-align:left; }
    a { color:#8bdcff; }
  </style>
</head>
<body>
  <main>
    <h1>PA Dispensary Live Ticker (Standalone)</h1>
    <p id="status" class="status">Connecting…</p>

    <div class="tape-wrap"><div id="tape" class="tape"></div></div>

    <h2>Live Prices</h2>
    <table><thead><tr><th>Product</th><th>Price</th><th>Stock</th><th>Updated</th></tr></thead><tbody id="ticker"></tbody></table>

    <h2>Latest Reviews</h2>
    <ul id="reviews"></ul>

    <h2>Pennsylvania Medical Dispensary Directory</h2>
    <table><thead><tr><th>Permittee</th><th>Location</th><th>Address</th><th>Website</th></tr></thead><tbody id="directory"></tbody></table>
  </main>

<script>
const statusEl = document.getElementById('status');
const tickerBody = document.getElementById('ticker');
const reviewsEl = document.getElementById('reviews');
const directoryEl = document.getElementById('directory');
const tapeEl = document.getElementById('tape');
const rows = new Map();

function addTape(text){
  const s = document.createElement('span');
  s.className = 'tape-item';
  s.textContent = text;
  tapeEl.prepend(s);
  while(tapeEl.children.length > 40) tapeEl.removeChild(tapeEl.lastChild);
}

function upsert(event){
  const {product, price, review} = event;
  let row = rows.get(product.id);
  if(!row){
    row = document.createElement('tr');
    row.innerHTML = '<td class="p"></td><td class="pr"></td><td class="s"></td><td class="u"></td>';
    rows.set(product.id, row);
    tickerBody.prepend(row);
  }
  row.querySelector('.p').textContent = `${product.name} (${product.source_id})`;
  row.querySelector('.pr').textContent = `${price.currency} ${Number(price.amount).toFixed(2)}`;
  row.querySelector('.s').textContent = product.in_stock ? 'Yes' : 'No';
  row.querySelector('.u').textContent = new Date(price.observed_at).toLocaleTimeString();
  addTape(`${product.name} ${price.currency}${Number(price.amount).toFixed(2)} ${product.in_stock ? '▲' : '▼'}`);

  const li = document.createElement('li');
  li.textContent = `${product.name}: ${review.rating}/5 - ${review.body}`;
  reviewsEl.prepend(li);
  while(reviewsEl.children.length > 12) reviewsEl.removeChild(reviewsEl.lastChild);
}

async function loadDirectory(){
  const r = await fetch('/pa-dispensaries');
  const data = await r.json();
  directoryEl.innerHTML = '';
  data.forEach(d => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${d.permittee}</td><td>${d.location_name}, ${d.city}</td><td>${d.address}, ${d.city}, ${d.state} ${d.zip}</td><td><a href="${d.website}" target="_blank" rel="noopener noreferrer">${d.website}</a></td>`;
    directoryEl.appendChild(tr);
  });
}

async function bootstrap(){
  const r = await fetch('/events?limit=50');
  if(!r.ok) return;
  const events = await r.json();
  events.forEach(upsert);
}

function connect(){
  const es = new EventSource('/stream');
  es.onopen = () => statusEl.textContent = 'Live feed connected';
  es.onmessage = (e) => {
    const payload = JSON.parse(e.data);
    if(payload.type === 'price_update') upsert(payload);
  };
  es.onerror = () => {
    statusEl.textContent = 'Disconnected, retrying...';
    es.close();
    setTimeout(connect, 1200);
  };
}

Promise.all([loadDirectory(), bootstrap()]).catch(() => {
  statusEl.textContent = 'Directory load issue, stream will continue.';
});
connect();
</script>
</body>
</html>
"""


def load_directory() -> list[dict]:
    if not DATA_FILE.exists():
        return []
    with DATA_FILE.open("r", encoding="utf-8") as f:
        return json.load(f)


def publish(event: dict) -> None:
    payload = json.dumps(event)
    with LOCK:
        EVENTS.append(event)
        if len(EVENTS) > 500:
            del EVENTS[:-500]
        dead: list[Queue[str]] = []
        for q in SUBSCRIBERS:
            try:
                q.put_nowait(payload)
            except Exception:
                dead.append(q)
        for q in dead:
            SUBSCRIBERS.discard(q)


def source_id(record: dict) -> str:
    raw = f"{record['permittee']}-{record['location_name']}-{record['city']}"
    return "pa-" + "".join(ch.lower() if ch.isalnum() else "-" for ch in raw).strip("-")


def generator_loop(directory: list[dict]) -> None:
    catalog = [
        ("flower-001", "Blue Dream 3.5g"),
        ("vape-002", "Pineapple Express Cart"),
        ("gummy-003", "Mango Gummies 100mg"),
    ]
    snippets = ["Great effects and flavor.", "Solid value.", "Would buy again."]
    while True:
        for d in directory:
            sid = source_id(d)
            pid, name = random.choice(catalog)
            observed = datetime.now(timezone.utc).isoformat()
            event = {
                "type": "price_update",
                "product": {
                    "id": f"{sid}:{pid}",
                    "source_id": sid,
                    "name": name,
                    "in_stock": random.random() > 0.15,
                },
                "price": {
                    "amount": round(random.uniform(18, 70), 2),
                    "currency": "USD",
                    "observed_at": observed,
                },
                "review": {
                    "rating": round(random.uniform(3.6, 5.0), 1),
                    "body": random.choice(snippets),
                },
            }
            publish(event)
            time.sleep(0.12)


class Handler(BaseHTTPRequestHandler):
    def _send_json(self, obj: object, status: int = 200) -> None:
        body = json.dumps(obj).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):  # noqa: N802
        if self.path in ("/", "/index.html"):
            body = INDEX_HTML.encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return

        if self.path.startswith("/events"):
            limit = 50
            if "limit=" in self.path:
                try:
                    limit = int(self.path.split("limit=")[1].split("&")[0])
                except ValueError:
                    limit = 50
            with LOCK:
                data = EVENTS[-max(1, min(limit, 500)) :]
            self._send_json(data)
            return

        if self.path == "/pa-dispensaries":
            self._send_json(self.server.directory)
            return

        if self.path == "/stream":
            q: Queue[str] = Queue(maxsize=200)
            with LOCK:
                SUBSCRIBERS.add(q)
            self.send_response(200)
            self.send_header("Content-Type", "text/event-stream")
            self.send_header("Cache-Control", "no-cache")
            self.send_header("Connection", "keep-alive")
            self.end_headers()
            try:
                while True:
                    try:
                        payload = q.get(timeout=15)
                        self.wfile.write(f"data: {payload}\n\n".encode("utf-8"))
                        self.wfile.flush()
                    except Empty:
                        self.wfile.write(b": keepalive\n\n")
                        self.wfile.flush()
            except (BrokenPipeError, ConnectionResetError):
                pass
            finally:
                with LOCK:
                    SUBSCRIBERS.discard(q)
            return

        self._send_json({"error": "Not found"}, status=404)

    def log_message(self, fmt: str, *args):
        return


def main() -> None:
    directory = load_directory()
    if not directory:
        print("Warning: PA directory JSON not found. Running with empty directory.")

    thread = threading.Thread(target=generator_loop, args=(directory,), daemon=True)
    thread.start()

    server = ThreadingHTTPServer((HOST, PORT), Handler)
    server.directory = directory  # type: ignore[attr-defined]

    url = f"http://localhost:{PORT}"
    print(f"Standalone ticker running at {url}")
    print("Press Ctrl+C to stop.")
    try:
        webbrowser.open(url)
    except Exception:
        pass

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping...")


if __name__ == "__main__":
    main()
