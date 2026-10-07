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
    "ollama_base_url": "http://127.0.0.1:11434",
    "ollama_text_model": "llama3.2",
    "ollama_vision_model": "llava",
    "ollama_enabled": False,
    "min_match_confidence": 0.55,
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
    merged = {**load_settings(), **settings}
    SETTINGS_PATH.write_text(json.dumps(merged, indent=2), encoding="utf-8")


def get_setting(key: str, default=None):
    settings = load_settings()
    return settings.get(key, default)


def settings_public(settings: Dict[str, Any] | None = None) -> Dict[str, Any]:
    s = settings or load_settings()
    return {
        "demoMode": bool(s.get("demo_mode", True)),
        "minProfitSek": float(s.get("min_profit_sek", 20.0)),
        "defaultShippingSek": float(s.get("default_shipping_sek", 30.0)),
        "cardmarketFeePercent": float(s.get("cardmarket_fee_percent", 10.0)),
        "traderaFeePercent": float(s.get("tradera_fee_percent", 8.0)),
        "askToSoldFactor": float(s.get("ask_to_sold_factor", 0.9)),
        "ollamaBaseUrl": s.get("ollama_base_url", "http://127.0.0.1:11434"),
        "ollamaTextModel": s.get("ollama_text_model", "llama3.2"),
        "ollamaVisionModel": s.get("ollama_vision_model", "llava"),
        "ollamaEnabled": bool(s.get("ollama_enabled", False)),
        "minMatchConfidence": float(s.get("min_match_confidence", 0.55)),
    }
