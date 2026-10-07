'use client';

import { useState, useEffect } from 'react';
import { AppShell } from '@/components/AppShell';
import { PageHeader } from '@/components/PageHeader';
import { Spinner } from '@/components/Spinner';
import { EmptyState } from '@/components/EmptyState';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Modal } from '@/components/Modal';
import { StatusBadge } from '@/components/StatusBadge';
import { useToast } from '@/components/Toast';
import { apiJson, parseNonNegative } from '@/lib/api';

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
  notes?: string;
}

export default function InventoryPage() {
  const { toast } = useToast();
  const [inventory, setInventory] = useState<InventoryLot[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saleLot, setSaleLot] = useState<InventoryLot | null>(null);
  const [editLot, setEditLot] = useState<InventoryLot | null>(null);
  const [removeLot, setRemoveLot] = useState<InventoryLot | null>(null);
  const [saleData, setSaleData] = useState({
    salePriceSek: 0,
    platform: 'Cardmarket',
    platformFeesSek: 0,
    shippingSek: 0,
    buyerNotes: '',
  });
  const [editForm, setEditForm] = useState({
    qty: 1,
    condition: 'NM',
    status: 'owned',
    notes: '',
    costBasisSek: 0,
  });

  useEffect(() => {
    loadInventory();
  }, []);

  async function loadInventory() {
    try {
      const data = await apiJson<{ lots: InventoryLot[] }>('/api/v1/inventory');
      setInventory(data.lots || []);
    } catch (error) {
      toast('error', error instanceof Error ? error.message : 'API unavailable at :8000');
    } finally {
      setLoading(false);
    }
  }

  async function updateStatus(lotId: number, newStatus: string) {
    setSaving(true);
    try {
      await apiJson(`/api/v1/inventory/${lotId}`, { method: 'PATCH', body: JSON.stringify({ status: newStatus }) });
      toast('success', 'Status updated');
      await loadInventory();
    } catch (error) {
      toast('error', error instanceof Error ? error.message : 'Failed to update status');
    } finally {
      setSaving(false);
    }
  }

  async function submitSale() {
    if (!saleLot || parseNonNegative(saleData.salePriceSek) === null || saleData.salePriceSek <= 0) {
      toast('error', 'Enter a valid sale price');
      return;
    }
    if (parseNonNegative(saleData.platformFeesSek) === null || parseNonNegative(saleData.shippingSek) === null) {
      toast('error', 'Fees and shipping cannot be negative');
      return;
    }
    setSaving(true);
    try {
      await apiJson('/api/v1/sales', { method: 'POST', body: JSON.stringify({ inventoryId: saleLot.id, ...saleData }) });
      toast('success', 'Sale recorded');
      setSaleLot(null);
      await loadInventory();
    } catch (error) {
      toast('error', error instanceof Error ? error.message : 'Failed to record sale');
    } finally {
      setSaving(false);
    }
  }

  async function saveEdit() {
    if (!editLot) return;
    if (editForm.qty < 1 || parseNonNegative(editForm.costBasisSek) === null) {
      toast('error', 'Qty must be ≥ 1 and cost cannot be negative');
      return;
    }
    setSaving(true);
    try {
      await apiJson(`/api/v1/inventory/${editLot.id}`, { method: 'PATCH', body: JSON.stringify(editForm) });
      toast('success', 'Lot updated');
      setEditLot(null);
      await loadInventory();
    } catch (error) {
      toast('error', error instanceof Error ? error.message : 'Failed to update lot');
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!removeLot) return;
    setSaving(true);
    try {
      await apiJson(`/api/v1/inventory/${removeLot.id}`, { method: 'DELETE' });
      toast('success', 'Lot deleted');
      setRemoveLot(null);
      await loadInventory();
    } catch (error) {
      toast('error', error instanceof Error ? error.message : 'Failed to delete lot');
    } finally {
      setSaving(false);
    }
  }

  const totalValue = inventory
    .filter((lot) => lot.status === 'owned' || lot.status === 'listed')
    .reduce((sum, lot) => sum + lot.costBasisSek * lot.qty, 0);

  const liveProfit = saleLot
    ? saleData.salePriceSek - saleData.platformFeesSek - saleData.shippingSek - saleLot.costBasisSek * saleLot.qty
    : 0;

  return (
    <AppShell currentPage="Inventory">
      <PageHeader title="Business Inventory" subtitle={`On-hand cost: ${totalValue.toFixed(2)} SEK`} />

      {loading ? (
        <Spinner label="Loading inventory..." />
      ) : inventory.length === 0 ? (
        <EmptyState title="No inventory lots yet" body="Add a purchase to track business stock." href="/purchases" cta="Add purchase" />
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Card</th>
                <th>Condition</th>
                <th>Qty</th>
                <th>Cost Basis</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {inventory.map((lot) => (
                <tr key={lot.id}>
                  <td>
                    <div className="font-medium">{lot.cardName}</div>
                    <div className="text-muted text-xs">{lot.cardCode}</div>
                  </td>
                  <td>{lot.condition}</td>
                  <td>{lot.qty}</td>
                  <td>{lot.costBasisSek.toFixed(2)} SEK</td>
                  <td><StatusBadge status={lot.status} /></td>
                  <td className="space-x-2 whitespace-nowrap">
                    {lot.status === 'owned' && (
                      <button className="btn-ghost" disabled={saving} onClick={() => updateStatus(lot.id, 'listed')}>Mark Listed</button>
                    )}
                    {(lot.status === 'owned' || lot.status === 'listed') && (
                      <button
                        className="btn-ghost"
                        onClick={() => {
                          setSaleLot(lot);
                          setSaleData({ salePriceSek: 0, platform: 'Cardmarket', platformFeesSek: 0, shippingSek: 0, buyerNotes: '' });
                        }}
                      >
                        Record Sale
                      </button>
                    )}
                    {lot.status !== 'sold' && (
                      <>
                        <button
                          className="btn-ghost"
                          onClick={() => {
                            setEditLot(lot);
                            setEditForm({
                              qty: lot.qty,
                              condition: lot.condition,
                              status: lot.status,
                              notes: lot.notes || '',
                              costBasisSek: lot.costBasisSek,
                            });
                          }}
                        >
                          Edit
                        </button>
                        <button className="btn-ghost text-danger" onClick={() => setRemoveLot(lot)}>Delete</button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={!!saleLot} title="Record Sale" onClose={() => setSaleLot(null)}>
        {saleLot && (
          <div className="space-y-3">
            <p className="text-sm text-muted">{saleLot.cardName} • {saleLot.qty}× • cost {(saleLot.costBasisSek * saleLot.qty).toFixed(2)} SEK</p>
            <div>
              <label className="label">Sale Price (SEK) *</label>
              <input className="input" type="number" min="0" step="0.01" value={saleData.salePriceSek} onChange={(e) => setSaleData({ ...saleData, salePriceSek: parseFloat(e.target.value) })} />
            </div>
            <div>
              <label className="label">Platform</label>
              <select className="input" value={saleData.platform} onChange={(e) => setSaleData({ ...saleData, platform: e.target.value })}>
                <option>Cardmarket</option><option>Tradera</option><option>Facebook</option><option>Local</option><option>Other</option>
              </select>
            </div>
            <div>
              <label className="label">Platform Fees (SEK)</label>
              <input className="input" type="number" min="0" step="0.01" value={saleData.platformFeesSek} onChange={(e) => setSaleData({ ...saleData, platformFeesSek: parseFloat(e.target.value) })} />
            </div>
            <div>
              <label className="label">Shipping (SEK)</label>
              <input className="input" type="number" min="0" step="0.01" value={saleData.shippingSek} onChange={(e) => setSaleData({ ...saleData, shippingSek: parseFloat(e.target.value) })} />
            </div>
            <div>
              <label className="label">Buyer Notes</label>
              <textarea className="input" rows={2} value={saleData.buyerNotes} onChange={(e) => setSaleData({ ...saleData, buyerNotes: e.target.value })} />
            </div>
            {saleData.salePriceSek > 0 && (
              <p className={`text-sm font-semibold ${liveProfit >= 0 ? 'text-success' : 'text-danger'}`}>
                Profit: {liveProfit.toFixed(2)} SEK
              </p>
            )}
            <div className="flex justify-end gap-2">
              <button className="btn-secondary" onClick={() => setSaleLot(null)}>Cancel</button>
              <button className="btn-primary" disabled={saving} onClick={submitSale}>{saving ? 'Saving...' : 'Record Sale'}</button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={!!editLot} title="Edit lot" onClose={() => setEditLot(null)}>
        <div className="space-y-3">
          <div>
            <label className="label">Qty</label>
            <input className="input" type="number" min="1" value={editForm.qty} onChange={(e) => setEditForm({ ...editForm, qty: parseInt(e.target.value, 10) })} />
          </div>
          <div>
            <label className="label">Condition</label>
            <select className="input" value={editForm.condition} onChange={(e) => setEditForm({ ...editForm, condition: e.target.value })}>
              <option>NM</option><option>EX</option><option>VG</option><option>G</option><option>P</option>
            </select>
          </div>
          <div>
            <label className="label">Status</label>
            <select className="input" value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}>
              <option value="owned">owned</option>
              <option value="listed">listed</option>
              <option value="reserved">reserved</option>
            </select>
          </div>
          <div>
            <label className="label">Cost basis / card (SEK)</label>
            <input className="input" type="number" min="0" step="0.01" value={editForm.costBasisSek} onChange={(e) => setEditForm({ ...editForm, costBasisSek: parseFloat(e.target.value) })} />
          </div>
          <div>
            <label className="label">Notes</label>
            <input className="input" value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} />
          </div>
          <div className="flex justify-end gap-2">
            <button className="btn-secondary" onClick={() => setEditLot(null)}>Cancel</button>
            <button className="btn-primary" disabled={saving} onClick={saveEdit}>{saving ? 'Saving...' : 'Save'}</button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!removeLot}
        title="Delete lot?"
        message="This removes the inventory lot. Lots with a recorded sale cannot be deleted."
        busy={saving}
        onCancel={() => setRemoveLot(null)}
        onConfirm={confirmDelete}
      />
    </AppShell>
  );
}
