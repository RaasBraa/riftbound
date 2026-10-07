'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { PageHeader } from '@/components/PageHeader';
import { Spinner } from '@/components/Spinner';
import { EmptyState } from '@/components/EmptyState';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Modal } from '@/components/Modal';
import { useToast } from '@/components/Toast';
import { apiJson, parseNonNegative } from '@/lib/api';

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
  const { toast } = useToast();
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [edit, setEdit] = useState<Sale | null>(null);
  const [remove, setRemove] = useState<Sale | null>(null);
  const [form, setForm] = useState({
    salePriceSek: 0,
    platformFeesSek: 0,
    shippingSek: 0,
    buyerNotes: '',
  });

  useEffect(() => {
    loadSales();
  }, []);

  async function loadSales() {
    try {
      const data = await apiJson<{ sales: Sale[] }>('/api/v1/sales');
      setSales(data.sales || []);
    } catch (error) {
      toast('error', error instanceof Error ? error.message : 'API unavailable at :8000');
    } finally {
      setLoading(false);
    }
  }

  function liveProfit(sale: Sale, next = form) {
    return next.salePriceSek - next.platformFeesSek - next.shippingSek - sale.costBasisSek * sale.qty;
  }

  async function saveEdit() {
    if (!edit) return;
    if (
      parseNonNegative(form.salePriceSek) === null ||
      parseNonNegative(form.platformFeesSek) === null ||
      parseNonNegative(form.shippingSek) === null
    ) {
      toast('error', 'Money fields cannot be negative');
      return;
    }
    setSaving(true);
    try {
      const data = await apiJson<{ sale: Sale }>(`/api/v1/sales/${edit.id}`, {
        method: 'PATCH',
        body: JSON.stringify(form),
      });
      toast('success', `Sale updated • profit ${data.sale.profitSek.toFixed(2)} SEK`);
      setEdit(null);
      await loadSales();
    } catch (error) {
      toast('error', error instanceof Error ? error.message : 'Failed to update sale');
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!remove) return;
    setSaving(true);
    try {
      await apiJson(`/api/v1/sales/${remove.id}`, { method: 'DELETE' });
      toast('success', 'Sale deleted; lot returned to owned');
      setRemove(null);
      await loadSales();
    } catch (error) {
      toast('error', error instanceof Error ? error.message : 'Failed to delete sale');
    } finally {
      setSaving(false);
    }
  }

  const totalRevenue = sales.reduce((sum, s) => sum + s.salePriceSek, 0);
  const totalProfit = sales.reduce((sum, s) => sum + s.profitSek, 0);

  return (
    <AppShell currentPage="Sold">
      <PageHeader
        title="Sold Items"
        subtitle={`Revenue ${totalRevenue.toFixed(2)} SEK • Profit ${totalProfit.toFixed(2)} SEK`}
      />

      {loading ? (
        <Spinner label="Loading sales..." />
      ) : sales.length === 0 ? (
        <EmptyState title="No sales yet" body="Record a sale from inventory to track profit." href="/inventory" cta="Open inventory" />
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Card</th>
                <th>Platform</th>
                <th className="text-right">Qty</th>
                <th className="text-right">Sale</th>
                <th className="text-right">Fees</th>
                <th className="text-right">Profit</th>
                <th>Sold</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {sales.map((sale) => (
                <tr key={sale.id}>
                  <td>
                    <div className="font-medium">{sale.cardName}</div>
                    <div className="text-xs text-muted">{sale.cardCode}</div>
                  </td>
                  <td>{sale.platform}</td>
                  <td className="text-right">{sale.qty}</td>
                  <td className="text-right">{sale.salePriceSek.toFixed(2)}</td>
                  <td className="text-right">{(sale.platformFeesSek + sale.shippingSek).toFixed(2)}</td>
                  <td className={`text-right font-semibold ${sale.profitSek >= 0 ? 'text-success' : 'text-danger'}`}>
                    {sale.profitSek.toFixed(2)}
                  </td>
                  <td>{new Date(sale.soldAt).toLocaleDateString()}</td>
                  <td className="whitespace-nowrap">
                    <button
                      className="btn-ghost"
                      onClick={() => {
                        setEdit(sale);
                        setForm({
                          salePriceSek: sale.salePriceSek,
                          platformFeesSek: sale.platformFeesSek,
                          shippingSek: sale.shippingSek,
                          buyerNotes: sale.buyerNotes || '',
                        });
                      }}
                    >
                      Edit
                    </button>
                    <button className="btn-ghost text-danger" onClick={() => setRemove(sale)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={!!edit} title="Edit sale" onClose={() => setEdit(null)}>
        {edit && (
          <div className="space-y-3">
            <div>
              <label className="label">Sale price (SEK)</label>
              <input className="input" type="number" min="0" step="0.01" value={form.salePriceSek} onChange={(e) => setForm({ ...form, salePriceSek: parseFloat(e.target.value) })} />
            </div>
            <div>
              <label className="label">Platform fees (SEK)</label>
              <input className="input" type="number" min="0" step="0.01" value={form.platformFeesSek} onChange={(e) => setForm({ ...form, platformFeesSek: parseFloat(e.target.value) })} />
            </div>
            <div>
              <label className="label">Shipping (SEK)</label>
              <input className="input" type="number" min="0" step="0.01" value={form.shippingSek} onChange={(e) => setForm({ ...form, shippingSek: parseFloat(e.target.value) })} />
            </div>
            <div>
              <label className="label">Notes</label>
              <input className="input" value={form.buyerNotes} onChange={(e) => setForm({ ...form, buyerNotes: e.target.value })} />
            </div>
            <p className={`text-sm font-semibold ${liveProfit(edit) >= 0 ? 'text-success' : 'text-danger'}`}>
              Profit: {liveProfit(edit).toFixed(2)} SEK
            </p>
            <div className="flex justify-end gap-2">
              <button className="btn-secondary" onClick={() => setEdit(null)}>Cancel</button>
              <button className="btn-primary" disabled={saving} onClick={saveEdit}>{saving ? 'Saving...' : 'Save'}</button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!remove}
        title="Delete sale?"
        message="The inventory lot returns to owned so you can list or sell it again."
        busy={saving}
        onCancel={() => setRemove(null)}
        onConfirm={confirmDelete}
      />
    </AppShell>
  );
}
