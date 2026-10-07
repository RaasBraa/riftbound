'use client';

import { useState, useEffect } from 'react';
import { AppShell } from '@/components/AppShell';
import { PageHeader } from '@/components/PageHeader';
import { Spinner } from '@/components/Spinner';
import { useTheme, ThemePreference } from '@/components/ThemeProvider';
import { useToast } from '@/components/Toast';
import { apiJson, parseNonNegative } from '@/lib/api';

interface Settings {
  demoMode: boolean;
  minProfitSek: number;
  defaultShippingSek: number;
  cardmarketFeePercent: number;
  traderaFeePercent: number;
  askToSoldFactor: number;
  ollamaBaseUrl: string;
  ollamaTextModel: string;
  ollamaVisionModel: string;
  ollamaEnabled: boolean;
  minMatchConfidence: number;
}

const DEFAULTS: Settings = {
  demoMode: true,
  minProfitSek: 20,
  defaultShippingSek: 30,
  cardmarketFeePercent: 10,
  traderaFeePercent: 8,
  askToSoldFactor: 0.9,
  ollamaBaseUrl: 'http://127.0.0.1:11434',
  ollamaTextModel: 'llama3.2',
  ollamaVisionModel: 'llava',
  ollamaEnabled: false,
  minMatchConfidence: 0.55,
};

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { preference, setPreference } = useTheme();
  const { toast } = useToast();

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    try {
      const data = await apiJson<Settings>('/api/v1/settings');
      setSettings({ ...DEFAULTS, ...data });
    } catch (error) {
      toast('error', error instanceof Error ? error.message : 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  }

  async function saveSettings() {
    const moneyFields: Array<keyof Settings> = [
      'minProfitSek',
      'defaultShippingSek',
      'cardmarketFeePercent',
      'traderaFeePercent',
      'askToSoldFactor',
      'minMatchConfidence',
    ];
    for (const key of moneyFields) {
      if (parseNonNegative(settings[key] as number) === null) {
        toast('error', 'Numeric fields must be zero or greater');
        return;
      }
    }
    setSaving(true);
    try {
      await apiJson('/api/v1/settings', { method: 'PUT', body: JSON.stringify(settings) });
      toast('success', 'Settings saved');
    } catch (error) {
      toast('error', error instanceof Error ? error.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell currentPage="Settings">
      <PageHeader title="Settings" subtitle="Demo mode stays on until you opt into live scraping and Ollama." />

      {loading ? (
        <Spinner label="Loading settings..." />
      ) : (
        <div className="max-w-3xl space-y-6">
          <div className="card p-6 space-y-4">
            <h3 className="font-medium text-text">Appearance</h3>
            <label className="label">Theme</label>
            <select
              className="input"
              value={preference}
              onChange={(e) => setPreference(e.target.value as ThemePreference)}
            >
              <option value="system">System</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
            <p className="helper">Default follows your OS until you pick light or dark.</p>
          </div>

          <div className="card p-6 space-y-6">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={settings.demoMode}
                onChange={(e) => setSettings({ ...settings, demoMode: e.target.checked })}
                className="h-4 w-4"
              />
              <span className="ml-2 text-sm font-medium">Demo Mode</span>
            </label>
            <p className="helper">Uses fixture deals. Live HTTP to Tradera, Cardmarket, and Ollama only when this is off.</p>

            <NumberField
              label="Minimum Profit (SEK)"
              value={settings.minProfitSek}
              onChange={(v) => setSettings({ ...settings, minProfitSek: v })}
              help="Minimum expected profit to highlight a deal"
            />
            <NumberField
              label="Default Shipping Cost (SEK)"
              value={settings.defaultShippingSek}
              onChange={(v) => setSettings({ ...settings, defaultShippingSek: v })}
            />
            <NumberField
              label="Cardmarket Fee (%)"
              value={settings.cardmarketFeePercent}
              step="0.1"
              onChange={(v) => setSettings({ ...settings, cardmarketFeePercent: v })}
            />
            <NumberField
              label="Tradera Fee (%)"
              value={settings.traderaFeePercent}
              step="0.1"
              onChange={(v) => setSettings({ ...settings, traderaFeePercent: v })}
            />
            <NumberField
              label="Ask → Sold Factor"
              value={settings.askToSoldFactor}
              step="0.01"
              onChange={(v) => setSettings({ ...settings, askToSoldFactor: v })}
              help="Expected sell price as fraction of Cardmarket low (0.9 = 90%)"
            />
          </div>

          <div className="card p-6 space-y-6">
            <h3 className="font-medium text-text">Ollama</h3>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={settings.ollamaEnabled}
                onChange={(e) => setSettings({ ...settings, ollamaEnabled: e.target.checked })}
                className="h-4 w-4"
              />
              <span className="ml-2 text-sm font-medium">Enable Ollama matching</span>
            </label>
            <p className="helper">Requires demo mode off and `ollama serve` at the URL below.</p>
            <div>
              <label className="label">Ollama URL</label>
              <input
                className="input"
                value={settings.ollamaBaseUrl}
                onChange={(e) => setSettings({ ...settings, ollamaBaseUrl: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Text model</label>
              <input
                className="input"
                value={settings.ollamaTextModel}
                onChange={(e) => setSettings({ ...settings, ollamaTextModel: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Vision model</label>
              <input
                className="input"
                value={settings.ollamaVisionModel}
                onChange={(e) => setSettings({ ...settings, ollamaVisionModel: e.target.value })}
              />
            </div>
            <NumberField
              label="Min match confidence"
              value={settings.minMatchConfidence}
              step="0.01"
              onChange={(v) => setSettings({ ...settings, minMatchConfidence: v })}
            />
          </div>

          <button onClick={saveSettings} disabled={saving} className="btn-primary">
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      )}
    </AppShell>
  );
}

function NumberField({
  label,
  value,
  onChange,
  step,
  help,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: string;
  help?: string;
}) {
  return (
    <div>
      <label className="label">{label}</label>
      <input
        type="number"
        min="0"
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="input"
      />
      {help && <p className="helper">{help}</p>}
    </div>
  );
}
