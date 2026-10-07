'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Purchase {
  id: number;
  vendor: string;
  source: string;
  sourceUrl?: string;
  totalCostSek: number;
  shippingSek: number;
  feesSek: number;
  purchasedAt: string;
  notes?: string;
  items: PurchaseItem[];
}

interface PurchaseItem {
  cardId: string;
  cardName: string;
  cardCode: string;
  qty: number;
  condition: string;
  pricePerCardSek: number;
}

export default function PurchasesPage() {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadPurchases() {
      try {
        const res = await fetch('/api/v1/purchases');
        if (res.ok) {
          const data = await res.json();
          setPurchases(data.purchases || []);
        }
      } catch (error) {
        console.error('Failed to load purchases:', error);
      } finally {
        setLoading(false);
      }
    }
    loadPurchases();
  }, []);

  const totalSpent = purchases.reduce((sum, p) => sum + p.totalCostSek + p.shippingSek + p.feesSek, 0);

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center">
                <Link href="/" className="text-xl font-bold text-gray-900">Riftbound Business</Link>
              </div>
              <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                <Link href="/" className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium">
                  Dashboard
                </Link>
                <Link href="/collection" className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium">
                  Collection
                </Link>
                <Link href="/inventory" className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium">
                  Inventory
                </Link>
                <Link href="/purchases" className="border-indigo-500 text-gray-900 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium">
                  Purchases
                </Link>
                <Link href="/deals" className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium">
                  Deals
                </Link>
                <Link href="/gallery" className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium">
                  Gallery
                </Link>
              </div>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-3xl font-bold text-gray-900">Purchases</h2>
            <div className="text-sm text-gray-500">
              Total spent: {totalSpent.toFixed(2)} SEK
            </div>
          </div>

          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
              <p className="mt-2 text-gray-500">Loading purchases...</p>
            </div>
          ) : purchases.length === 0 ? (
            <div className="bg-white shadow overflow-hidden sm:rounded-lg p-6 text-center">
              <p className="text-gray-500">No purchases recorded yet.</p>
              <p className="text-sm text-gray-400 mt-2">Record your card purchases to track inventory and costs.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {purchases.map((purchase) => (
                <div key={purchase.id} className="bg-white shadow overflow-hidden sm:rounded-lg">
                  <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="text-lg leading-6 font-medium text-gray-900">
                          {purchase.vendor}
                        </h3>
                        <p className="mt-1 max-w-2xl text-sm text-gray-500">
                          {new Date(purchase.purchasedAt).toLocaleDateString()} • {purchase.source}
                          {purchase.sourceUrl && (
                            <>
                              {' '}•{' '}
                              <a href={purchase.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:text-indigo-500">
                                View listing
                              </a>
                            </>
                          )}
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-semibold text-gray-900">
                          {(purchase.totalCostSek + purchase.shippingSek + purchase.feesSek).toFixed(2)} SEK
                        </div>
                        <div className="text-xs text-gray-500">
                          {purchase.items.reduce((sum, item) => sum + item.qty, 0)} cards
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="px-4 py-4 sm:px-6">
                    <table className="min-w-full">
                      <thead>
                        <tr className="border-b border-gray-200">
                          <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider pb-2">Card</th>
                          <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider pb-2">Condition</th>
                          <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider pb-2">Qty</th>
                          <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider pb-2">Price/ea</th>
                          <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider pb-2">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {purchase.items.map((item, idx) => (
                          <tr key={idx}>
                            <td className="py-2 text-sm">
                              <div className="font-medium text-gray-900">{item.cardName}</div>
                              <div className="text-gray-500">{item.cardCode}</div>
                            </td>
                            <td className="py-2 text-sm text-gray-500">{item.condition}</td>
                            <td className="py-2 text-sm text-gray-900 text-right">{item.qty}</td>
                            <td className="py-2 text-sm text-gray-900 text-right">{item.pricePerCardSek.toFixed(2)}</td>
                            <td className="py-2 text-sm text-gray-900 text-right">{(item.qty * item.pricePerCardSek).toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="border-t-2 border-gray-300">
                        <tr>
                          <td colSpan={4} className="py-2 text-sm text-gray-500 text-right">Cards subtotal:</td>
                          <td className="py-2 text-sm font-medium text-gray-900 text-right">{purchase.totalCostSek.toFixed(2)}</td>
                        </tr>
                        <tr>
                          <td colSpan={4} className="py-2 text-sm text-gray-500 text-right">Shipping:</td>
                          <td className="py-2 text-sm text-gray-900 text-right">{purchase.shippingSek.toFixed(2)}</td>
                        </tr>
                        <tr>
                          <td colSpan={4} className="py-2 text-sm text-gray-500 text-right">Fees:</td>
                          <td className="py-2 text-sm text-gray-900 text-right">{purchase.feesSek.toFixed(2)}</td>
                        </tr>
                        <tr className="font-semibold">
                          <td colSpan={4} className="py-2 text-sm text-gray-900 text-right">Total:</td>
                          <td className="py-2 text-sm text-gray-900 text-right">
                            {(purchase.totalCostSek + purchase.shippingSek + purchase.feesSek).toFixed(2)} SEK
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                    {purchase.notes && (
                      <div className="mt-3 text-sm text-gray-600">
                        <strong>Notes:</strong> {purchase.notes}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
