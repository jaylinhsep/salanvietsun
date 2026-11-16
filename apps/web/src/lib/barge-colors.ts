export interface BargeColorStyle {
  rowClass: string;
  badgeClass: string;
  dotClass: string;
}

const FIXED_BARGE_STYLES: Record<string, BargeColorStyle> = {
  NV18: {
    rowClass: 'bg-sky-50/70 hover:bg-sky-100/80',
    badgeClass: 'bg-sky-100/90 text-sky-900 border border-sky-200',
    dotClass: 'bg-sky-500',
  },
  NV36: {
    rowClass: 'bg-emerald-50/70 hover:bg-emerald-100/80',
    badgeClass: 'bg-emerald-100/90 text-emerald-900 border border-emerald-200',
    dotClass: 'bg-emerald-500',
  },
  NV38: {
    rowClass: 'bg-amber-50/70 hover:bg-amber-100/80',
    badgeClass: 'bg-amber-100/90 text-amber-900 border border-amber-200',
    dotClass: 'bg-amber-500',
  },
};

const PALETTE_STYLES: BargeColorStyle[] = [
  {
    rowClass: 'bg-violet-50/70 hover:bg-violet-100/80',
    badgeClass: 'bg-violet-100/90 text-violet-900 border border-violet-200',
    dotClass: 'bg-violet-500',
  },
  {
    rowClass: 'bg-teal-50/70 hover:bg-teal-100/80',
    badgeClass: 'bg-teal-100/90 text-teal-900 border border-teal-200',
    dotClass: 'bg-teal-500',
  },
  {
    rowClass: 'bg-indigo-50/70 hover:bg-indigo-100/80',
    badgeClass: 'bg-indigo-100/90 text-indigo-900 border border-indigo-200',
    dotClass: 'bg-indigo-500',
  },
  {
    rowClass: 'bg-orange-50/70 hover:bg-orange-100/80',
    badgeClass: 'bg-orange-100/90 text-orange-900 border border-orange-200',
    dotClass: 'bg-orange-500',
  },
  {
    rowClass: 'bg-cyan-50/70 hover:bg-cyan-100/80',
    badgeClass: 'bg-cyan-100/90 text-cyan-900 border border-cyan-200',
    dotClass: 'bg-cyan-500',
  },
  {
    rowClass: 'bg-fuchsia-50/60 hover:bg-fuchsia-100/75',
    badgeClass: 'bg-fuchsia-100/90 text-fuchsia-900 border border-fuchsia-200',
    dotClass: 'bg-fuchsia-500',
  },
];

const DEFAULT_STYLE: BargeColorStyle = {
  rowClass: 'bg-white hover:bg-slate-50',
  badgeClass: 'bg-slate-100 text-slate-700 border border-slate-200',
  dotClass: 'bg-slate-400',
};

function normalizeBargeKey(raw?: string | null): string {
  const s = String(raw || '').trim().toUpperCase();
  if (!s) return '';
  if (s.includes('NHẬT VIỆT 18') || s.includes('NHAT VIET 18') || s === 'NV18') return 'NV18';
  if (s.includes('NHẬT VIỆT 36') || s.includes('NHAT VIET 36') || s === 'NV36') return 'NV36';
  if (s.includes('NHẬT VIỆT 38') || s.includes('NHAT VIET 38') || s === 'NV38') return 'NV38';
  return s;
}

export function getBargeColorStyle(codeOrName?: string | null): BargeColorStyle {
  const key = normalizeBargeKey(codeOrName);
  if (!key) return DEFAULT_STYLE;
  if (FIXED_BARGE_STYLES[key]) return FIXED_BARGE_STYLES[key];

  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  return PALETTE_STYLES[hash % PALETTE_STYLES.length];
}
