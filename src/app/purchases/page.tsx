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

interface Card {
  id: string;
  name: string;
  code: string;
  set: string;
}

export default function PurchasesPage() {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [cards, setCards] = useState<Card[]>([]);
  const [error, setError] = useState('');
  
  const [formData, setFormData] = useState({
    vendor: '',
    source: '',
    sourceUrl: '',
    shippingSek: 30,
    feesSek: 0,
    notes: '',
  });
  
  const [items, setItems] = useState<PurchaseItem[]>([{
    cardId: '',
    cardName: '',
    cardCode: '',
    qty: 1,
    condition: 'NM',
    pricePerCardSek: 0,
  }]);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<Card[]>([]);
  const [activeItemIndex, setActiveItemIndex] = useState<number | null>(null);

  useEffect(() => {
    loadPurchases();
    loadCards();
  }, []);

  async function loadCards() {
    try {
      const res = await fetch('/data/cards.json');
      const data = await res.json();
      setCards(data.cards || []);
    } catch (error) {
      console.error('Failed to load cards:', error);
    }
  }

  async function loadPurchases() {
    try {
      const res = await fetch('/api/v1/purchases');
      if (res.ok) {
        const data = await res.json();
        setPurchases(data.purchases || []);
      } else {
        setError('API unavailable. Check that the backend is running.');
      }
    } catch (error) {
      setError('API unavailable. Check that the backend is running at :8000');
    } finally {
      setLoading(false);
    }
  }

  function searchCards(term: string, itemIndex: number) {
    setSearchTerm(term);
    setActiveItemIndex(itemIndex);
    if (term.length < 2) {
      setSearchResults([]);
      return;
    }
    const results = cards
      .filter(card => 
        card.name.toLowerCase().includes(term.toLowerCase()) ||
        card.code.toLowerCase().includes(term.toLowerCase())
      )
      .slice(0, 10);
    setSearchResults(results);
  }

  function selectCard(card: Card, itemIndex: number) {
    const newItems = [...items];
    newItems[itemIndex] = {
      ...newItems[itemIndex],
      cardId: card.id,
      cardName: card.name,
      cardCode: card.code,
    };
    setItems(newItems);
    setSearchResults([]);
    setSearchTerm('');
    setActiveItemIndex(null);
  }

  function addItem() {
    setItems([...items, {
      cardId: '',
      cardName: '',
      cardCode: '',
      qty: 1,
      condition: 'NM',
      pricePerCardSek: 0,
    }]);
  }

  function removeItem(index: number) {
    setItems(items.filter((_, i) => i !== index));
  }

  function updateItem(index: number, field: keyof PurchaseItem, value: any) {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  }

  async function submitPurchase() {
    if (!formData.vendor || items.some(item => !item.cardId || item.pricePerCardSek <= 0)) {
      setError('Please fill in all required fields');
      return;
    }

    try {
      const res = await fetch('/api/v1/purchases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          items: items.map(item => ({
            cardId: item.cardId,
            cardName: item.cardName,
            cardCode: item.cardCode,
            qty: item.qty,
            condition: item.condition,
            pricePerCardSek: item.pricePerCardSek,
          })),
        }),
      });

      if (res.ok) {
        setShowForm(false);
        setFormData({ vendor: '', source: '', sourceUrl: '', shippingSek: 30, feesSek: 0, notes: '' });
        setItems([{ cardId: '', cardName: '', cardCode: '', qty: 1, condition: 'NM', pricePerCardSek: 0 }]);
        await loadPurchases();
        setError('');
      } else {
        const data = await res.json();
        setError(data.detail || 'Failed to create purchase');
      }
    } catch (error) {
      setError('API error: ' + error);
    }
  }

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
                <Link href="/" className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium">Dashboard</Link>
                <Link href="/collection" className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium">Collection</Link>
                <Link href="/inventory" className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium">Inventory</Link>
                <Link href="/purchases" className="border-indigo-500 text-gray-900 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium">Purchases</Link>
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
            <h2 className="text-3xl font-bold text-gray-900">Purchases</h2>
            <div className="flex items-center gap-4">
              <div className="text-sm text-gray-500">Total spent: {totalSpent.toFixed(2)} SEK</div>
              <button
                onClick={() => setShowForm(!showForm)}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700"
              >
                {showForm ? 'Cancel' : 'Add Purchase'}
              </button>
            </div>
          </div>

          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded">
              {error}
            </div>
          )}

          {showForm && (
            <div className="mb-6 bg-white shadow overflow-hidden sm:rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">New Purchase</h3>
              
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Vendor *</label>
                  <input
                    type="text"
                    value={formData.vendor}
                    onChange={(e) => setFormData({ ...formData, vendor: e.target.value })}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Source</label>
                  <input
                    type="text"
                    value={formData.source}
                    onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3"
                    placeholder="Tradera, Cardmarket, etc."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Source URL</label>
                  <input
                    type="url"
                    value={formData.sourceUrl}
                    onChange={(e) => setFormData({ ...formData, sourceUrl: e.target.value })}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Shipping (SEK)</label>
                  <input
                    type="number"
                    value={formData.shippingSek}
                    onChange={(e) => setFormData({ ...formData, shippingSek: parseFloat(e.target.value) })}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Fees (SEK)</label>
                  <input
                    type="number"
                    value={formData.feesSek}
                    onChange={(e) => setFormData({ ...formData, feesSek: parseFloat(e.target.value) })}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Notes</label>
                  <input
                    type="text"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3"
                  />
                </div>
              </div>

              <div className="border-t pt-4 mt-4">
                <div className="flex justify-between items-center mb-3">
                  <h4 className="text-md font-medium text-gray-900">Line Items</h4>
                  <button
                    onClick={addItem}
                    className="text-sm text-indigo-600 hover:text-indigo-500"
                  >
                    + Add Item
                  </button>
                </div>

                {items.map((item, index) => (
                  <div key={index} className="mb-4 p-4 border rounded-md relative">
                    {items.length > 1 && (
                      <button
                        onClick={() => removeItem(index)}
                        className="absolute top-2 right-2 text-red-600 hover:text-red-500 text-sm"
                      >
                        Remove
                      </button>
                    )}
                    
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-5">
                      <div className="sm:col-span-2 relative">
                        <label className="block text-sm font-medium text-gray-700">Card *</label>
                        <input
                          type="text"
                          value={activeItemIndex === index ? searchTerm : item.cardName || ''}
                          onChange={(e) => searchCards(e.target.value, index)}
                          onFocus={() => {
                            if (item.cardName) {
                              setSearchTerm(item.cardName);
                              searchCards(item.cardName, index);
                            }
                          }}
                          placeholder="Search by name or code"
                          className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3"
                        />
                        {activeItemIndex === index && searchResults.length > 0 && (
                          <div className="absolute z-10 mt-1 w-full bg-white shadow-lg max-h-60 rounded-md overflow-auto border">
                            {searchResults.map(card => (
                              <div
                                key={card.id}
                                onClick={() => selectCard(card, index)}
                                className="cursor-pointer px-4 py-2 hover:bg-gray-100"
                              >
                                <div className="font-medium">{card.name}</div>
                                <div className="text-sm text-gray-500">{card.code} • {card.set}</div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Qty *</label>
                        <input
                          type="number"
                          min="1"
                          value={item.qty}
                          onChange={(e) => updateItem(index, 'qty', parseInt(e.target.value))}
                          className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Condition</label>
                        <select
                          value={item.condition}
                          onChange={(e) => updateItem(index, 'condition', e.target.value)}
                          className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3"
                        >
                          <option>NM</option>
                          <option>EX</option>
                          <option>VG</option>
                          <option>G</option>
                          <option>P</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Price/ea (SEK) *</label>
                        <input
                          type="number"
                          step="0.01"
                          value={item.pricePerCardSek}
                          onChange={(e) => updateItem(index, 'pricePerCardSek', parseFloat(e.target.value))}
                          className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3"
                        />
                      </div>
                    </div>
                    {item.cardCode && (
                      <div className="mt-2 text-xs text-gray-500">
                        Selected: {item.cardName} ({item.cardCode})
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={submitPurchase}
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
                >
                  Create Purchase
                </button>
              </div>
            </div>
          )}

          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
              <p className="mt-2 text-gray-500">Loading purchases...</p>
            </div>
          ) : purchases.length === 0 ? (
            <div className="bg-white shadow overflow-hidden sm:rounded-lg p-6 text-center">
              <p className="text-gray-500">No purchases recorded yet.</p>
              <p className="text-sm text-gray-400 mt-2">Click &quot;Add Purchase&quot; to record your first purchase.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {purchases.map((purchase) => (
                <div key={purchase.id} className="bg-white shadow overflow-hidden sm:rounded-lg">
                  <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="text-lg leading-6 font-medium text-gray-900">{purchase.vendor}</h3>
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
