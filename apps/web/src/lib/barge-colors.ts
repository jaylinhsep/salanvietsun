export interface BargeColorStyle {
  rowClass: string;
  badgeClass: string;
  dotClass: string;
}

const FIXED_BARGE_STYLES: Record<string, BargeColorStyle> = {
  NV18: {
    rowClass: 'bg-[#F4F7FB] hover:bg-[#EBF1F8]',
    badgeClass: 'bg-[#ECF2F9] text-slate-700 border border-[#D7E1EE]',
    dotClass: 'bg-sky-600/70',
  },
  NV36: {
    rowClass: 'bg-[#F3F8F5] hover:bg-[#EAF3ED]',
    badgeClass: 'bg-[#EAF3ED] text-slate-700 border border-[#D4E4DA]',
    dotClass: 'bg-emerald-600/70',
  },
  NV38: {
    rowClass: 'bg-[#FAF7F2] hover:bg-[#F3EFE6]',
    badgeClass: 'bg-[#F4EFE6] text-slate-700 border border-[#E5DCCB]',
    dotClass: 'bg-amber-600/70',
  },
};

const PALETTE_STYLES: BargeColorStyle[] = [
  {
    rowClass: 'bg-[#F6F5FA] hover:bg-[#EEEBF4]',
    badgeClass: 'bg-[#EFECF6] text-slate-700 border border-[#DED9EC]',
    dotClass: 'bg-indigo-500/60',
  },
  {
    rowClass: 'bg-[#F4F6F6] hover:bg-[#EBF0F0]',
    badgeClass: 'bg-[#ECEFEF] text-slate-700 border border-[#D8E0E0]',
    dotClass: 'bg-teal-600/60',
  },
  {
    rowClass: 'bg-[#F7F6F4] hover:bg-[#EFECE8]',
    badgeClass: 'bg-[#F0EEEA] text-slate-700 border border-[#E1DDD5]',
    dotClass: 'bg-stone-500/70',
  },
  {
    rowClass: 'bg-[#F5F7FA] hover:bg-[#ECEFF5]',
    badgeClass: 'bg-[#EDEFF5] text-slate-700 border border-[#DCE0EA]',
    dotClass: 'bg-slate-500/70',
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
