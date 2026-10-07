import httpx
from typing import List, Dict


class AquitazScraper:
    """Aquitaz.se scraper - currently stubbed"""
    
    def __init__(self):
        self.base_url = "https://aquitaz.se"
    
    async def search_riftbound(self) -> List[Dict]:
        raise NotImplementedError("Aquitaz scraper not yet implemented. Check aquitaz.se for Riftbound collections manually.")


class TCGPlayerScraper:
    """TCGPlayer scraper - currently stubbed due to US shipping complexity"""
    
    def __init__(self):
        self.base_url = "https://www.tcgplayer.com"
    
    async def search_riftbound(self) -> List[Dict]:
        raise NotImplementedError("TCGPlayer scraper not implemented. Prices available via RiftCompare. Shipping to Sweden must be verified manually.")
