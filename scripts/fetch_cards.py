"""Fetch the official Riftbound card gallery and write a slim catalog JSON."""

from __future__ import annotations

import json
import re
import urllib.request
from html import unescape
from pathlib import Path

GALLERY_URL = "https://playriftbound.com/en-us/card-gallery/"
ROOT = Path(__file__).resolve().parents[1]
OUT_PATH = ROOT / "data" / "cards.json"


def fetch(url: str) -> bytes:
    request = urllib.request.Request(
        url,
        headers={"User-Agent": "riftbound-card-database/1.0"},
    )
    with urllib.request.urlopen(request) as response:
        return response.read()


def nested_get(data, *path, default=None):
    current = data
    for key in path:
        if current is None:
            return default
        if isinstance(current, dict):
            current = current.get(key, default)
        else:
            return default
    return current


def labeled_id(field) -> str | None:
    value = nested_get(field, "value")
    if isinstance(value, dict):
        raw = value.get("id", value.get("label"))
        return None if raw is None else str(raw)
    return None


def labeled_label(field) -> str | None:
    value = nested_get(field, "value")
    if isinstance(value, dict):
        return value.get("label") or (str(value.get("id")) if value.get("id") is not None else None)
    return None


def html_to_text(html: str | None) -> str:
    if not html:
        return ""
    text = re.sub(r"<br\s*/?>", "\n", html, flags=re.I)
    text = re.sub(r"</p\s*>", "\n", text, flags=re.I)
    text = re.sub(r"<[^>]+>", "", text)
    return unescape(re.sub(r"\n{3,}", "\n\n", text)).strip()


def number_or_none(value) -> int | None:
    if value is None or value == "":
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def slim_card(raw: dict) -> dict:
    types = [
        item.get("label") or item.get("id")
        for item in nested_get(raw, "cardType", "type", default=[]) or []
        if item
    ]
    super_types = [
        item.get("label") or item.get("id")
        for item in nested_get(raw, "cardType", "superType", default=[]) or []
        if item
    ]
    domains = [
        item.get("label") or item.get("id")
        for item in nested_get(raw, "domain", "values", default=[]) or []
        if item
    ]
    artists = [
        item.get("label")
        for item in nested_get(raw, "illustrator", "values", default=[]) or []
        if item and item.get("label")
    ]
    text = html_to_text(nested_get(raw, "text", "richText", "body"))
    effect = html_to_text(nested_get(raw, "effect", "richText", "body"))
    image = nested_get(raw, "cardImage", "url") or ""

    return {
        "id": raw.get("id"),
        "name": raw.get("name"),
        "set": nested_get(raw, "set", "value", "id"),
        "setName": nested_get(raw, "set", "value", "label"),
        "code": raw.get("publicCode"),
        "number": raw.get("collectorNumber"),
        "types": types,
        "superTypes": super_types,
        "rarity": labeled_label(raw.get("rarity")) or "",
        "rarityId": labeled_id(raw.get("rarity")) or "",
        "domains": domains,
        "energy": number_or_none(labeled_id(raw.get("energy"))),
        "might": number_or_none(labeled_id(raw.get("might"))),
        "power": number_or_none(labeled_id(raw.get("power"))),
        "mightBonus": labeled_label(raw.get("mightBonus")),
        "tags": nested_get(raw, "tags", "tags", default=[]) or [],
        "text": text,
        "effect": effect,
        "image": image,
        "orientation": raw.get("orientation") or "portrait",
        "illustrator": artists,
    }


def main() -> None:
    html = fetch(GALLERY_URL).decode("utf-8", "ignore")
    match = re.search(r"/_next/static/([^/]+)/_buildManifest\.js", html)
    if not match:
        raise SystemExit("Could not find Next.js build id on the official gallery.")

    build_id = match.group(1)
    payload = json.loads(
        fetch(f"https://playriftbound.com/_next/data/{build_id}/en-us/card-gallery.json")
    )
    blades = nested_get(payload, "pageProps", "page", "blades", default=[]) or []
    gallery = next((blade for blade in blades if blade.get("type") == "riftboundCardGallery"), None)
    if not gallery:
        raise SystemExit("Official gallery blade was not found in the page data.")

    cards = [slim_card(item) for item in nested_get(gallery, "cards", "items", default=[]) or []]
    sets = [
        {"id": item.get("id"), "name": item.get("name"), "max": item.get("collectorNumberMax")}
        for item in nested_get(gallery, "sets", "items", default=[]) or []
    ]

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(
        json.dumps({"source": GALLERY_URL, "buildId": build_id, "sets": sets, "cards": cards}, ensure_ascii=False),
        encoding="utf-8",
    )
    print(f"Wrote {len(cards)} cards to {OUT_PATH.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
