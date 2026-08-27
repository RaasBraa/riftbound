"""Local Riftbound archive server. Serves the site and writes data/collection.json."""

from __future__ import annotations

import json
import socket
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
COLLECTION = ROOT / "data" / "collection.json"
PORT = 4173


def lan_ip() -> str:
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        sock.connect(("8.8.8.8", 80))
        return sock.getsockname()[0]
    except OSError:
        return "127.0.0.1"
    finally:
        sock.close()


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def log_message(self, format: str, *args) -> None:
        print("[%s] %s" % (self.log_date_time_string(), format % args))

    def _send_json(self, status: int, payload: dict) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:
        if self.path.split("?", 1)[0] == "/api/health":
            self._send_json(200, {"ok": True, "edit": True})
            return
        super().do_GET()

    def do_POST(self) -> None:
        if self.path != "/api/collection":
            self.send_error(404)
            return

        length = int(self.headers.get("Content-Length", "0"))
        payload = json.loads(self.rfile.read(length).decode("utf-8") or "{}")
        if not isinstance(payload, dict):
            self.send_error(400, "Collection must be a JSON object")
            return

        clean = {str(key): int(value) for key, value in payload.items() if int(value) > 0}
        COLLECTION.parent.mkdir(parents=True, exist_ok=True)
        COLLECTION.write_text(json.dumps(clean, indent=2, sort_keys=True) + "\n", encoding="utf-8")
        self._send_json(200, {"ok": True, "cards": len(clean)})


def main() -> None:
    server = ThreadingHTTPServer(("0.0.0.0", PORT), Handler)
    print(f"Local editor:  http://127.0.0.1:{PORT}")
    print(f"Phone camera:  http://{lan_ip()}:{PORT}/intake.html")
    print("Type names or scan cards. collection.json updates automatically.")
    print("Push that file when you want GitHub Pages to show the new counts.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")


if __name__ == "__main__":
    main()
