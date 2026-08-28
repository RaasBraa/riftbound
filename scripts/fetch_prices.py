"""Fetch EU lowest listings and map them onto the local catalog."""

from __future__ import annotations

import json
import time
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CATALOG = ROOT / "data" / "cards.json"
OUT_PATH = ROOT / "data" / "prices.json"
API = "https://riftcompare.com/api/cards"
SEARCH = "https://www.cardmarket.com/en/Riftbound/Products/Search?searchString="


def fetch_page(page: int) -> list[dict]:
    request = urllib.request.Request(
        f"{API}?page={page}",
        headers={
            "User-Agent": "riftbound-archive/1.0",
            "Accept": "application/json",
        },
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        payload = json.loads(response.read().decode("utf-8"))
    return payload.get("cards") or []


def catalog_code(set_code: str, collector: str) -> str:
    number = str(collector or "").upper().replace(" ", "")
    prefix = str(set_code or "").upper()
    if number.startswith(f"{prefix}-"):
        return number
    return f"{prefix}-{number}"


def is_promo_code(code: str) -> bool:
    return bool(
        "B/" in code
        or code.endswith("B")
        or "PROMO" in code
    )


def cardmarket_url(name: str, code: str) -> str:
    query = " ".join(part for part in (name, code.split("/")[0]) if part)
    return SEARCH + urllib.parse.quote(query)


def match_card(by_code: dict[str, dict], row: dict) -> dict | None:
    code = catalog_code(row.get("setCode") or "", row.get("collectorNumber") or "")
    card = by_code.get(code)
    if not card:
        return None
    if row.get("isPromo") and not is_promo_code(card.get("code") or ""):
        return None
    return card


def load_prices() -> dict:
    catalog = json.loads(CATALOG.read_text(encoding="utf-8"))
    by_code = {(card.get("code") or "").upper(): card for card in catalog.get("cards") or []}
    mapped: dict[str, dict] = {}
    page = 1
    while page <= 80:
        rows = fetch_page(page)
        if not rows:
            break
        for row in rows:
            card = match_card(by_code, row)
            if not card:
                continue
            cents = row.get("lowestPriceCentsEu")
            mapped[card["id"]] = {
                "eurCents": None if cents is None else int(cents),
                "cardmarket": cardmarket_url(card.get("name") or "", card.get("code") or ""),
            }
        page += 1
        time.sleep(0.12)
    return {
        "source": "EU lowest in-stock listing via RiftCompare (Cardmarket is the main EU market; Cardmarket.com itself blocks automated lookups).",
        "currency": "EUR",
        "fetchedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "cards": mapped,
        "matched": len(mapped),
    }


def write_prices() -> dict:
    payload = load_prices()
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return payload


def main() -> None:
    payload = write_prices()
    priced = sum(1 for row in payload["cards"].values() if row.get("eurCents") is not None)
    print(f"Wrote {priced} EU prices for {payload['matched']} catalog cards to {OUT_PATH.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
