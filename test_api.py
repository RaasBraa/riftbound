#!/usr/bin/env python3
"""
Test script for Riftbound Business Platform API
Tests the complete workflow: purchase → inventory → sale, plus edit/delete cascades.
Ollama live matching is skipped (demo scan only).
"""

import asyncio
import httpx
import sys
from datetime import datetime

BASE_URL = "http://127.0.0.1:8000/api/v1"


async def test_api():
    async with httpx.AsyncClient(timeout=30.0) as client:
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
        assert "ollamaEnabled" in settings
        assert "minMatchConfidence" in settings
        print(f"   ✓ Demo mode: {settings['demoMode']}")
        print(f"   ✓ Ollama enabled: {settings['ollamaEnabled']}")

        print("\n3. Getting initial stats...")
        resp = await client.get(f"{BASE_URL}/stats")
        assert resp.status_code == 200
        initial_stats = resp.json()
        print(f"   ✓ Total invested: {initial_stats['totalInvestedSek']} SEK")
        print(f"   ✓ Realized profit: {initial_stats['realizedProfitSek']} SEK")

        stamp = datetime.utcnow().isoformat()
        print("\n4. Creating a test purchase...")
        purchase_data = {
            "vendor": f"Test Vendor {stamp}",
            "source": "Test Source",
            "sourceUrl": "https://example.com/item/123",
            "shippingSek": 30.0,
            "feesSek": 5.0,
            "purchasedAt": stamp,
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

        print("\n5. GET one purchase...")
        resp = await client.get(f"{BASE_URL}/purchases/{purchase_id}")
        assert resp.status_code == 200
        one = resp.json()
        assert one["id"] == purchase_id
        assert one["vendor"] == purchase_data["vendor"]
        print("   ✓ Purchase fetched")

        print("\n6. Checking inventory...")
        resp = await client.get(f"{BASE_URL}/inventory")
        assert resp.status_code == 200
        inventory = resp.json()
        lot = next((item for item in inventory["lots"] if item.get("purchaseId") == purchase_id), None)
        assert lot, "No inventory lot linked to purchase"
        lot_id = lot["id"]
        print(f"   ✓ Inventory lot created: ID {lot_id}")
        print(f"   ✓ Card: {lot['cardName']} ({lot['cardCode']})")
        print(f"   ✓ Cost basis: {lot['costBasisSek']} SEK")
        print(f"   ✓ Status: {lot['status']}")

        print("\n7. PATCH purchase shipping (unsold)...")
        resp = await client.patch(
            f"{BASE_URL}/purchases/{purchase_id}",
            json={"shippingSek": 40.0, "notes": "updated notes"},
        )
        assert resp.status_code == 200, resp.text
        patched = resp.json()
        assert patched["shippingSek"] == 40.0
        resp = await client.get(f"{BASE_URL}/inventory")
        lot = next(item for item in resp.json()["lots"] if item["id"] == lot_id)
        print(f"   ✓ Cost basis after shipping edit: {lot['costBasisSek']} SEK")

        print("\n8. PATCH inventory lot...")
        resp = await client.patch(
            f"{BASE_URL}/inventory/{lot_id}",
            json={"qty": 1, "condition": "EX", "notes": "shelf A", "status": "listed"},
        )
        assert resp.status_code == 200, resp.text
        assert resp.json()["lot"]["condition"] == "EX"
        print("   ✓ Lot edited and listed")

        print("\n9. Creating a sale...")
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
        print("   ✓ Sale created")
        print(f"   ✓ Profit: {sale_result['profitSek']} SEK")

        print("\n10. Checking sales list...")
        resp = await client.get(f"{BASE_URL}/sales")
        assert resp.status_code == 200
        sales = resp.json()
        assert len(sales["sales"]) > 0
        sale_id = next(s["id"] for s in sales["sales"] if s["inventoryId"] == lot_id)
        print(f"   ✓ Found sale ID {sale_id}")

        print("\n11. PATCH sale + live profit...")
        resp = await client.patch(
            f"{BASE_URL}/sales/{sale_id}",
            json={"salePriceSek": 130.0, "platformFeesSek": 10.0, "shippingSek": 10.0},
        )
        assert resp.status_code == 200, resp.text
        updated_sale = resp.json()["sale"]
        expected_profit = 130.0 - 10.0 - 10.0 - lot["costBasisSek"] * lot["qty"]
        assert abs(updated_sale["profitSek"] - expected_profit) < 0.01
        print(f"   ✓ Recalculated profit: {updated_sale['profitSek']} SEK")

        print("\n12. 409 when deleting purchase with sold lot...")
        resp = await client.delete(f"{BASE_URL}/purchases/{purchase_id}")
        assert resp.status_code == 409
        resp = await client.delete(f"{BASE_URL}/inventory/{lot_id}")
        assert resp.status_code == 409
        print("   ✓ Sold lot blocks purchase and lot delete")

        print("\n13. DELETE sale reverts lot...")
        resp = await client.delete(f"{BASE_URL}/sales/{sale_id}")
        assert resp.status_code == 200
        resp = await client.get(f"{BASE_URL}/inventory")
        lot = next(item for item in resp.json()["lots"] if item["id"] == lot_id)
        assert lot["status"] == "owned"
        resp = await client.delete(f"{BASE_URL}/sales/{sale_id}")
        assert resp.status_code == 200
        print("   ✓ Lot owned again; delete is idempotent")

        print("\n14. DELETE unsold purchase cascades lots...")
        resp = await client.delete(f"{BASE_URL}/purchases/{purchase_id}")
        assert resp.status_code == 200, resp.text
        resp = await client.get(f"{BASE_URL}/purchases/{purchase_id}")
        assert resp.status_code == 404
        resp = await client.get(f"{BASE_URL}/inventory")
        assert all(item["id"] != lot_id for item in resp.json()["lots"])
        resp = await client.delete(f"{BASE_URL}/purchases/{purchase_id}")
        assert resp.status_code == 200
        print("   ✓ Purchase and lot gone")

        print("\n15. Demo scan + delete deals (no Ollama)...")
        resp = await client.post(f"{BASE_URL}/deals/scan")
        assert resp.status_code == 200, resp.text
        assert resp.json()["mode"] == "demo"
        resp = await client.get(f"{BASE_URL}/deals")
        deals = resp.json()["deals"]
        assert len(deals) >= 1
        deal_id = deals[0]["id"]
        resp = await client.delete(f"{BASE_URL}/deals/{deal_id}")
        assert resp.status_code == 200
        resp = await client.delete(f"{BASE_URL}/deals")
        assert resp.status_code == 200
        resp = await client.get(f"{BASE_URL}/deals")
        assert resp.json()["deals"] == []
        print("   ✓ Deals deleted one and all")

        print("\n16. Checking final stats...")
        resp = await client.get(f"{BASE_URL}/stats")
        assert resp.status_code == 200
        final_stats = resp.json()
        print(f"   ✓ Total invested: {final_stats['totalInvestedSek']} SEK")
        print(f"   ✓ Realized profit: {final_stats['realizedProfitSek']} SEK")
        print(f"   ✓ Sold count: {final_stats['soldCount']}")
        print(f"   ✓ Open deals: {final_stats['openDealsCount']}")

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
