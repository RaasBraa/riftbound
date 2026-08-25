"""Local Riftbound archive server. Serves the site and writes data/collection.json."""

from __future__ import annotations

import json
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
COLLECTION = ROOT / "data" / "collection.json"
PORT = 4173
LOCAL_HOSTS = {"127.0.0.1", "::1", "localhost"}


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def log_message(self, format: str, *args) -> None:
        print("[%s] %s" % (self.log_date_time_string(), format % args))

    def do_POST(self) -> None:
        if self.path != "/api/collection":
            self.send_error(404)
            return
        if self.client_address[0] not in {"127.0.0.1", "::1"}:
            self.send_error(403, "Collection can only be saved from this machine")
            return

        length = int(self.headers.get("Content-Length", "0"))
        payload = json.loads(self.rfile.read(length).decode("utf-8") or "{}")
        if not isinstance(payload, dict):
            self.send_error(400, "Collection must be a JSON object")
            return

        clean = {str(key): int(value) for key, value in payload.items() if int(value) > 0}
        COLLECTION.parent.mkdir(parents=True, exist_ok=True)
        COLLECTION.write_text(json.dumps(clean, indent=2, sort_keys=True) + "\n", encoding="utf-8")

        body = b'{"ok":true}'
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


def main() -> None:
    server = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    print(f"Local editor: http://127.0.0.1:{PORT}")
    print("Use +/- in the browser. collection.json updates automatically.")
    print("Push that file when you want GitHub Pages to show the new counts.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")


if __name__ == "__main__":
    main()
