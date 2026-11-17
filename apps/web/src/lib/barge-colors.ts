export interface BargeColorStyle {
  rowClass: string;
  badgeClass: string;
  dotClass: string;
}

const FIXED_BARGE_STYLES: Record<string, BargeColorStyle> = {
  NV18: {
    rowClass: 'bg-[#EAD1DC] hover:bg-[#E2C2D0]',
    badgeClass: 'bg-[#F5E6EC] text-slate-800 border border-[#D4B0C0]',
    dotClass: 'bg-[#B45382]',
  },
  NV36: {
    rowClass: 'bg-[#D9EAD3] hover:bg-[#CBE1C3]',
    badgeClass: 'bg-[#EBF4E7] text-slate-800 border border-[#B8D4AD]',
    dotClass: 'bg-[#4E8C43]',
  },
  NV38: {
    rowClass: 'bg-[#C9DAF8] hover:bg-[#B8CDF3]',
    badgeClass: 'bg-[#E5EEFC] text-slate-800 border border-[#A5BFE9]',
    dotClass: 'bg-[#3D6BB3]',
  },
};

const OTHER_BARGE_STYLE: BargeColorStyle = {
  rowClass: 'bg-slate-50/80 hover:bg-slate-100/90',
  badgeClass: 'bg-white text-slate-700 border border-slate-300',
  dotClass: 'bg-slate-400',
};

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
  return OTHER_BARGE_STYLE;
}
