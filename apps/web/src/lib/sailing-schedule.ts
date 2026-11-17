export interface SailingScheduleRow {
  id: string;
  vessel_name: string;
  hcm_voy: string;
  hcm_etd: string;
  ct_eta: string;
  ct_voy: string;
  ct_etd: string;
  hcm_eta: string;
}

export interface SailingScheduleSheet {
  month_key: string; // e.g. "2026-11"
  company_name: string;
  address: string;
  tel_fax: string;
  email_web: string;
  title: string;
  col_vessel_label: string;
  group1_title: string;
  group1_subtitle: string;
  group2_title: string;
  group2_subtitle: string;
  group3_title: string;
  footnote: string;
  contact_title: string;
  contacts: string[];
  contact_email: string;
  rows: SailingScheduleRow[];
}

export interface SailingSchedulePayload {
  active_month: string;
  sheets: SailingScheduleSheet[];
  updated_at?: string;
}

export const DEFAULT_SAILING_SCHEDULE: SailingSchedulePayload = {
  active_month: '2026-11',
  sheets: [
    {
      month_key: '2026-11',
      company_name: 'VIETSUN CORPORATION- VIETSUN LINES',
      address: 'Add : No.13-15, B4 Str., An Khanh ward, HCMC.',
      tel_fax: 'Tel : 84 2838269539 / Fax : 84 2839433114',
      email_web: 'Email : operation@vietsunlogistic.com / Web : www.vietsunlogistic.com',
      title: 'LỊCH CHẠY SÀ LAN THÁNG 11/2026 (Update:02/11/2026)',
      col_vessel_label: 'TÊN PHƯƠNG TIỆN',
      group1_title: 'HỒ CHÍ MINH',
      group1_subtitle: '(TÂN THUẬN/ BẾN NGHÉ/ VICT)',
      group2_title: 'CẢNG CẦN THƠ & CẢNG TC SADEC',
      group2_subtitle: '(CÁI CUI/ HOÀNG DIỆU/SADEC)',
      group3_title: 'HỒ CHÍ MINH',
      footnote: '*Above Sailing Schedule is subject to change with or without prior notice',
      contact_title: 'CONTACT INFORMATION:',
      contacts: [
        'Mr. Kiều Đình Phi / HP 0968 742 179',
        'Mr. Phan Thanh Tuấn / HP 0963 753 335',
        'Mr. Nguyễn Ngọc Hoàng / HP 0902 835 112',
        'Mr. Nguyễn Hồng Nguyên / HP 035 537 0538',
        'Ms. Trần Huỳnh Minh Thư / HP 0938 166 965',
      ],
      contact_email: 'Email : vstrucking@vietsunlogistic.com',
      rows: [
        { id: 'nov26-01', vessel_name: 'NHẬT VIỆT 18', hcm_voy: 'V18 - 4626W', hcm_etd: '29/10', ct_eta: '30/10', ct_voy: 'V18 - 4626E', ct_etd: '01/11', hcm_eta: '02/11' },
        { id: 'nov26-02', vessel_name: 'NHẬT VIỆT 36', hcm_voy: 'V36 - 5026W', hcm_etd: '02/11', ct_eta: '03/11', ct_voy: 'V36 - 5026E', ct_etd: '05/11', hcm_eta: '06/11' },
        { id: 'nov26-03', vessel_name: 'NHẬT VIỆT 38', hcm_voy: 'V38 - 4226W', hcm_etd: '31/10', ct_eta: '01/11', ct_voy: 'V38 - 4226E', ct_etd: '03/11', hcm_eta: '04/11' },
        { id: 'nov26-04', vessel_name: 'NHẬT VIỆT 18', hcm_voy: 'V18 - 4726W', hcm_etd: '03/11', ct_eta: '04/11', ct_voy: 'V18 - 4726E', ct_etd: '06/11', hcm_eta: '07/11' },
        { id: 'nov26-05', vessel_name: 'NHẬT VIỆT 36', hcm_voy: 'V36 - 5126W', hcm_etd: '07/11', ct_eta: '08/11', ct_voy: 'V36 - 5126E', ct_etd: '10/11', hcm_eta: '11/11' },
        { id: 'nov26-06', vessel_name: 'NHẬT VIỆT 38', hcm_voy: 'V38 - 4326W', hcm_etd: '05/11', ct_eta: '06/11', ct_voy: 'V38 - 4326E', ct_etd: '08/11', hcm_eta: '09/11' },
        { id: 'nov26-07', vessel_name: 'NHẬT VIỆT 18', hcm_voy: 'V18 - 4826W', hcm_etd: '08/11', ct_eta: '09/11', ct_voy: 'V18 - 4826E', ct_etd: '11/11', hcm_eta: '12/11' },
        { id: 'nov26-08', vessel_name: 'NHẬT VIỆT 36', hcm_voy: 'V36 - 5226W', hcm_etd: '12/11', ct_eta: '13/11', ct_voy: 'V36 - 5226E', ct_etd: '15/11', hcm_eta: '16/11' },
        { id: 'nov26-09', vessel_name: 'NHẬT VIỆT 38', hcm_voy: 'V38 - 4426W', hcm_etd: '10/11', ct_eta: '11/11', ct_voy: 'V38 - 4426E', ct_etd: '13/11', hcm_eta: '14/11' },
        { id: 'nov26-10', vessel_name: 'NHẬT VIỆT 18', hcm_voy: 'V18 - 4926W', hcm_etd: '13/11', ct_eta: '14/11', ct_voy: 'V18 - 4926E', ct_etd: '16/11', hcm_eta: '17/11' },
        { id: 'nov26-11', vessel_name: 'NHẬT VIỆT 36', hcm_voy: 'V36 - 5326W', hcm_etd: '17/11', ct_eta: '18/11', ct_voy: 'V36 - 5326E', ct_etd: '20/11', hcm_eta: '21/11' },
        { id: 'nov26-12', vessel_name: 'NHẬT VIỆT 38', hcm_voy: 'V38 - 4526W', hcm_etd: '15/11', ct_eta: '16/11', ct_voy: 'V38 - 4526E', ct_etd: '18/11', hcm_eta: '19/11' },
        { id: 'nov26-13', vessel_name: 'NHẬT VIỆT 18', hcm_voy: 'V18 - 5026W', hcm_etd: '18/11', ct_eta: '19/11', ct_voy: 'V18 - 5026E', ct_etd: '21/11', hcm_eta: '22/11' },
        { id: 'nov26-14', vessel_name: 'NHẬT VIỆT 36', hcm_voy: 'V36 - 5426W', hcm_etd: '22/11', ct_eta: '23/11', ct_voy: 'V36 - 5426E', ct_etd: '25/11', hcm_eta: '26/11' },
        { id: 'nov26-15', vessel_name: 'NHẬT VIỆT 38', hcm_voy: 'V38 - 4626W', hcm_etd: '20/11', ct_eta: '21/11', ct_voy: 'V38 - 4626E', ct_etd: '23/11', hcm_eta: '24/11' },
        { id: 'nov26-16', vessel_name: 'NHẬT VIỆT 18', hcm_voy: 'V18 - 5126W', hcm_etd: '23/11', ct_eta: '24/11', ct_voy: 'V18 - 5126E', ct_etd: '26/11', hcm_eta: '27/11' },
        { id: 'nov26-17', vessel_name: 'NHẬT VIỆT 36', hcm_voy: 'V36 - 5526W', hcm_etd: '27/11', ct_eta: '28/11', ct_voy: 'V36 - 5526E', ct_etd: '30/11', hcm_eta: '01/12' },
        { id: 'nov26-18', vessel_name: 'NHẬT VIỆT 38', hcm_voy: 'V38 - 4726W', hcm_etd: '25/11', ct_eta: '26/11', ct_voy: 'V38 - 4726E', ct_etd: '28/11', hcm_eta: '29/11' },
      ],
    },
  ],
};

