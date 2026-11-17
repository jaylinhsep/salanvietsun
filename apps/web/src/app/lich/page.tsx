'use client';

import React, { useEffect, useState } from 'react';
import { CalendarDays, Download, Printer } from 'lucide-react';
import { API_URL } from '@/lib/api';
import { SailingScheduleSheetView } from '@/components/SailingScheduleSheetView';
import {
  DEFAULT_SAILING_SCHEDULE,
  exportSheetToCsv,
  normalizeSchedulePayload,
  type SailingSchedulePayload,
} from '@/lib/sailing-schedule';

export default function PublicSailingSchedulePage() {
  const [payload, setPayload] = useState<SailingSchedulePayload>(() =>
    structuredClone(DEFAULT_SAILING_SCHEDULE),
  );
  const [selectedMonth, setSelectedMonth] = useState<string>(
    DEFAULT_SAILING_SCHEDULE.active_month,
  );
  const [vesselFilter, setVesselFilter] = useState<string>('ALL');

  useEffect(() => {
    let active = true;
    fetch(`${API_URL}/dispatch/sailing-schedule`, { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((raw) => {
        if (!raw || !active) return;
        const norm = normalizeSchedulePayload(raw);
        setPayload(norm);
        setSelectedMonth(norm.active_month);
      })
      .catch(() => {
        // Keep seeded default schedule if API is temporarily unreachable
      });
    return () => {
      active = false;
    };
  }, []);

  const currentSheet =
    payload.sheets.find((s) => s.month_key === selectedMonth) || payload.sheets[0];

  const distinctVessels = Array.from(
    new Set(currentSheet.rows.map((r) => r.vessel_name.trim()).filter(Boolean)),
  );

  return (
    <div className="min-h-screen bg-slate-100 py-5 px-3 sm:px-6 print:bg-white print:p-0">
      <div className="max-w-6xl mx-auto space-y-3">
        {/* Public View Toolbar (Read-Only) */}
        <div className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 print:hidden">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-navy-900">
              <CalendarDays className="w-4 h-4 text-maritime-600" />
              LỊCH SÀ LAN VIETSUN
            </span>

            {payload.sheets.length > 1 && (
              <div className="flex items-center gap-1 ml-2">
                {payload.sheets.map((sh) => (
                  <button
                    key={sh.month_key}
                    type="button"
                    onClick={() => setSelectedMonth(sh.month_key)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold border ${
                      sh.month_key === currentSheet.month_key
                        ? 'bg-navy-900 text-white border-navy-900'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    Tháng {sh.month_key}
                  </button>
                ))}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-1 sm:ml-2">
              {['ALL', ...distinctVessels].map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setVesselFilter(v)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                    vesselFilter === v
                      ? 'bg-maritime-600 text-white border-maritime-600'
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {v === 'ALL' ? 'Tất cả sà lan' : v}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => exportSheetToCsv(currentSheet)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-300 bg-emerald-50 text-xs font-semibold text-emerald-800 hover:bg-emerald-100"
            >
              <Download className="w-3.5 h-3.5" /> Tải Excel (.csv)
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-navy-900 text-white text-xs font-semibold hover:bg-navy-800"
            >
              <Printer className="w-3.5 h-3.5" /> In / Lưu PDF
            </button>
          </div>
        </div>

        {/* Read-Only Official Excel Form */}
        <SailingScheduleSheetView
          sheet={currentSheet}
          editable={false}
          filterVessel={vesselFilter}
        />
      </div>
    </div>
  );
}
