#!/usr/bin/env python3
"""
Test script for Riftbound Business Platform API
Tests the complete workflow: purchase → inventory → sale
"""

import asyncio
import httpx
import sys
from datetime import datetime

BASE_URL = "http://127.0.0.1:8000/api/v1"


async def test_api():
    async with httpx.AsyncClient() as client:
        print("🧪 Testing Riftbound Business Platform API")
        print("=" * 60)
        
        print("\n1. Health check...")
        resp = await client.get(f"{BASE_URL}/health")
        assert resp.status_code == 200, f"Health check failed: {resp.status_code}"
        print("   ✓ API is healthy")
        
        print("\n2. Getting settings...")
        resp = await client.get(f"{BASE_URL}/settings")
        assert resp.status_code == 200
        settings = resp.json()
        print(f"   ✓ Demo mode: {settings['demoMode']}")
        
        print("\n3. Getting initial stats...")
        resp = await client.get(f"{BASE_URL}/stats")
        assert resp.status_code == 200
        initial_stats = resp.json()
        print(f"   ✓ Total invested: {initial_stats['totalInvestedSek']} SEK")
        print(f"   ✓ Realized profit: {initial_stats['realizedProfitSek']} SEK")
        
        print("\n4. Creating a test purchase...")
        purchase_data = {
            "vendor": "Test Vendor",
            "source": "Test Source",
            "sourceUrl": "https://example.com/item/123",
            "shippingSek": 30.0,
            "feesSek": 5.0,
            "purchasedAt": datetime.utcnow().isoformat(),
            "notes": "Test purchase from integration test",
            "items": [
                {
                    "cardId": "sfd-001-221",
                    "cardName": "Aatrox, World Ender",
                    "cardCode": "SFD-001",
                    "qty": 1,
                    "condition": "NM",
                    "pricePerCardSek": 45.0
                }
            ]
        }
        resp = await client.post(f"{BASE_URL}/purchases", json=purchase_data)
        assert resp.status_code == 200, f"Purchase creation failed: {resp.text}"
        purchase_result = resp.json()
        purchase_id = purchase_result["purchaseId"]
        print(f"   ✓ Purchase created: ID {purchase_id}")
        
        print("\n5. Checking inventory...")
        resp = await client.get(f"{BASE_URL}/inventory")
        assert resp.status_code == 200
        inventory = resp.json()
        assert len(inventory["lots"]) > 0, "No inventory lots found"
        lot = inventory["lots"][0]
        lot_id = lot["id"]
        print(f"   ✓ Inventory lot created: ID {lot_id}")
        print(f"   ✓ Card: {lot['cardName']} ({lot['cardCode']})")
        print(f"   ✓ Cost basis: {lot['costBasisSek']} SEK")
        print(f"   ✓ Status: {lot['status']}")
        
        print("\n6. Marking lot as listed...")
        resp = await client.patch(f"{BASE_URL}/inventory/{lot_id}", json={"status": "listed"})
        assert resp.status_code == 200
        print("   ✓ Lot marked as listed")
        
        print("\n7. Creating a sale...")
        sale_data = {
            "inventoryId": lot_id,
            "salePriceSek": 120.0,
            "platform": "Cardmarket",
            "platformFeesSek": 12.0,
            "shippingSek": 15.0,
            "soldAt": datetime.utcnow().isoformat(),
            "buyerNotes": "Test sale from integration test"
        }
        resp = await client.post(f"{BASE_URL}/sales", json=sale_data)
        assert resp.status_code == 200
        sale_result = resp.json()
        print(f"   ✓ Sale created")
        print(f"   ✓ Profit: {sale_result['profitSek']} SEK")
        
        print("\n8. Checking sales list...")
        resp = await client.get(f"{BASE_URL}/sales")
        assert resp.status_code == 200
        sales = resp.json()
        assert len(sales["sales"]) > 0
        print(f"   ✓ Found {len(sales['sales'])} sale(s)")
        
        print("\n9. Checking final stats...")
        resp = await client.get(f"{BASE_URL}/stats")
        assert resp.status_code == 200
        final_stats = resp.json()
        print(f"   ✓ Total invested: {final_stats['totalInvestedSek']} SEK")
        print(f"   ✓ Realized profit: {final_stats['realizedProfitSek']} SEK")
        print(f"   ✓ Sold count: {final_stats['soldCount']}")
        
        print("\n" + "=" * 60)
        print("✅ All tests passed!")
        return True


if __name__ == "__main__":
    try:
        result = asyncio.run(test_api())
        sys.exit(0 if result else 1)
    except Exception as e:
        print(f"\n❌ Test failed: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(1)
