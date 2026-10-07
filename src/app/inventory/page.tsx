'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface InventoryLot {
  id: number;
  cardId: string;
  cardName: string;
  cardCode: string;
  qty: number;
  condition: string;
  costBasisSek: number;
  purchasedAt: string;
  status: 'owned' | 'listed' | 'sold' | 'reserved';
  source?: string;
}

export default function InventoryPage() {
  const [inventory, setInventory] = useState<InventoryLot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showSaleModal, setShowSaleModal] = useState(false);
  const [selectedLot, setSelectedLot] = useState<InventoryLot | null>(null);
  
  const [saleData, setSaleData] = useState({
    salePriceSek: 0,
    platform: 'Cardmarket',
    platformFeesSek: 0,
    shippingSek: 0,
    buyerNotes: '',
  });

  useEffect(() => {
    loadInventory();
  }, []);

  async function loadInventory() {
    try {
      const res = await fetch('/api/v1/inventory');
      if (res.ok) {
        const data = await res.json();
        setInventory(data.lots || []);
        setError('');
      } else {
        setError('API unavailable. Check that the backend is running.');
      }
    } catch (error) {
      setError('API unavailable. Check that the backend is running at :8000');
    } finally {
      setLoading(false);
    }
  }

  async function updateStatus(lotId: number, newStatus: string) {
    try {
      const res = await fetch(`/api/v1/inventory/${lotId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (res.ok) {
        await loadInventory();
        setError('');
      } else {
        const data = await res.json();
        setError(data.detail || 'Failed to update status');
      }
    } catch (error) {
      setError('API error: ' + error);
    }
  }

  function openSaleModal(lot: InventoryLot) {
    setSelectedLot(lot);
    setSaleData({
      salePriceSek: 0,
      platform: 'Cardmarket',
      platformFeesSek: 0,
      shippingSek: 0,
      buyerNotes: '',
    });
    setShowSaleModal(true);
  }

  async function submitSale() {
    if (!selectedLot || saleData.salePriceSek <= 0) {
      setError('Please enter a valid sale price');
      return;
    }

    try {
      const res = await fetch('/api/v1/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inventoryId: selectedLot.id,
          ...saleData,
        }),
      });

      if (res.ok) {
        setShowSaleModal(false);
        setSelectedLot(null);
        await loadInventory();
        setError('');
      } else {
        const data = await res.json();
        setError(data.detail || 'Failed to record sale');
      }
    } catch (error) {
      setError('API error: ' + error);
    }
  }

  const statusColors = {
    owned: 'bg-green-100 text-green-800',
    listed: 'bg-blue-100 text-blue-800',
    sold: 'bg-gray-100 text-gray-800',
    reserved: 'bg-yellow-100 text-yellow-800',
  };

  const totalValue = inventory
    .filter((lot) => lot.status === 'owned' || lot.status === 'listed')
    .reduce((sum, lot) => sum + lot.costBasisSek * lot.qty, 0);

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
                <Link href="/" className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium">Dashboard</Link>
                <Link href="/collection" className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium">Collection</Link>
                <Link href="/inventory" className="border-indigo-500 text-gray-900 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium">Inventory</Link>
                <Link href="/purchases" className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium">Purchases</Link>
                <Link href="/deals" className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium">Deals</Link>
                <Link href="/sold" className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium">Sold</Link>
                <Link href="/settings" className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium">Settings</Link>
              </div>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-3xl font-bold text-gray-900">Business Inventory</h2>
            <div className="text-sm text-gray-500">
              Total value: {totalValue.toFixed(2)} SEK
            </div>
          </div>

          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded">
              {error}
            </div>
          )}

          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
              <p className="mt-2 text-gray-500">Loading inventory...</p>
            </div>
          ) : inventory.length === 0 ? (
            <div className="bg-white shadow overflow-hidden sm:rounded-lg p-6 text-center">
              <p className="text-gray-500">No inventory lots yet.</p>
              <p className="text-sm text-gray-400 mt-2">Add purchases to track your business inventory.</p>
            </div>
          ) : (
            <div className="bg-white shadow overflow-hidden sm:rounded-lg">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Card</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Condition</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Qty</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cost Basis</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {inventory.map((lot) => (
                    <tr key={lot.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{lot.cardName}</div>
                        <div className="text-sm text-gray-500">{lot.cardCode}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{lot.condition}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{lot.qty}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{lot.costBasisSek.toFixed(2)} SEK</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusColors[lot.status]}`}>
                          {lot.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        {lot.status === 'owned' && (
                          <button
                            onClick={() => updateStatus(lot.id, 'listed')}
                            className="text-indigo-600 hover:text-indigo-900 mr-3"
                          >
                            Mark Listed
                          </button>
                        )}
                        {(lot.status === 'owned' || lot.status === 'listed') && (
                          <button
                            onClick={() => openSaleModal(lot)}
                            className="text-green-600 hover:text-green-900"
                          >
                            Record Sale
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Sale Modal */}
      {showSaleModal && selectedLot && (
        <div className="fixed z-10 inset-0 overflow-y-auto">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setShowSaleModal(false)}></div>

            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                  Record Sale
                </h3>
                <div className="mb-4 p-3 bg-gray-50 rounded">
                  <div className="text-sm font-medium text-gray-900">{selectedLot.cardName}</div>
                  <div className="text-sm text-gray-500">{selectedLot.cardCode} • {selectedLot.qty}x • {selectedLot.condition}</div>
                  <div className="text-sm text-gray-500">Cost basis: {(selectedLot.costBasisSek * selectedLot.qty).toFixed(2)} SEK</div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Sale Price (SEK) *</label>
                    <input
                      type="number"
                      step="0.01"
                      value={saleData.salePriceSek}
                      onChange={(e) => setSaleData({ ...saleData, salePriceSek: parseFloat(e.target.value) })}
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Platform</label>
                    <select
                      value={saleData.platform}
                      onChange={(e) => setSaleData({ ...saleData, platform: e.target.value })}
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3"
                    >
                      <option>Cardmarket</option>
                      <option>Tradera</option>
                      <option>Facebook</option>
                      <option>Local</option>
                      <option>Other</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Platform Fees (SEK)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={saleData.platformFeesSek}
                      onChange={(e) => setSaleData({ ...saleData, platformFeesSek: parseFloat(e.target.value) })}
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Shipping (SEK)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={saleData.shippingSek}
                      onChange={(e) => setSaleData({ ...saleData, shippingSek: parseFloat(e.target.value) })}
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Buyer Notes</label>
                    <textarea
                      value={saleData.buyerNotes}
                      onChange={(e) => setSaleData({ ...saleData, buyerNotes: e.target.value })}
                      rows={2}
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3"
                    />
                  </div>

                  {saleData.salePriceSek > 0 && (
                    <div className="p-3 bg-blue-50 rounded">
                      <div className="text-sm text-gray-700">
                        <div className="flex justify-between">
                          <span>Sale price:</span>
                          <span className="font-medium">{saleData.salePriceSek.toFixed(2)} SEK</span>
                        </div>
                        <div className="flex justify-between">
                          <span>- Platform fees:</span>
                          <span>{saleData.platformFeesSek.toFixed(2)} SEK</span>
                        </div>
                        <div className="flex justify-between">
                          <span>- Shipping:</span>
                          <span>{saleData.shippingSek.toFixed(2)} SEK</span>
                        </div>
                        <div className="flex justify-between">
                          <span>- Cost basis:</span>
                          <span>{(selectedLot.costBasisSek * selectedLot.qty).toFixed(2)} SEK</span>
                        </div>
                        <div className="flex justify-between font-semibold text-gray-900 border-t mt-2 pt-2">
                          <span>Profit:</span>
                          <span className={
                            (saleData.salePriceSek - saleData.platformFeesSek - saleData.shippingSek - (selectedLot.costBasisSek * selectedLot.qty)) >= 0
                              ? 'text-green-600'
                              : 'text-red-600'
                          }>
                            {(saleData.salePriceSek - saleData.platformFeesSek - saleData.shippingSek - (selectedLot.costBasisSek * selectedLot.qty)).toFixed(2)} SEK
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  onClick={submitSale}
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-green-600 text-base font-medium text-white hover:bg-green-700 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  Record Sale
                </button>
                <button
                  onClick={() => setShowSaleModal(false)}
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
