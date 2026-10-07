import httpx
from typing import Dict, List
from bs4 import BeautifulSoup


class CardmarketScraper:
    def __init__(self):
        self.base_url = "https://www.cardmarket.com"
        self.headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        }
    
    async def get_en_prices(self) -> Dict[str, Dict]:
        return {}
    
    async def search_listings(self, query: str = "", english_only: bool = True) -> List[Dict]:
        return []
