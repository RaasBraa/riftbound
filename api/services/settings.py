import json
from pathlib import Path
from typing import Dict, Any

ROOT = Path(__file__).resolve().parents[2]
SETTINGS_PATH = ROOT / "data" / "settings.json"

DEFAULT_SETTINGS = {
    "demo_mode": True,
    "min_profit_sek": 20.0,
    "default_shipping_sek": 30.0,
    "cardmarket_fee_percent": 10.0,
    "tradera_fee_percent": 8.0,
    "ask_to_sold_factor": 0.9,
}


def load_settings() -> Dict[str, Any]:
    if SETTINGS_PATH.exists():
        try:
            return {**DEFAULT_SETTINGS, **json.loads(SETTINGS_PATH.read_text(encoding="utf-8"))}
        except (json.JSONDecodeError, IOError):
            pass
    return DEFAULT_SETTINGS.copy()


def save_settings(settings: Dict[str, Any]) -> None:
    SETTINGS_PATH.parent.mkdir(parents=True, exist_ok=True)
    SETTINGS_PATH.write_text(json.dumps(settings, indent=2), encoding="utf-8")


def get_setting(key: str, default=None):
    settings = load_settings()
    return settings.get(key, default)