export function normalizeDateCellDisplay(raw: string): string {
  const s = String(raw || '').trim();
  const isoMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    return `${isoMatch[3]}/${isoMatch[2]}`;
  }
  return s;
}

export function normalizeSchedulePayload(raw: any): SailingSchedulePayload {
  if (!raw || !Array.isArray(raw.sheets) || raw.sheets.length === 0) {
    return structuredClone(DEFAULT_SAILING_SCHEDULE);
  }
  const sheets: SailingScheduleSheet[] = raw.sheets.map((sh: any) => ({
    month_key: String(sh.month_key || '2026-11'),
    company_name: String(sh.company_name ?? DEFAULT_SAILING_SCHEDULE.sheets[0].company_name),
    address: String(sh.address ?? DEFAULT_SAILING_SCHEDULE.sheets[0].address),
    tel_fax: String(sh.tel_fax ?? DEFAULT_SAILING_SCHEDULE.sheets[0].tel_fax),
    email_web: String(sh.email_web ?? DEFAULT_SAILING_SCHEDULE.sheets[0].email_web),
    title: String(sh.title ?? DEFAULT_SAILING_SCHEDULE.sheets[0].title),
    col_vessel_label: String(sh.col_vessel_label ?? 'TÊN PHƯƠNG TIỆN'),
    group1_title: String(sh.group1_title ?? 'HỒ CHÍ MINH'),
    group1_subtitle: String(sh.group1_subtitle ?? '(TÂN THUẬN/ BẾN NGHÉ/ VICT)'),
    group2_title: String(sh.group2_title ?? 'CẢNG CẦN THƠ & CẢNG TC SADEC'),
    group2_subtitle: String(sh.group2_subtitle ?? '(CÁI CUI/ HOÀNG DIỆU/SADEC)'),
    group3_title: String(sh.group3_title ?? 'HỒ CHÍ MINH'),
    footnote: String(sh.footnote ?? DEFAULT_SAILING_SCHEDULE.sheets[0].footnote),
    contact_title: String(sh.contact_title ?? 'CONTACT INFORMATION:'),
    contacts: Array.isArray(sh.contacts)
      ? sh.contacts.map((c: any) => String(c || ''))
      : [...DEFAULT_SAILING_SCHEDULE.sheets[0].contacts],
    contact_email: String(sh.contact_email ?? DEFAULT_SAILING_SCHEDULE.sheets[0].contact_email),
    rows: Array.isArray(sh.rows)
      ? sh.rows.map((r: any, i: number) => ({
          id: String(r.id || `row-${Date.now()}-${i}`),
          vessel_name: String(r.vessel_name || ''),
          hcm_voy: String(r.hcm_voy || ''),
          hcm_etd: String(r.hcm_etd || ''),
          ct_eta: String(r.ct_eta || ''),
          ct_voy: String(r.ct_voy || ''),
          ct_etd: String(r.ct_etd || ''),
          hcm_eta: String(r.hcm_eta || ''),
        }))
      : [],
  }));
  const active_month = sheets.some((s) => s.month_key === raw.active_month)
    ? String(raw.active_month)
    : sheets[0].month_key;
  return {
    active_month,
    sheets,
    updated_at: raw.updated_at,
  };
}

