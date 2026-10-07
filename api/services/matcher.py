import json
from pathlib import Path
from typing import Optional, Dict, List
from rapidfuzz import fuzz, process


class CardMatcher:
    def __init__(self, catalog_path: Path):
        self.cards: List[Dict] = []
        self.by_id: Dict[str, Dict] = {}
        self.by_name: Dict[str, List[Dict]] = {}
        
        if catalog_path.exists():
            data = json.loads(catalog_path.read_text(encoding="utf-8"))
            self.cards = data.get("cards", [])
            
            for card in self.cards:
                card_id = card.get("id")
                if card_id:
                    self.by_id[card_id] = card
                
                name = card.get("name", "").lower()
                if name:
                    if name not in self.by_name:
                        self.by_name[name] = []
                    self.by_name[name].append(card)
    
    def match_text(self, text: str, threshold: float = 0.75) -> Optional[Dict]:
        if not text or not self.cards:
            return None
        
        text_lower = text.lower()
        
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
            score_cutoff=threshold * 100
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
    
    def match_image(self, image_url: str) -> Optional[Dict]:
        return None
