import httpx
import asyncio
import re
from typing import List, Dict
from bs4 import BeautifulSoup
from urllib.parse import urlencode, quote


class TraderaScraper:
    def __init__(self):
        self.base_url = "https://www.tradera.com"
        self.headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
            "Accept-Language": "sv-SE,sv;q=0.9,en;q=0.8",
        }
    
    async def search_riftbound(self) -> List[Dict]:
        try:
            query = "riftbound"
            async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
                response = await client.get(
                    f"{self.base_url}/search",
                    params={"q": query},
                    headers=self.headers
                )
                response.raise_for_status()
                
                soup = BeautifulSoup(response.text, 'html.parser')
                listings = []
                
                items = soup.select('.item-card, .search-result-item, article[class*="item"]')
                
                for item in items[:20]:
                    try:
                        title_elem = item.select_one('.item-title, .card-title, h3 a, h2 a')
                        if not title_elem:
                            continue
                        
                        title = title_elem.get_text(strip=True)
                        url = title_elem.get('href', '')
                        if url and not url.startswith('http'):
                            url = self.base_url + url
                        
                        if 'riftbound' not in title.lower():
                            continue
                        
                        price_elem = item.select_one('.item-price, .price, [class*="price"]')
                        price_sek = 0.0
                        if price_elem:
                            price_text = price_elem.get_text(strip=True)
                            match = re.search(r'(\d+(?:[,\s]\d+)*)', price_text.replace(' ', ''))
                            if match:
                                price_sek = float(match.group(1).replace(',', ''))
                        
                        image_elem = item.select_one('img')
                        image_url = None
                        if image_elem:
                            image_url = image_elem.get('src') or image_elem.get('data-src')
                        
                        language_ok = True
                        title_lower = title.lower()
                        if any(lang in title_lower for lang in ['kinesisk', 'fransk', 'fransk', 'tysk', 'spansk', 'italiensk', 'japansk']):
                            language_ok = False
                        
                        listings.append({
                            "title": title,
                            "url": url,
                            "price_sek": price_sek,
                            "shipping_sek": 30.0,
                            "image_url": image_url,
                            "language_ok": language_ok,
                        })
                    except (ValueError, AttributeError, TypeError) as e:
                        continue
                
                await asyncio.sleep(1.5)
                return listings
        except Exception as e:
            print(f"Tradera scraper error: {e}")
            return []
