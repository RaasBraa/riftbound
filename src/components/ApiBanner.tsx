'use client';

import { useEffect, useState } from 'react';

export function ApiBanner() {
  const [down, setDown] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function ping() {
      try {
        const res = await fetch('/api/v1/health');
        if (!cancelled) setDown(!res.ok);
      } catch {
        if (!cancelled) setDown(true);
      }
    }
    ping();
    const id = window.setInterval(ping, 15000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  if (!down) return null;
  return (
    <div className="bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200 border-b border-border px-4 py-2 text-sm text-center">
      Backend is down. Start the API on :8000 (`npm run api`).
    </div>
  );
}
