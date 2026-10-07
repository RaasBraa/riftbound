import httpx
import asyncio
from typing import Dict, List
from bs4 import BeautifulSoup


class CardmarketScraper:
    def __init__(self):
        self.base_url = "https://www.cardmarket.com"
        self.headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
    
    async def get_en_prices(self) -> Dict[str, Dict]:
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(
                    f"{self.base_url}/en/Riftbound/Products/Singles",
                    headers=self.headers,
                    follow_redirects=True
                )
                response.raise_for_status()
                
                soup = BeautifulSoup(response.text, 'html.parser')
                prices = {}
                
                product_rows = soup.select('.table-body .row, article.product-row')
                
                for row in product_rows:
                    try:
                        name_elem = row.select_one('.product-name, .card-name')
                        if not name_elem:
                            continue
                        
                        name = name_elem.get_text(strip=True)
                        
                        price_elem = row.select_one('.price-container, .price')
                        if not price_elem:
                            continue
                        
                        price_text = price_elem.get_text(strip=True)
                        price_eur = float(price_text.replace('€', '').replace(',', '.').strip())
                        price_sek = price_eur * 11.5
                        
                        prices[name.lower()] = {
                            "low_sek": price_sek,
                            "avg_sek": price_sek * 1.2,
                            "name": name,
                        }
                    except (ValueError, AttributeError):
                        continue
                
                await asyncio.sleep(2.0)
                return prices
        except Exception as e:
            print(f"Cardmarket scraper error: {e}")
            return {}
    
    async def search_listings(self, query: str = "", english_only: bool = True) -> List[Dict]:
        return []
