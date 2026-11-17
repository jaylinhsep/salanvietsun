export function computeNextVoyageNo(params: {
  vesselCode?: string | null;
  vesselName?: string | null;
  existingVoyageNos: Array<string | null | undefined>;
  receivedDate?: string | null;
}): string {
  const rawCode = String(params.vesselCode || '').trim().toUpperCase();
  const rawName = String(params.vesselName || '').trim().toUpperCase();
  const dateStr =
    params.receivedDate && /^\d{4}-\d{2}-\d{2}/.test(params.receivedDate)
      ? params.receivedDate.slice(0, 10)
      : new Date().toISOString().slice(0, 10);

  const yy = dateStr.slice(2, 4);
  const mm = dateStr.slice(5, 7);
  const dd = dateStr.slice(8, 10);

  const usedSet = new Set(
    params.existingVoyageNos.map((n) => String(n || '').trim().toUpperCase()).filter(Boolean),
  );

  // Detect NV18 / NV36 / NV38 or "NHẬT VIỆT 18/36/38" -> prefix V18-, V36-, V38-
  let bargeNum: string | null = null;
  const codeMatch = rawCode.match(/^NV(\d+)$/);
  if (codeMatch) {
    bargeNum = codeMatch[1];
  } else {
    const nameMatch = rawName.match(/(?:NHẬT VIỆT|NHAT VIET)\s*(\d+)/);
    if (nameMatch) bargeNum = nameMatch[1];
  }

  if (bargeNum) {
    const tripPattern = new RegExp(`^V\\.?${bargeNum}-0*(\\d+)(\\d{2})([WE])(?:\\s*-\\s*[WE])?$`, 'i');
    let maxRank = -1;

    for (const rawNo of params.existingVoyageNos) {
      const no = String(rawNo || '').trim().toUpperCase();
      const m = no.match(tripPattern);
      if (!m) continue;
      const seq = parseInt(m[1], 10);
      const rowYy = m[2];
      const dir = m[3].toUpperCase();
      if (rowYy !== yy) continue;
      const rank = seq * 2 + (dir === 'E' ? 1 : 0);
      if (rank > maxRank) maxRank = rank;
    }

    // Next trip: W -> same seq E; E -> (seq + 1) W. Start from 01{yy}W if none exists yet.
    let nextRank = maxRank >= 0 ? maxRank + 1 : 2;
    let candidate = '';
    while (true) {
      const seq = Math.floor(nextRank / 2);
      const dir = nextRank % 2 === 1 ? 'E' : 'W';
      candidate = `V${bargeNum}-${String(seq).padStart(2, '0')}${yy}${dir}`;
      if (!usedSet.has(candidate)) return candidate;
      nextRank++;
    }
  }

  // Fallback for vendor barges (PT16, PT30, SGL01, ...)
  const prefix = rawCode || 'SL';
  const base = `${prefix}-${yy}${mm}${dd}`;
  if (!usedSet.has(base)) return base;
  let suffix = 2;
  while (usedSet.has(`${base}-${suffix}`)) suffix++;
  return `${base}-${suffix}`;
}