export function exportSheetToCsv(sheet: SailingScheduleSheet): void {
  const esc = (v: string) => {
    const s = String(v ?? '');
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };
  const lines: string[] = [
    [',', '', '', sheet.company_name].slice(1).map(esc).join(','), // matches column alignment
  ];
  // Build clean CSV mirroring the Excel template
  const out: string[] = [
    ['', '', '', sheet.company_name, '', '', '', ''].map(esc).join(','),
    ['', '', '', sheet.address, '', '', '', ''].map(esc).join(','),
    ['', '', '', sheet.tel_fax, '', '', '', ''].map(esc).join(','),
    ['', '', '', sheet.email_web, '', '', '', ''].map(esc).join(','),
    ['', sheet.title, '', '', '', '', '', ''].map(esc).join(','),
    [
      '',
      sheet.col_vessel_label,
      `${sheet.group1_title}\n${sheet.group1_subtitle}`,
      '',
      `${sheet.group2_title}\n${sheet.group2_subtitle}`,
      '',
      '',
      sheet.group3_title,
    ]
      .map(esc)
      .join(','),
    ['', '', 'VOY', 'ETD', 'ETA', 'VOY', 'ETD', 'ETA'].map(esc).join(','),
    ...sheet.rows.map((r) =>
      ['', r.vessel_name, r.hcm_voy, r.hcm_etd, r.ct_eta, r.ct_voy, r.ct_etd, r.hcm_eta]
        .map(esc)
        .join(','),
    ),
    ['', sheet.footnote, '', '', '', '', '', ''].map(esc).join(','),
    ['', '', '', '', '', '', '', ''].join(','),
    ['', sheet.contact_title, '', '', '', '', '', ''].map(esc).join(','),
    ...sheet.contacts.map((c) => ['', c, '', '', '', '', '', ''].map(esc).join(',')),
    ['', sheet.contact_email, '', '', '', '', '', ''].map(esc).join(','),
  ];
  void lines;
  const blob = new Blob(['\uFEFF' + out.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `lich-chay-sa-lan-${sheet.month_key || 'vietsun'}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
