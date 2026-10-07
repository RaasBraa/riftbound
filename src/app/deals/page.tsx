'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { PageHeader } from '@/components/PageHeader';
import { Spinner } from '@/components/Spinner';
import { EmptyState } from '@/components/EmptyState';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { useToast } from '@/components/Toast';
import { apiJson } from '@/lib/api';

interface Deal {
  id: number;
  source: string;
  url: string;
  title: string;
  imageUrl?: string;
  detectedCardId?: string;
  detectedCardName?: string;
  detectedCardCode?: string;
  confidence?: number;
  languageFilterPass: boolean;
  buyPriceSek: number;
  shippingEstimateSek: number;
  cardmarketEnLowSek?: number;
  cardmarketEnAvgSek?: number;
  expectedProfitSek?: number;
  scannedAt: string;
}

interface ScanStatus {
  running: boolean;
  phase: string;
  processed: number;
  total: number;
  message: string;
  error: string | null;
  ollamaReachable: boolean | null;
}

export default function DealsPage() {
  const { toast } = useToast();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [scan, setScan] = useState<ScanStatus | null>(null);
  const [importingDealId, setImportingDealId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [clearAll, setClearAll] = useState(false);
  const [remove, setRemove] = useState<Deal | null>(null);

  useEffect(() => {
    loadDeals();
  }, []);

  async function loadDeals() {
    try {
      const data = await apiJson<{ deals: Deal[] }>('/api/v1/deals');
      setDeals(data.deals || []);
    } catch (error) {
      toast('error', error instanceof Error ? error.message : 'API unavailable at :8000');
    } finally {
      setLoading(false);
    }
  }

  async function scanForDeals() {
    setScanning(true);
    const poll = window.setInterval(async () => {
      try {
        const status = await apiJson<ScanStatus>('/api/v1/deals/scan/status');
        setScan(status);
      } catch {
        /* ignore poll errors */
      }
    }, 600);
    try {
      const result = await apiJson<{ mode?: string }>('/api/v1/deals/scan', { method: 'POST' });
      toast('success', result.mode === 'demo' ? 'Demo deals loaded' : 'Scan complete');
      await loadDeals();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to scan deals';
      toast('error', message === 'Ollama unreachable' ? 'Ollama unreachable' : message);
    } finally {
      window.clearInterval(poll);
      setScanning(false);
      try {
        setScan(await apiJson<ScanStatus>('/api/v1/deals/scan/status'));
      } catch {
        /* ignore */
      }
    }
  }

  async function importDeal(dealId: number) {
    setImportingDealId(dealId);
    try {
      const data = await apiJson<{ purchaseId: number }>(`/api/v1/deals/${dealId}/import-purchase`, { method: 'POST' });
      toast('success', `Imported as purchase #${data.purchaseId}`);
    } catch (error) {
      toast('error', error instanceof Error ? error.message : 'Failed to import deal');
    } finally {
      setImportingDealId(null);
    }
  }

  async function confirmDelete() {
    if (!remove) return;
    setSaving(true);
    try {
      await apiJson(`/api/v1/deals/${remove.id}`, { method: 'DELETE' });
      toast('success', 'Deal removed');
      setRemove(null);
      await loadDeals();
    } catch (error) {
      toast('error', error instanceof Error ? error.message : 'Failed to delete deal');
    } finally {
      setSaving(false);
    }
  }

  async function confirmClear() {
    setSaving(true);
    try {
      await apiJson('/api/v1/deals', { method: 'DELETE' });
      toast('success', 'Scan cleared');
      setClearAll(false);
      await loadDeals();
    } catch (error) {
      toast('error', error instanceof Error ? error.message : 'Failed to clear deals');
    } finally {
      setSaving(false);
    }
  }

  const goodDeals = deals.filter((d) => d.languageFilterPass && d.expectedProfitSek && d.expectedProfitSek > 20);

  return (
    <AppShell currentPage="Deals">
      <PageHeader
        title="Deal Finder"
        subtitle="English Riftbound singles from Tradera, scored against Cardmarket EN comps."
        action={
          <div className="flex gap-2">
            {deals.length > 0 && (
              <button className="btn-secondary" onClick={() => setClearAll(true)} disabled={saving || scanning}>
                Clear all
              </button>
            )}
            <button className="btn-primary" onClick={scanForDeals} disabled={scanning}>
              {scanning ? 'Scanning...' : 'Scan for Deals'}
            </button>
          </div>
        }
      />

      {(scanning || scan?.error) && (
        <div className={`mb-4 card p-4 ${scan?.error ? 'border-danger' : ''}`}>
          <p className="text-sm font-medium">{scan?.error === 'Ollama unreachable' ? 'Ollama unreachable' : scan?.message || 'Scanning…'}</p>
          {scan && scan.total > 0 && (
            <p className="helper">{scan.processed}/{scan.total} listings • {scan.phase}</p>
          )}
        </div>
      )}

      <div className="mb-4 card p-4">
        <p className="text-sm text-muted">
          Demo mode loads fixtures. Live mode scrapes Tradera; with Ollama enabled it uses vision/text JSON matching and drops non-EN cards.
        </p>
      </div>

      {loading ? (
        <Spinner label="Loading deals..." />
      ) : deals.length === 0 ? (
        <EmptyState title="No deals yet" body="Scan listings to score expected profit. Demo mode does not hit live sites." />
      ) : (
        <>
          {goodDeals.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-3">Good Deals ({goodDeals.length})</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {goodDeals.map((deal) => (
                  <DealCard
                    key={deal.id}
                    deal={deal}
                    importing={importingDealId === deal.id}
                    onImport={() => importDeal(deal.id)}
                    onDelete={() => setRemove(deal)}
                  />
                ))}
              </div>
            </div>
          )}

          <h3 className="text-lg font-semibold mb-3">All Results ({deals.length})</h3>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Listing</th>
                  <th>Detected Card</th>
                  <th className="text-right">Buy</th>
                  <th className="text-right">CM EN Low</th>
                  <th className="text-right">Profit</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {deals.map((deal) => (
                  <tr key={deal.id} className={!deal.languageFilterPass ? 'opacity-60' : ''}>
                    <td>
                      <a href={deal.url} className="text-accent" target="_blank" rel="noopener noreferrer">{deal.title}</a>
                      <div className="text-xs text-muted">{deal.source}</div>
                    </td>
                    <td>
                      {deal.detectedCardName ? (
                        <>
                          {deal.detectedCardName}
                          <div className="text-xs text-muted">
                            {deal.detectedCardCode} • {deal.confidence ? `${Math.round(deal.confidence * 100)}%` : '?'}
                          </div>
                        </>
                      ) : (
                        <span className="text-muted">Not matched</span>
                      )}
                    </td>
                    <td className="text-right">{deal.buyPriceSek.toFixed(2)}</td>
                    <td className="text-right">{deal.cardmarketEnLowSek?.toFixed(2) ?? '—'}</td>
                    <td className="text-right">{deal.expectedProfitSek?.toFixed(2) ?? '—'}</td>
                    <td className="whitespace-nowrap">
                      {deal.detectedCardId && (
                        <button className="btn-ghost" disabled={importingDealId === deal.id} onClick={() => importDeal(deal.id)}>
                          {importingDealId === deal.id ? 'Importing...' : 'Import'}
                        </button>
                      )}
                      <button className="btn-ghost text-danger" onClick={() => setRemove(deal)}>Remove</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <ConfirmDialog
        open={!!remove}
        title="Remove deal?"
        message="This only removes the scan row. It does not touch inventory."
        busy={saving}
        onCancel={() => setRemove(null)}
        onConfirm={confirmDelete}
      />
      <ConfirmDialog
        open={clearAll}
        title="Clear all deals?"
        message="Deletes every scanned deal. Run Scan again to refill."
        confirmLabel="Clear all"
        busy={saving}
        onCancel={() => setClearAll(false)}
        onConfirm={confirmClear}
      />
    </AppShell>
  );
}

function DealCard({
  deal,
  importing,
  onImport,
  onDelete,
}: {
  deal: Deal;
  importing: boolean;
  onImport: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="card overflow-hidden border-2 border-green-400 dark:border-green-700">
      {deal.imageUrl && (
        <div className="aspect-video bg-background relative">
          <img src={deal.imageUrl} alt="" className="absolute inset-0 w-full h-full object-contain" />
        </div>
      )}
      <div className="p-4 space-y-2">
        <h4 className="text-sm font-medium line-clamp-2">{deal.title}</h4>
        {deal.detectedCardName && (
          <p className="text-xs text-muted">
            {deal.detectedCardName} {deal.confidence ? `(${Math.round(deal.confidence * 100)}%)` : ''}
          </p>
        )}
        <p className="text-sm">Buy {deal.buyPriceSek.toFixed(2)} SEK</p>
        {deal.expectedProfitSek != null && (
          <p className="text-sm font-semibold text-success">Profit {deal.expectedProfitSek.toFixed(2)} SEK</p>
        )}
        <a className="btn-secondary w-full" href={deal.url} target="_blank" rel="noopener noreferrer">View on {deal.source}</a>
        {deal.detectedCardId && (
          <button className="btn-primary w-full" disabled={importing} onClick={onImport}>
            {importing ? 'Importing...' : 'Import as Purchase'}
          </button>
        )}
        <button className="btn-ghost w-full text-danger" onClick={onDelete}>Remove</button>
      </div>
    </div>
  );
}
