'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Settings {
  demoMode: boolean;
  minProfitSek: number;
  defaultShippingSek: number;
  cardmarketFeePercent: number;
  traderaFeePercent: number;
  askToSoldFactor: number;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>({
    demoMode: true,
    minProfitSek: 20,
    defaultShippingSek: 30,
    cardmarketFeePercent: 10,
    traderaFeePercent: 8,
    askToSoldFactor: 0.9,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    try {
      const res = await fetch('/api/v1/settings');
      if (res.ok) {
        const data = await res.json();
        setSettings(data);
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      setLoading(false);
    }
  }

  async function saveSettings() {
    setSaving(true);
    setMessage('');
    try {
      const res = await fetch('/api/v1/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      if (res.ok) {
        setMessage('Settings saved successfully!');
        setTimeout(() => setMessage(''), 3000);
      } else {
        setMessage('Failed to save settings');
      }
    } catch (error) {
      setMessage('Error saving settings');
    } finally {
      setSaving(false);
    }
  }

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
                <Link href="/sold" className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium">
                  Sold
                </Link>
                <Link href="/settings" className="border-indigo-500 text-gray-900 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium">
                  Settings
                </Link>
              </div>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <h2 className="text-3xl font-bold text-gray-900 mb-6">Settings</h2>

          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
              <p className="mt-2 text-gray-500">Loading settings...</p>
            </div>
          ) : (
            <div className="bg-white shadow overflow-hidden sm:rounded-lg">
              <div className="px-4 py-5 sm:p-6 space-y-6">
                <div>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={settings.demoMode}
                      onChange={(e) => setSettings({ ...settings, demoMode: e.target.checked })}
                      className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                    />
                    <span className="ml-2 text-sm font-medium text-gray-700">Demo Mode</span>
                  </label>
                  <p className="mt-1 text-sm text-gray-500">
                    When enabled, deal scanner uses fixture data. Disable for live scraping.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Minimum Profit (SEK)
                  </label>
                  <input
                    type="number"
                    value={settings.minProfitSek}
                    onChange={(e) => setSettings({ ...settings, minProfitSek: parseFloat(e.target.value) })}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  />
                  <p className="mt-1 text-sm text-gray-500">
                    Minimum expected profit to highlight a deal
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Default Shipping Cost (SEK)
                  </label>
                  <input
                    type="number"
                    value={settings.defaultShippingSek}
                    onChange={(e) => setSettings({ ...settings, defaultShippingSek: parseFloat(e.target.value) })}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Cardmarket Fee (%)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={settings.cardmarketFeePercent}
                    onChange={(e) => setSettings({ ...settings, cardmarketFeePercent: parseFloat(e.target.value) })}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Tradera Fee (%)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={settings.traderaFeePercent}
                    onChange={(e) => setSettings({ ...settings, traderaFeePercent: parseFloat(e.target.value) })}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Ask → Sold Factor
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="1"
                    value={settings.askToSoldFactor}
                    onChange={(e) => setSettings({ ...settings, askToSoldFactor: parseFloat(e.target.value) })}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  />
                  <p className="mt-1 text-sm text-gray-500">
                    Expected sell price as fraction of Cardmarket low (0.9 = 90%)
                  </p>
                </div>

                {message && (
                  <div className={`rounded-md p-4 ${message.includes('success') ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
                    <p className="text-sm font-medium">{message}</p>
                  </div>
                )}

                <div className="pt-4">
                  <button
                    onClick={saveSettings}
                    disabled={saving}
                    className="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                  >
                    {saving ? 'Saving...' : 'Save Settings'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
