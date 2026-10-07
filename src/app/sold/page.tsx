'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Sale {
  id: number;
  inventoryId: number;
  cardName: string;
  cardCode: string;
  qty: number;
  costBasisSek: number;
  salePriceSek: number;
  platform: string;
  platformFeesSek: number;
  shippingSek: number;
  profitSek: number;
  soldAt: string;
  buyerNotes?: string;
}

export default function SoldPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSales();
  }, []);

  async function loadSales() {
    try {
      const res = await fetch('/api/v1/sales');
      if (res.ok) {
        const data = await res.json();
        setSales(data.sales || []);
      }
    } catch (error) {
      console.error('Failed to load sales:', error);
    } finally {
      setLoading(false);
    }
  }

  const totalRevenue = sales.reduce((sum, s) => sum + s.salePriceSek, 0);
  const totalProfit = sales.reduce((sum, s) => sum + s.profitSek, 0);
  const totalCost = sales.reduce((sum, s) => sum + s.costBasisSek * s.qty, 0);

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
                <Link href="/purchases" className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium">
                  Purchases
                </Link>
                <Link href="/deals" className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium">
                  Deals
                </Link>
                <Link href="/sold" className="border-indigo-500 text-gray-900 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium">
                  Sold
                </Link>
                <Link href="/settings" className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium">
                  Settings
                </Link>
              </div>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-3xl font-bold text-gray-900">Sold Items</h2>
            <div className="text-right text-sm">
              <div className="text-gray-500">Total Revenue: <span className="font-semibold text-gray-900">{totalRevenue.toFixed(2)} SEK</span></div>
              <div className="text-gray-500">Total Cost: <span className="font-semibold text-gray-900">{totalCost.toFixed(2)} SEK</span></div>
              <div className={`text-lg font-bold ${totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                Profit: {totalProfit.toFixed(2)} SEK
              </div>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
              <p className="mt-2 text-gray-500">Loading sales...</p>
            </div>
          ) : sales.length === 0 ? (
            <div className="bg-white shadow overflow-hidden sm:rounded-lg p-6 text-center">
              <p className="text-gray-500">No sales recorded yet.</p>
              <p className="text-sm text-gray-400 mt-2">Record sales from your inventory to track profits.</p>
            </div>
          ) : (
            <div className="bg-white shadow overflow-hidden sm:rounded-lg">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Card</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Platform</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Qty</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Cost</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Sale Price</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Fees</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Profit</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sold</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {sales.map((sale) => (
                    <tr key={sale.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{sale.cardName}</div>
                        <div className="text-sm text-gray-500">{sale.cardCode}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{sale.platform}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">{sale.qty}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">{(sale.costBasisSek * sale.qty).toFixed(2)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">{sale.salePriceSek.toFixed(2)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">{(sale.platformFeesSek + sale.shippingSek).toFixed(2)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                        <span className={`font-semibold ${sale.profitSek >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {sale.profitSek.toFixed(2)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(sale.soldAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
