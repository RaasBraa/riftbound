'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Stats {
  totalInvestedSek: number;
  inventoryCostSek: number;
  listedCount: number;
  ownedCount: number;
  soldCount: number;
  realizedProfitSek: number;
  openDealsCount: number;
}

export default function HomePage() {
  const [stats, setStats] = useState<Stats>({
    totalInvestedSek: 0,
    inventoryCostSek: 0,
    listedCount: 0,
    ownedCount: 0,
    soldCount: 0,
    realizedProfitSek: 0,
    openDealsCount: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  async function loadStats() {
    try {
      const res = await fetch('/api/v1/stats');
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Failed to load stats:', error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center">
                <h1 className="text-xl font-bold text-gray-900">Riftbound Business</h1>
              </div>
              <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                <Link href="/" className="border-indigo-500 text-gray-900 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium">
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
                <Link href="/sold" className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium">
                  Sold
                </Link>
                <Link href="/settings" className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium">
                  Settings
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
          <h2 className="text-3xl font-bold text-gray-900 mb-6">Dashboard</h2>
          
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
                <div className="bg-white overflow-hidden shadow rounded-lg">
                  <div className="p-5">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                        </svg>
                      </div>
                      <div className="ml-5 w-0 flex-1">
                        <dl>
                          <dt className="text-sm font-medium text-gray-500 truncate">Total Stock</dt>
                          <dd className="text-3xl font-semibold text-gray-900">{stats.ownedCount + stats.listedCount}</dd>
                        </dl>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-white overflow-hidden shadow rounded-lg">
                  <div className="p-5">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <div className="ml-5 w-0 flex-1">
                        <dl>
                          <dt className="text-sm font-medium text-gray-500 truncate">Total Invested</dt>
                          <dd className="text-3xl font-semibold text-gray-900">{stats.totalInvestedSek.toFixed(0)} SEK</dd>
                        </dl>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-white overflow-hidden shadow rounded-lg">
                  <div className="p-5">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                        </svg>
                      </div>
                      <div className="ml-5 w-0 flex-1">
                        <dl>
                          <dt className="text-sm font-medium text-gray-500 truncate">Active Deals</dt>
                          <dd className="text-3xl font-semibold text-gray-900">{stats.openDealsCount}</dd>
                        </dl>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-white overflow-hidden shadow rounded-lg">
                  <div className="p-5">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <div className="ml-5 w-0 flex-1">
                        <dl>
                          <dt className="text-sm font-medium text-gray-500 truncate">Realized Profit</dt>
                          <dd className={`text-3xl font-semibold ${stats.realizedProfitSek >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {stats.realizedProfitSek.toFixed(0)} SEK
                          </dd>
                        </dl>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-8 grid grid-cols-1 gap-5 lg:grid-cols-2">
                <div className="bg-white shadow overflow-hidden sm:rounded-lg">
                  <div className="px-4 py-5 sm:px-6">
                    <h3 className="text-lg leading-6 font-medium text-gray-900">Inventory Breakdown</h3>
                  </div>
                  <div className="border-t border-gray-200 px-4 py-5 sm:p-6">
                    <dl className="space-y-3">
                      <div className="flex justify-between">
                        <dt className="text-sm font-medium text-gray-500">Owned (not listed)</dt>
                        <dd className="text-sm font-semibold text-gray-900">{stats.ownedCount} lots</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-sm font-medium text-gray-500">Listed for sale</dt>
                        <dd className="text-sm font-semibold text-gray-900">{stats.listedCount} lots</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-sm font-medium text-gray-500">Sold</dt>
                        <dd className="text-sm font-semibold text-gray-900">{stats.soldCount} lots</dd>
                      </div>
                      <div className="flex justify-between border-t pt-3">
                        <dt className="text-sm font-medium text-gray-700">Current Inventory Value</dt>
                        <dd className="text-sm font-semibold text-gray-900">{stats.inventoryCostSek.toFixed(2)} SEK</dd>
                      </div>
                    </dl>
                  </div>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                  <h4 className="text-sm font-medium text-blue-900 mb-2">Getting Started</h4>
                  <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
                    <li>View your existing <Link href="/collection" className="underline font-medium">Collection</Link></li>
                    <li>Add new <Link href="/purchases" className="underline font-medium">Purchases</Link> to track inventory</li>
                    <li>Scan for <Link href="/deals" className="underline font-medium">Deals</Link> on Tradera and Cardmarket</li>
                    <li>Configure <Link href="/settings" className="underline font-medium">Settings</Link> (demo mode, fees, etc.)</li>
                    <li>Legacy <Link href="/gallery" className="underline font-medium">Gallery</Link> still works</li>
                  </ul>
                </div>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
