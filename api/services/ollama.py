import base64
import json
import re
from typing import Any, Dict, Optional

import httpx

JSON_FENCE = re.compile(r"```(?:json)?\s*(\{.*?\})\s*```", re.DOTALL)


class OllamaError(Exception):
    pass


class OllamaUnreachable(OllamaError):
    pass


def _parse_json_object(text: str) -> Optional[Dict[str, Any]]:
    if not text:
        return None
    text = text.strip()
    fenced = JSON_FENCE.search(text)
    if fenced:
        text = fenced.group(1)
    try:
        data = json.loads(text)
        return data if isinstance(data, dict) else None
    except json.JSONDecodeError:
        start = text.find("{")
        end = text.rfind("}")
        if start >= 0 and end > start:
            try:
                data = json.loads(text[start : end + 1])
                return data if isinstance(data, dict) else None
            except json.JSONDecodeError:
                return None
        return None


def _normalize_detection(raw: Dict[str, Any]) -> Dict[str, Any]:
    confidence = raw.get("confidence", 0)
    try:
        confidence = float(confidence)
    except (TypeError, ValueError):
        confidence = 0.0
    confidence = max(0.0, min(1.0, confidence))

    language = str(raw.get("language") or "").strip()
    is_english = bool(raw.get("isEnglish"))
    if language.lower() in ("en", "english", "eng"):
        is_english = True

    is_riftbound = bool(raw.get("isRiftbound"))
    card_name = (raw.get("cardName") or "").strip() or None
    card_code = (raw.get("cardCode") or "").strip() or None
    set_name = (raw.get("set") or "").strip() or None
    condition = (raw.get("conditionGuess") or "").strip() or None

    return {
        "cardName": card_name,
        "cardCode": card_code,
        "set": set_name,
        "language": language or ("EN" if is_english else ""),
        "conditionGuess": condition,
        "confidence": confidence,
        "isRiftbound": is_riftbound,
        "isEnglish": is_english,
    }


class OllamaClient:
    def __init__(self, base_url: str, text_model: str, vision_model: str):
        self.base_url = base_url.rstrip("/")
        self.text_model = text_model
        self.vision_model = vision_model

    async def ping(self) -> bool:
        try:
            async with httpx.AsyncClient(timeout=3.0) as client:
                resp = await client.get(f"{self.base_url}/api/tags")
                return resp.status_code == 200
        except httpx.HTTPError:
            return False

    async def _generate(self, payload: Dict[str, Any]) -> str:
        try:
            async with httpx.AsyncClient(timeout=120.0) as client:
                resp = await client.post(f"{self.base_url}/api/generate", json=payload)
                resp.raise_for_status()
                data = resp.json()
                return data.get("response") or ""
        except httpx.HTTPError as exc:
            raise OllamaUnreachable("Ollama unreachable") from exc

    async def _fetch_image_b64(self, image_url: str) -> Optional[str]:
        try:
            async with httpx.AsyncClient(timeout=20.0, follow_redirects=True) as client:
                resp = await client.get(image_url)
                resp.raise_for_status()
                return base64.b64encode(resp.content).decode("ascii")
        except httpx.HTTPError:
            return None

    def _prompt(self, title: str, description: str = "") -> str:
        return (
            "Identify the Riftbound TCG card in this marketplace listing. "
            "English-language singles only. Reply with JSON only, no extra text.\n"
            "Schema: {\"cardName\": string, \"cardCode\": string|null, \"set\": string|null, "
            "\"language\": string, \"conditionGuess\": string|null, \"confidence\": number, "
            "\"isRiftbound\": boolean, \"isEnglish\": boolean}\n"
            f"Title: {title}\n"
            f"Description: {description or '(none)'}\n"
        )

    async def identify_listing(
        self,
        title: str,
        description: str = "",
        image_url: Optional[str] = None,
    ) -> Optional[Dict[str, Any]]:
        payload: Dict[str, Any] = {
            "prompt": self._prompt(title, description),
            "stream": False,
            "format": "json",
        }
        if image_url:
            image_b64 = await self._fetch_image_b64(image_url)
            if image_b64:
                payload["model"] = self.vision_model
                payload["images"] = [image_b64]
            else:
                payload["model"] = self.text_model
        else:
            payload["model"] = self.text_model

        response = await self._generate(payload)
        parsed = _parse_json_object(response)
        if not parsed:
            return None
        return _normalize_detection(parsed)
