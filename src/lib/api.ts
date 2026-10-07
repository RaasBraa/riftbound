export function errorMessage(data: unknown, fallback: string): string {
  if (!data || typeof data !== 'object') return fallback;
  const detail = (data as { detail?: unknown }).detail;
  if (typeof detail === 'string') return detail;
  if (detail && typeof detail === 'object' && 'error' in detail) {
    return String((detail as { error: unknown }).error);
  }
  if (Array.isArray(detail)) {
    return detail
      .map((item) => (item && typeof item === 'object' && 'msg' in item ? String(item.msg) : ''))
      .filter(Boolean)
      .join('; ') || fallback;
  }
  return fallback;
}

export async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  });
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  if (!res.ok) {
    throw new Error(errorMessage(data, `Request failed (${res.status})`));
  }
  return data as T;
}

export function parseNonNegative(value: string | number): number | null {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}
