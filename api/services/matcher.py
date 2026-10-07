import json
import re
from pathlib import Path
from typing import Optional, Dict, List
from rapidfuzz import fuzz, process

CODE_RE = re.compile(r"\b([A-Za-z]{2,5}-\d{3}[A-Za-z]?)\b")


class CardMatcher:
    def __init__(self, catalog_path: Path):
        self.cards: List[Dict] = []
        self.by_id: Dict[str, Dict] = {}
        self.by_name: Dict[str, List[Dict]] = {}
        self.by_code: Dict[str, Dict] = {}

        if catalog_path.exists():
            data = json.loads(catalog_path.read_text(encoding="utf-8"))
            self.cards = data.get("cards", [])

            for card in self.cards:
                card_id = card.get("id")
                if card_id:
                    self.by_id[card_id] = card

                name = card.get("name", "").lower()
                if name:
                    self.by_name.setdefault(name, []).append(card)

                code = (card.get("code") or "").strip().upper()
                if code:
                    self.by_code[code] = card

    def match_code(self, code: str) -> Optional[Dict]:
        if not code:
            return None
        key = code.strip().upper()
        card = self.by_code.get(key)
        if not card:
            return None
        return {
            "card_id": card["id"],
            "name": card["name"],
            "code": card.get("code", ""),
            "confidence": 1.0,
        }

    def match_text(self, text: str, threshold: float = 0.75) -> Optional[Dict]:
        if not text or not self.cards:
            return None

        text_lower = text.lower()

        for found in CODE_RE.findall(text):
            coded = self.match_code(found)
            if coded:
                return coded

        for name, cards in self.by_name.items():
            if name in text_lower:
                return {
                    "card_id": cards[0]["id"],
                    "name": cards[0]["name"],
                    "code": cards[0].get("code", ""),
                    "confidence": 0.95,
                }

        card_names = [(card["name"], card) for card in self.cards]
        result = process.extractOne(
            text,
            card_names,
            scorer=fuzz.token_set_ratio,
            score_cutoff=threshold * 100,
        )

        if result:
            matched_card = result[0][1]
            confidence = result[1] / 100.0
            return {
                "card_id": matched_card["id"],
                "name": matched_card["name"],
                "code": matched_card.get("code", ""),
                "confidence": confidence,
            }

        return None

    def match_detection(
        self,
        card_name: Optional[str],
        card_code: Optional[str],
        ollama_confidence: float,
        min_confidence: float,
    ) -> Optional[Dict]:
        match = None
        if card_code:
            match = self.match_code(card_code)
        if not match and card_name:
            match = self.match_text(card_name, threshold=min_confidence)
        if not match:
            return None
        combined = min(1.0, (match["confidence"] + max(0.0, ollama_confidence)) / 2)
        if combined < min_confidence:
            return None
        match["confidence"] = combined
        return match

    def match_image(self, image_url: str) -> Optional[Dict]:
        return None
