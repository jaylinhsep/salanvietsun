import { Vessel } from '@/lib/api';

export function currentYearMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function formatMoney(n: number | undefined | null): string {
  return Number(n || 0).toLocaleString('vi-VN');
}

export function exportRowsToCsv(filename: string, headers: string[], rows: (string | number)[][]) {
  const esc = (v: string | number) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = '\uFEFF' + [headers.map(esc).join(','), ...rows.map((r) => r.map(esc).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function mergeVesselCodes(vessels: Vessel[], extraCodes: (string | null | undefined)[] = []): string[] {
  const set = new Set<string>(['NV18', 'NV36', 'NV38']);
  for (const v of vessels) if (v.code) set.add(v.code.toUpperCase());
  for (const c of extraCodes) if (c) set.add(c.toUpperCase());
  return Array.from(set).sort();
}

export async function findLatestPeriodMonth(apiUrl: string, kind: string): Promise<string | null> {
  try {
    const res = await fetch(`${apiUrl}/orders/accounting/${kind}`, { cache: 'no-store' });
    if (!res.ok) return null;
    const rows = (await res.json()) as Array<{ period_month?: string }>;
    const months = rows.map((r) => r.period_month).filter((m): m is string => Boolean(m)).sort();
    return months.length > 0 ? months[months.length - 1] : null;
  } catch {
    return null;
  }
}
