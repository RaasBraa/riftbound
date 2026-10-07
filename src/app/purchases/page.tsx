'use client';

import { useState, useEffect } from 'react';
import { AppShell } from '@/components/AppShell';
import { PageHeader } from '@/components/PageHeader';
import { Spinner } from '@/components/Spinner';
import { EmptyState } from '@/components/EmptyState';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Modal } from '@/components/Modal';
import { useToast } from '@/components/Toast';
import { apiJson, parseNonNegative } from '@/lib/api';

interface PurchaseItem {
  cardId: string;
  cardName: string;
  cardCode: string;
  qty: number;
  condition: string;
  pricePerCardSek: number;
}

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

interface Card {
  id: string;
  name: string;
  code: string;
  set: string;
}

const emptyItem = (): PurchaseItem => ({
  cardId: '',
  cardName: '',
  cardCode: '',
  qty: 1,
  condition: 'NM',
  pricePerCardSek: 0,
});

export default function PurchasesPage() {
  const { toast } = useToast();
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [cards, setCards] = useState<Card[]>([]);
  const [formData, setFormData] = useState({
    vendor: '',
    source: '',
    sourceUrl: '',
    shippingSek: 30,
    feesSek: 0,
    notes: '',
  });
  const [items, setItems] = useState<PurchaseItem[]>([emptyItem()]);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<Card[]>([]);
  const [activeItemIndex, setActiveItemIndex] = useState<number | null>(null);
  const [edit, setEdit] = useState<Purchase | null>(null);
  const [editForm, setEditForm] = useState({ vendor: '', notes: '', shippingSek: 0, feesSek: 0 });
  const [remove, setRemove] = useState<Purchase | null>(null);

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
      const data = await apiJson<{ purchases: Purchase[] }>('/api/v1/purchases');
      setPurchases(data.purchases || []);
    } catch (error) {
      toast('error', error instanceof Error ? error.message : 'API unavailable at :8000');
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
    setSearchResults(
      cards
        .filter(
          (card) =>
            card.name.toLowerCase().includes(term.toLowerCase()) ||
            card.code.toLowerCase().includes(term.toLowerCase())
        )
        .slice(0, 10)
    );
  }

  function selectCard(card: Card, itemIndex: number) {
    const next = [...items];
    next[itemIndex] = { ...next[itemIndex], cardId: card.id, cardName: card.name, cardCode: card.code };
    setItems(next);
    setSearchResults([]);
    setSearchTerm('');
    setActiveItemIndex(null);
  }

  function updateItem(index: number, field: keyof PurchaseItem, value: string | number) {
    const next = [...items];
    next[index] = { ...next[index], [field]: value };
    setItems(next);
  }

  async function submitPurchase() {
    if (!formData.vendor.trim()) {
      toast('error', 'Vendor is required');
      return;
    }
    if (parseNonNegative(formData.shippingSek) === null || parseNonNegative(formData.feesSek) === null) {
      toast('error', 'Shipping and fees cannot be negative');
      return;
    }
    if (items.some((item) => !item.cardId || parseNonNegative(item.pricePerCardSek) === null || item.qty < 1)) {
      toast('error', 'Each line needs a card, qty ≥ 1, and a non-negative price');
      return;
    }
    setSaving(true);
    try {
      await apiJson('/api/v1/purchases', {
        method: 'POST',
        body: JSON.stringify({ ...formData, items }),
      });
      setShowForm(false);
      setFormData({ vendor: '', source: '', sourceUrl: '', shippingSek: 30, feesSek: 0, notes: '' });
      setItems([emptyItem()]);
      toast('success', 'Purchase added');
      await loadPurchases();
    } catch (error) {
      toast('error', error instanceof Error ? error.message : 'Failed to create purchase');
    } finally {
      setSaving(false);
    }
  }

  async function saveEdit() {
    if (!edit) return;
    if (!editForm.vendor.trim()) {
      toast('error', 'Vendor is required');
      return;
    }
    if (parseNonNegative(editForm.shippingSek) === null || parseNonNegative(editForm.feesSek) === null) {
      toast('error', 'Shipping and fees cannot be negative');
      return;
    }
    setSaving(true);
    try {
      await apiJson(`/api/v1/purchases/${edit.id}`, { method: 'PATCH', body: JSON.stringify(editForm) });
      toast('success', 'Purchase updated');
      setEdit(null);
      await loadPurchases();
    } catch (error) {
      toast('error', error instanceof Error ? error.message : 'Failed to update purchase');
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!remove) return;
    setSaving(true);
    try {
      await apiJson(`/api/v1/purchases/${remove.id}`, { method: 'DELETE' });
      toast('success', 'Purchase deleted');
      setRemove(null);
      await loadPurchases();
    } catch (error) {
      toast('error', error instanceof Error ? error.message : 'Failed to delete purchase');
    } finally {
      setSaving(false);
    }
  }

  const totalSpent = purchases.reduce((sum, p) => sum + p.totalCostSek + p.shippingSek + p.feesSek, 0);

  return (
    <AppShell currentPage="Purchases">
      <PageHeader
        title="Purchases"
        subtitle={`Total spent: ${totalSpent.toFixed(2)} SEK`}
        action={
          <button className="btn-primary" onClick={() => setShowForm(!showForm)}>
            {showForm ? 'Cancel' : 'Add Purchase'}
          </button>
        }
      />

      {showForm && (
        <div className="card p-6 mb-6">
          <h3 className="text-lg font-medium mb-4">New Purchase</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 mb-4">
            <div>
              <label className="label">Vendor *</label>
              <input className="input" value={formData.vendor} onChange={(e) => setFormData({ ...formData, vendor: e.target.value })} />
            </div>
            <div>
              <label className="label">Source</label>
              <input className="input" placeholder="Tradera, Cardmarket, etc." value={formData.source} onChange={(e) => setFormData({ ...formData, source: e.target.value })} />
            </div>
            <div>
              <label className="label">Source URL</label>
              <input className="input" type="url" value={formData.sourceUrl} onChange={(e) => setFormData({ ...formData, sourceUrl: e.target.value })} />
            </div>
            <div>
              <label className="label">Shipping (SEK)</label>
              <input className="input" type="number" min="0" value={formData.shippingSek} onChange={(e) => setFormData({ ...formData, shippingSek: parseFloat(e.target.value) })} />
            </div>
            <div>
              <label className="label">Fees (SEK)</label>
              <input className="input" type="number" min="0" value={formData.feesSek} onChange={(e) => setFormData({ ...formData, feesSek: parseFloat(e.target.value) })} />
            </div>
            <div>
              <label className="label">Notes</label>
              <input className="input" value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} />
            </div>
          </div>

          <div className="border-t border-border pt-4">
            <div className="flex justify-between items-center mb-3">
              <h4 className="font-medium">Line Items</h4>
              <button className="btn-ghost" onClick={() => setItems([...items, emptyItem()])}>+ Add Item</button>
            </div>
            {items.map((item, index) => (
              <div key={index} className="mb-4 p-4 border border-border rounded-md relative">
                {items.length > 1 && (
                  <button className="absolute top-2 right-2 text-danger text-sm" onClick={() => setItems(items.filter((_, i) => i !== index))}>Remove</button>
                )}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-5">
                  <div className="sm:col-span-2 relative">
                    <label className="label">Card *</label>
                    <input
                      className="input"
                      placeholder="Search by name or code"
                      value={activeItemIndex === index ? searchTerm : item.cardName || ''}
                      onChange={(e) => searchCards(e.target.value, index)}
                      onFocus={() => {
                        if (item.cardName) {
                          setSearchTerm(item.cardName);
                          searchCards(item.cardName, index);
                        }
                      }}
                    />
                    {activeItemIndex === index && searchResults.length > 0 && (
                      <div className="absolute z-10 mt-1 w-full bg-surface shadow-lg max-h-60 rounded-md overflow-auto border border-border">
                        {searchResults.map((card) => (
                          <button type="button" key={card.id} onClick={() => selectCard(card, index)} className="block w-full text-left px-4 py-2 hover:bg-background">
                            <div className="font-medium">{card.name}</div>
                            <div className="text-sm text-muted">{card.code} • {card.set}</div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="label">Qty *</label>
                    <input className="input" type="number" min="1" value={item.qty} onChange={(e) => updateItem(index, 'qty', parseInt(e.target.value, 10))} />
                  </div>
                  <div>
                    <label className="label">Condition</label>
                    <select className="input" value={item.condition} onChange={(e) => updateItem(index, 'condition', e.target.value)}>
                      <option>NM</option><option>EX</option><option>VG</option><option>G</option><option>P</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">Price/ea (SEK) *</label>
                    <input className="input" type="number" min="0" step="0.01" value={item.pricePerCardSek} onChange={(e) => updateItem(index, 'pricePerCardSek', parseFloat(e.target.value))} />
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-3 mt-4">
            <button className="btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
            <button className="btn-primary" disabled={saving} onClick={submitPurchase}>{saving ? 'Saving...' : 'Create Purchase'}</button>
          </div>
        </div>
      )}

      {loading ? (
        <Spinner label="Loading purchases..." />
      ) : purchases.length === 0 ? (
        <EmptyState title="No purchases yet" body="Record a buy to create inventory lots." cta="Add purchase" href="/purchases" />
      ) : (
        <div className="space-y-4">
          {purchases.map((purchase) => (
            <div key={purchase.id} className="card overflow-hidden">
              <div className="px-4 py-4 border-b border-border flex justify-between gap-3">
                <div>
                  <h3 className="text-lg font-medium">{purchase.vendor}</h3>
                  <p className="text-sm text-muted">
                    {new Date(purchase.purchasedAt).toLocaleDateString()} • {purchase.source}
                    {purchase.sourceUrl && (
                      <> • <a className="text-accent" href={purchase.sourceUrl} target="_blank" rel="noopener noreferrer">View listing</a></>
                    )}
                  </p>
                </div>
                <div className="text-right">
                  <div className="font-semibold">{(purchase.totalCostSek + purchase.shippingSek + purchase.feesSek).toFixed(2)} SEK</div>
                  <div className="mt-2 flex justify-end gap-2">
                    <button
                      className="btn-ghost"
                      onClick={() => {
                        setEdit(purchase);
                        setEditForm({
                          vendor: purchase.vendor,
                          notes: purchase.notes || '',
                          shippingSek: purchase.shippingSek,
                          feesSek: purchase.feesSek,
                        });
                      }}
                    >
                      Edit
                    </button>
                    <button className="btn-ghost text-danger" onClick={() => setRemove(purchase)}>Delete</button>
                  </div>
                </div>
              </div>
              <div className="px-4 py-3 overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-muted">
                      <th className="text-left pb-2">Card</th>
                      <th className="text-left pb-2">Condition</th>
                      <th className="text-right pb-2">Qty</th>
                      <th className="text-right pb-2">Price/ea</th>
                      <th className="text-right pb-2">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {purchase.items.map((item, idx) => (
                      <tr key={idx}>
                        <td className="py-1">{item.cardName} <span className="text-muted">{item.cardCode}</span></td>
                        <td>{item.condition}</td>
                        <td className="text-right">{item.qty}</td>
                        <td className="text-right">{item.pricePerCardSek.toFixed(2)}</td>
                        <td className="text-right">{(item.qty * item.pricePerCardSek).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {purchase.notes && <p className="mt-2 text-sm text-muted"><strong>Notes:</strong> {purchase.notes}</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={!!edit} title="Edit purchase" onClose={() => setEdit(null)}>
        <div className="space-y-3">
          <div>
            <label className="label">Vendor *</label>
            <input className="input" value={editForm.vendor} onChange={(e) => setEditForm({ ...editForm, vendor: e.target.value })} />
          </div>
          <div>
            <label className="label">Shipping (SEK)</label>
            <input className="input" type="number" min="0" value={editForm.shippingSek} onChange={(e) => setEditForm({ ...editForm, shippingSek: parseFloat(e.target.value) })} />
            <p className="helper">Updates cost basis on unsold lots. Blocked if any lot is sold.</p>
          </div>
          <div>
            <label className="label">Fees (SEK)</label>
            <input className="input" type="number" min="0" value={editForm.feesSek} onChange={(e) => setEditForm({ ...editForm, feesSek: parseFloat(e.target.value) })} />
          </div>
          <div>
            <label className="label">Notes</label>
            <input className="input" value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button className="btn-secondary" onClick={() => setEdit(null)}>Cancel</button>
            <button className="btn-primary" disabled={saving} onClick={saveEdit}>{saving ? 'Saving...' : 'Save'}</button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!remove}
        title="Delete purchase?"
        message="This removes the purchase and all unsold inventory lots created from it. Sold lots block deletion."
        busy={saving}
        onCancel={() => setRemove(null)}
        onConfirm={confirmDelete}
      />
    </AppShell>
  );
}
