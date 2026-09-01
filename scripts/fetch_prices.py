"""Fetch TCGplayer prices from RiftCompare and map them onto the local catalog."""

from __future__ import annotations

import json
import time
import urllib.error
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CATALOG = ROOT / "data" / "cards.json"
OUT_PATH = ROOT / "data" / "prices.json"
LIST_API = "https://riftcompare.com/api/cards"
CARD_API = "https://riftcompare.com/api/card/"
HEADERS = {
    "User-Agent": "riftbound-archive/1.0",
    "Accept": "application/json",
}


def fetch_json(url: str) -> dict:
    request = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.loads(response.read().decode("utf-8"))


def fetch_page(page: int) -> list[dict]:
    return fetch_json(f"{LIST_API}?page={page}").get("cards") or []


def catalog_code(set_code: str, collector: str) -> str:
    number = str(collector or "").upper().replace(" ", "")
    prefix = str(set_code or "").upper()
    if number.startswith(f"{prefix}-"):
        return number
    return f"{prefix}-{number}"


def is_promo_code(code: str) -> bool:
    return bool("B/" in code or code.endswith("B") or "PROMO" in code)


def match_card(by_code: dict[str, dict], row: dict) -> dict | None:
    code = catalog_code(row.get("setCode") or "", row.get("collectorNumber") or "")
    card = by_code.get(code)
    if not card:
        return None
    if row.get("isPromo") and not is_promo_code(card.get("code") or ""):
        return None
    return card


def tcgplayer_listing(detail: dict) -> dict | None:
    rows = [row for row in (detail.get("retailerPrices") or []) if row.get("retailer") == "tcgplayer"]
    if not rows:
        return None
    in_stock = [row for row in rows if row.get("inStock")]
    pick = in_stock[0] if in_stock else rows[0]
    cents = pick.get("priceCents")
    if cents is None:
        return None
    return {
        "usdCents": int(cents),
        "tcgplayer": pick.get("url") or "https://www.tcgplayer.com/search/riftbound/product",
    }


def load_matches() -> dict[str, dict]:
    catalog = json.loads(CATALOG.read_text(encoding="utf-8"))
    by_code = {(card.get("code") or "").upper(): card for card in catalog.get("cards") or []}
    matches: dict[str, dict] = {}
    page = 1
    while page <= 80:
        rows = fetch_page(page)
        if not rows:
            break
        for row in rows:
            card = match_card(by_code, row)
            slug = row.get("slug")
            if not card or not slug:
                continue
            matches[card["id"]] = {
                "slug": slug,
                "name": card.get("name") or "",
                "code": card.get("code") or "",
            }
        page += 1
        time.sleep(0.12)
    return matches


def fetch_tcgplayer(slug: str) -> dict | None:
    try:
        return tcgplayer_listing(fetch_json(CARD_API + urllib.parse.quote(slug)))
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, ValueError):
        return None


def load_prices() -> dict:
    matches = load_matches()
    mapped: dict[str, dict] = {}
    slugs = [(card_id, meta["slug"]) for card_id, meta in matches.items()]

    with ThreadPoolExecutor(max_workers=8) as pool:
        pending = {pool.submit(fetch_tcgplayer, slug): card_id for card_id, slug in slugs}
        for future in as_completed(pending):
            card_id = pending[future]
            meta = matches[card_id]
            listing = future.result()
            mapped[card_id] = {
                "usdCents": None if listing is None else listing["usdCents"],
                "tcgplayer": None if listing is None else listing["tcgplayer"],
                "riftcompare": f"https://riftcompare.com/card/{meta['slug']}",
            }

    priced = sum(1 for row in mapped.values() if row.get("usdCents") is not None)
    return {
        "source": "TCGplayer live listing on RiftCompare (US, Near Mint). Not Cardmarket and not the cheapest EU shop.",
        "currency": "USD",
        "fetchedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "cards": mapped,
        "matched": len(mapped),
        "priced": priced,
    }


def write_prices() -> dict:
    payload = load_prices()
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return payload


def main() -> None:
    payload = write_prices()
    print(
        f"Wrote {payload['priced']} TCGplayer prices for {payload['matched']} catalog cards "
        f"to {OUT_PATH.relative_to(ROOT)}"
    )


if __name__ == "__main__":
    main()
