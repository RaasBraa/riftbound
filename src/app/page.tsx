'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/AppShell';
import { PageHeader } from '@/components/PageHeader';
import { Spinner } from '@/components/Spinner';
import { EmptyState } from '@/components/EmptyState';

interface Stats {
  totalInvestedSek: number;
  inventoryCostSek: number;
  listedCount: number;
  ownedCount: number;
  soldCount: number;
  realizedProfitSek: number;
  openDealsCount: number;
}

const ZERO: Stats = {
  totalInvestedSek: 0,
  inventoryCostSek: 0,
  listedCount: 0,
  ownedCount: 0,
  soldCount: 0,
  realizedProfitSek: 0,
  openDealsCount: 0,
};

export default function HomePage() {
  const [stats, setStats] = useState<Stats>(ZERO);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);

  const loadStats = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/stats');
      if (res.ok) {
        setStats(await res.json());
        setLoaded(true);
      }
    } catch (error) {
      console.error('Failed to load stats:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStats();
    const onFocus = () => loadStats();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [loadStats]);

  const empty = loaded && stats.ownedCount + stats.listedCount + stats.soldCount === 0 && stats.openDealsCount === 0;

  return (
    <AppShell currentPage="Dashboard">
      <PageHeader title="Dashboard" subtitle="Stock, spend, and realized profit for English Riftbound singles." />

      {loading ? (
        <Spinner label="Loading stats..." />
      ) : empty ? (
        <EmptyState
          title="Nothing tracked yet"
          body="Add a purchase to start inventory, or scan listings for deals."
          href="/purchases"
          cta="Add purchase"
        />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Total Stock" value={String(stats.ownedCount + stats.listedCount)} />
            <StatCard label="Total Invested" value={`${stats.totalInvestedSek.toFixed(0)} SEK`} />
            <StatCard label="Active Deals" value={String(stats.openDealsCount)} />
            <StatCard
              label="Realized Profit"
              value={`${stats.realizedProfitSek.toFixed(0)} SEK`}
              tone={stats.realizedProfitSek >= 0 ? 'success' : 'danger'}
            />
          </div>

          <div className="mt-8 grid grid-cols-1 gap-5 lg:grid-cols-2">
            <div className="card p-6">
              <h3 className="text-lg font-medium text-text mb-4">Inventory Breakdown</h3>
              <dl className="space-y-3">
                <Row label="Owned (not listed)" value={`${stats.ownedCount} lots`} />
                <Row label="Listed for sale" value={`${stats.listedCount} lots`} />
                <Row label="Sold" value={`${stats.soldCount} lots`} />
                <div className="flex justify-between border-t border-border pt-3">
                  <dt className="text-sm font-medium text-text">Current Inventory Value</dt>
                  <dd className="text-sm font-semibold">{stats.inventoryCostSek.toFixed(2)} SEK</dd>
                </div>
              </dl>
            </div>

            <div className="card p-6">
              <h4 className="text-sm font-medium text-text mb-3">Next steps</h4>
              <ul className="text-sm text-muted space-y-2">
                <li><Link className="text-accent underline" href="/purchases">Add purchase</Link> to track cost basis</li>
                <li><Link className="text-accent underline" href="/deals">Scan deals</Link> on Tradera (demo fixtures until live mode)</li>
                <li><Link className="text-accent underline" href="/inventory">Inventory</Link> to list or record a sale</li>
                <li><Link className="text-accent underline" href="/settings">Settings</Link> for fees, demo mode, and Ollama</li>
              </ul>
            </div>
          </div>
        </>
      )}
    </AppShell>
  );
}

function StatCard({ label, value, tone }: { label: string; value: string; tone?: 'success' | 'danger' }) {
  const color = tone === 'success' ? 'text-success' : tone === 'danger' ? 'text-danger' : 'text-text';
  return (
    <div className="card p-5">
      <dt className="text-sm font-medium text-muted">{label}</dt>
      <dd className={`mt-2 text-3xl font-semibold ${color}`}>{value}</dd>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="text-sm font-semibold text-text">{value}</dd>
    </div>
  );
}
