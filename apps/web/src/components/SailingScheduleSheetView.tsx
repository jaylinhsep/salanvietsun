'use client';

import React from 'react';
import { Anchor, ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { getBargeColorStyle } from '@/lib/barge-colors';
import {
  normalizeDateCellDisplay,
  type SailingScheduleRow,
  type SailingScheduleSheet,
} from '@/lib/sailing-schedule';

interface Props {
  sheet: SailingScheduleSheet;
  editable?: boolean;
  filterVessel?: string;
  vesselSuggestions?: string[];
  onChangeSheet?: (updater: (prev: SailingScheduleSheet) => SailingScheduleSheet) => void;
}

const DEFAULT_VESSEL_SUGGESTIONS = ['NHẬT VIỆT 18', 'NHẬT VIỆT 36', 'NHẬT VIỆT 38'];

export function SailingScheduleSheetView({
  sheet,
  editable = false,
  filterVessel = 'ALL',
  vesselSuggestions = DEFAULT_VESSEL_SUGGESTIONS,
  onChangeSheet,
}: Props) {
  const updateField = <K extends keyof SailingScheduleSheet>(
    field: K,
    value: SailingScheduleSheet[K],
  ) => {
    if (!onChangeSheet) return;
    onChangeSheet((prev) => ({ ...prev, [field]: value }));
  };

  const updateRow = (
    rowId: string,
    field: keyof SailingScheduleRow,
    value: string,
  ) => {
    if (!onChangeSheet) return;
    onChangeSheet((prev) => ({
      ...prev,
      rows: prev.rows.map((r) => (r.id === rowId ? { ...r, [field]: value } : r)),
    }));
  };

  const moveRow = (rowId: string, dir: -1 | 1) => {
    if (!onChangeSheet) return;
    onChangeSheet((prev) => {
      const idx = prev.rows.findIndex((r) => r.id === rowId);
      const nextIdx = idx + dir;
      if (idx < 0 || nextIdx < 0 || nextIdx >= prev.rows.length) return prev;
      const copy = [...prev.rows];
      const [item] = copy.splice(idx, 1);
      copy.splice(nextIdx, 0, item);
      return { ...prev, rows: copy };
    });
  };

  const deleteRow = (rowId: string) => {
    if (!onChangeSheet) return;
    onChangeSheet((prev) => ({
      ...prev,
      rows: prev.rows.filter((r) => r.id !== rowId),
    }));
  };

  const addRow = () => {
    if (!onChangeSheet) return;
    onChangeSheet((prev) => ({
      ...prev,
      rows: [
        ...prev.rows,
        {
          id: `row-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          vessel_name: 'NHẬT VIỆT 18',
          hcm_voy: '',
          hcm_etd: '',
          ct_eta: '',
          ct_voy: '',
          ct_etd: '',
          hcm_eta: '',
        },
      ],
    }));
  };

  const updateContact = (index: number, value: string) => {
    if (!onChangeSheet) return;
    onChangeSheet((prev) => {
      const next = [...prev.contacts];
      next[index] = value;
      return { ...prev, contacts: next };
    });
  };

  const addContact = () => {
    if (!onChangeSheet) return;
    onChangeSheet((prev) => ({
      ...prev,
      contacts: [...prev.contacts, 'Mr./Ms. ... / HP ...'],
    }));
  };

  const removeContact = (index: number) => {
    if (!onChangeSheet) return;
    onChangeSheet((prev) => ({
      ...prev,
      contacts: prev.contacts.filter((_, i) => i !== index),
    }));
  };

  const visibleRows =
    filterVessel === 'ALL'
      ? sheet.rows
      : sheet.rows.filter(
          (r) => r.vessel_name.trim().toUpperCase() === filterVessel.trim().toUpperCase(),
        );

  const uniqueSuggestions = Array.from(
    new Set([...DEFAULT_VESSEL_SUGGESTIONS, ...vesselSuggestions].filter(Boolean)),
  );

  return (
    <div
      className="bg-white border border-slate-300 shadow-sm rounded-xl overflow-hidden print:shadow-none print:border-slate-500 print:rounded-none"
      style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}
    >
      {editable && (
        <datalist id="sailing-schedule-vessels">
          {uniqueSuggestions.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>
      )}

      {/* Company Letterhead matching Excel top rows */}
      <div className="px-4 sm:px-8 pt-6 pb-4 border-b border-slate-300 bg-gradient-to-r from-white via-sky-50/40 to-white">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-navy-900 text-white flex items-center justify-center shadow-sm flex-shrink-0 print:bg-navy-900">
              <Anchor className="w-6 h-6" />
            </div>
            <div className="min-w-0 flex-1 space-y-0.5">
              {editable ? (
                <>
                  <input
                    type="text"
                    value={sheet.company_name}
                    onChange={(e) => updateField('company_name', e.target.value)}
                    className="w-full font-extrabold text-base sm:text-lg text-navy-900 bg-white/80 border border-slate-300 rounded px-2 py-0.5 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                  <input
                    type="text"
                    value={sheet.address}
                    onChange={(e) => updateField('address', e.target.value)}
                    className="w-full text-xs text-slate-700 bg-white/80 border border-slate-200 rounded px-2 py-0.5 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
                    <input
                      type="text"
                      value={sheet.tel_fax}
                      onChange={(e) => updateField('tel_fax', e.target.value)}
                      className="w-full text-xs text-slate-700 bg-white/80 border border-slate-200 rounded px-2 py-0.5 focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                    <input
                      type="text"
                      value={sheet.email_web}
                      onChange={(e) => updateField('email_web', e.target.value)}
                      className="w-full text-xs text-slate-700 bg-white/80 border border-slate-200 rounded px-2 py-0.5 focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>
                </>
              ) : (
                <>
                  <h1 className="font-extrabold text-base sm:text-xl tracking-wide text-navy-900 uppercase">
                    {sheet.company_name}
                  </h1>
                  <p className="text-xs sm:text-sm text-slate-700">{sheet.address}</p>
                  <p className="text-xs sm:text-sm text-slate-700">{sheet.tel_fax}</p>
                  <p className="text-xs sm:text-sm text-sky-800 font-medium">{sheet.email_web}</p>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Excel Schedule Title Banner */}
      <div className="bg-[#1B365D] text-white px-4 py-3 text-center border-b border-slate-500">
        {editable ? (
          <input
            type="text"
            value={sheet.title}
            onChange={(e) => updateField('title', e.target.value)}
            className="w-full max-w-3xl mx-auto block text-center font-bold text-sm sm:text-lg uppercase tracking-wide bg-white/15 text-white placeholder-white/70 border border-white/30 rounded px-3 py-1 focus:outline-none focus:ring-2 focus:ring-sky-300"
          />
        ) : (
          <h2 className="font-bold text-sm sm:text-lg uppercase tracking-wide">
            {sheet.title}
          </h2>
        )}
      </div>

      {/* Excel Schedule Grid Table */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-xs sm:text-sm min-w-[760px]">
          <thead>
            <tr className="bg-[#DCE6F1] text-slate-900 font-bold text-center">
              <th
                rowSpan={2}
                className="border border-slate-400 px-3 py-2.5 align-middle w-[170px] bg-[#D0DCEB]"
              >
                {editable ? (
                  <input
                    type="text"
                    value={sheet.col_vessel_label}
                    onChange={(e) => updateField('col_vessel_label', e.target.value)}
                    className="w-full text-center font-bold bg-white/70 border border-slate-300 rounded px-1 py-0.5 text-xs"
                  />
                ) : (
                  sheet.col_vessel_label
                )}
              </th>
              <th
                colSpan={2}
                className="border border-slate-400 px-3 py-2 bg-[#E2ECF7]"
              >
                {editable ? (
                  <div className="space-y-1">
                    <input
                      type="text"
                      value={sheet.group1_title}
                      onChange={(e) => updateField('group1_title', e.target.value)}
                      className="w-full text-center font-bold bg-white/80 border border-slate-300 rounded px-1.5 py-0.5 text-xs"
                    />
                    <input
                      type="text"
                      value={sheet.group1_subtitle}
                      onChange={(e) => updateField('group1_subtitle', e.target.value)}
                      className="w-full text-center font-semibold bg-white/70 border border-slate-300 rounded px-1.5 py-0.5 text-[11px]"
                    />
                  </div>
                ) : (
                  <>
                    <div className="font-bold">{sheet.group1_title}</div>
                    {sheet.group1_subtitle && (
                      <div className="text-[11px] font-semibold text-slate-700 mt-0.5">
                        {sheet.group1_subtitle}
                      </div>
                    )}
                  </>
                )}
              </th>
              <th
                colSpan={3}
                className="border border-slate-400 px-3 py-2 bg-[#DCEBD7]"
              >
                {editable ? (
                  <div className="space-y-1">
                    <input
                      type="text"
                      value={sheet.group2_title}
                      onChange={(e) => updateField('group2_title', e.target.value)}
                      className="w-full text-center font-bold bg-white/80 border border-slate-300 rounded px-1.5 py-0.5 text-xs"
                    />
                    <input
                      type="text"
                      value={sheet.group2_subtitle}
                      onChange={(e) => updateField('group2_subtitle', e.target.value)}
                      className="w-full text-center font-semibold bg-white/70 border border-slate-300 rounded px-1.5 py-0.5 text-[11px]"
                    />
                  </div>
                ) : (
                  <>
                    <div className="font-bold">{sheet.group2_title}</div>
                    {sheet.group2_subtitle && (
                      <div className="text-[11px] font-semibold text-slate-700 mt-0.5">
                        {sheet.group2_subtitle}
                      </div>
                    )}
                  </>
                )}
              </th>
              <th
                colSpan={1}
                className="border border-slate-400 px-3 py-2 bg-[#E2ECF7] align-middle"
              >
                {editable ? (
                  <input
                    type="text"
                    value={sheet.group3_title}
                    onChange={(e) => updateField('group3_title', e.target.value)}
                    className="w-full text-center font-bold bg-white/80 border border-slate-300 rounded px-1.5 py-0.5 text-xs"
                  />
                ) : (
                  <div className="font-bold">{sheet.group3_title}</div>
                )}
              </th>
              {editable && (
                <th
                  rowSpan={2}
                  className="border border-slate-400 px-2 py-2 bg-slate-100 text-slate-700 w-[108px] print:hidden"
                >
                  Thao tác
                </th>
              )}
            </tr>
            <tr className="bg-[#EEF3F9] text-slate-800 font-bold text-center text-xs">
              <th className="border border-slate-400 px-2 py-1.5 w-[135px]">VOY</th>
              <th className="border border-slate-400 px-2 py-1.5 w-[90px]">ETD</th>
              <th className="border border-slate-400 px-2 py-1.5 w-[90px] bg-[#E8F1E4]">ETA</th>
              <th className="border border-slate-400 px-2 py-1.5 w-[135px] bg-[#E8F1E4]">VOY</th>
              <th className="border border-slate-400 px-2 py-1.5 w-[90px] bg-[#E8F1E4]">ETD</th>
              <th className="border border-slate-400 px-2 py-1.5 w-[90px]">ETA</th>
            </tr>
          </thead>

          <tbody>
            {visibleRows.length === 0 ? (
              <tr>
                <td
                  colSpan={editable ? 8 : 7}
                  className="border border-slate-300 px-4 py-8 text-center text-slate-400 italic"
                >
                  Chưa có dòng lịch chạy sà lan nào.
                </td>
              </tr>
            ) : (
              visibleRows.map((row) => {
                const color = getBargeColorStyle(row.vessel_name);
                return (
                  <tr
                    key={row.id}
                    className={`${color.rowClass} text-slate-900 transition-colors`}
                  >
                    <td className="border border-slate-400 px-2.5 py-1.5 font-bold whitespace-nowrap">
                      {editable ? (
                        <input
                          type="text"
                          list="sailing-schedule-vessels"
                          value={row.vessel_name}
                          onChange={(e) => updateRow(row.id, 'vessel_name', e.target.value)}
                          placeholder="NHẬT VIỆT 18"
                          className="w-full bg-white/75 focus:bg-white border border-slate-300/80 rounded px-2 py-1 font-bold text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                        />
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${color.dotClass}`} />
                          <span>{row.vessel_name}</span>
                        </div>
                      )}
                    </td>
                    <td className="border border-slate-400 px-2 py-1.5 text-center font-semibold font-mono whitespace-nowrap">
                      {editable ? (
                        <input
                          type="text"
                          value={row.hcm_voy}
                          onChange={(e) => updateRow(row.id, 'hcm_voy', e.target.value)}
                          placeholder="V18 - 4626W"
                          className="w-full text-center bg-white/75 focus:bg-white border border-slate-300/80 rounded px-1.5 py-1 font-mono font-semibold text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                        />
                      ) : (
                        row.hcm_voy
                      )}
                    </td>
                    <td className="border border-slate-400 px-2 py-1.5 text-center font-medium whitespace-nowrap">
                      {editable ? (
                        <input
                          type="text"
                          value={row.hcm_etd}
                          onChange={(e) => updateRow(row.id, 'hcm_etd', e.target.value)}
                          placeholder="29/10"
                          className="w-full text-center bg-white/75 focus:bg-white border border-slate-300/80 rounded px-1.5 py-1 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                        />
                      ) : (
                        normalizeDateCellDisplay(row.hcm_etd)
                      )}
                    </td>
                    <td className="border border-slate-400 px-2 py-1.5 text-center font-medium whitespace-nowrap">
                      {editable ? (
                        <input
                          type="text"
                          value={row.ct_eta}
                          onChange={(e) => updateRow(row.id, 'ct_eta', e.target.value)}
                          placeholder="30/10"
                          className="w-full text-center bg-white/75 focus:bg-white border border-slate-300/80 rounded px-1.5 py-1 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                        />
                      ) : (
                        normalizeDateCellDisplay(row.ct_eta)
                      )}
                    </td>
                    <td className="border border-slate-400 px-2 py-1.5 text-center font-semibold font-mono whitespace-nowrap">
                      {editable ? (
                        <input
                          type="text"
                          value={row.ct_voy}
                          onChange={(e) => updateRow(row.id, 'ct_voy', e.target.value)}
                          placeholder="V18 - 4626E"
                          className="w-full text-center bg-white/75 focus:bg-white border border-slate-300/80 rounded px-1.5 py-1 font-mono font-semibold text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                        />
                      ) : (
                        row.ct_voy
                      )}
                    </td>
                    <td className="border border-slate-400 px-2 py-1.5 text-center font-medium whitespace-nowrap">
                      {editable ? (
                        <input
                          type="text"
                          value={row.ct_etd}
                          onChange={(e) => updateRow(row.id, 'ct_etd', e.target.value)}
                          placeholder="01/11"
                          className="w-full text-center bg-white/75 focus:bg-white border border-slate-300/80 rounded px-1.5 py-1 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                        />
                      ) : (
                        normalizeDateCellDisplay(row.ct_etd)
                      )}
                    </td>
                    <td className="border border-slate-400 px-2 py-1.5 text-center font-medium whitespace-nowrap">
                      {editable ? (
                        <input
                          type="text"
                          value={row.hcm_eta}
                          onChange={(e) => updateRow(row.id, 'hcm_eta', e.target.value)}
                          placeholder="02/11"
                          className="w-full text-center bg-white/75 focus:bg-white border border-slate-300/80 rounded px-1.5 py-1 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                        />
                      ) : (
                        normalizeDateCellDisplay(row.hcm_eta)
                      )}
                    </td>
                    {editable && (
                      <td className="border border-slate-400 px-1.5 py-1 text-center bg-white/80 print:hidden">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => moveRow(row.id, -1)}
                            title="Chuyển lên"
                            className="p-1 rounded border border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => moveRow(row.id, 1)}
                            title="Chuyển xuống"
                            className="p-1 rounded border border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteRow(row.id)}
                            title="Xóa dòng"
                            className="p-1 rounded border border-rose-200 bg-white text-rose-600 hover:bg-rose-50"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {editable && (
        <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-300 flex items-center justify-between">
          <button
            type="button"
            onClick={addRow}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-maritime-600 text-white text-xs font-semibold hover:bg-maritime-500 shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" /> Thêm dòng lịch chạy
          </button>
          <span className="text-xs text-slate-500">
            Tổng: <strong>{sheet.rows.length}</strong> vòng quay / dòng lịch
          </span>
        </div>
      )}

      {/* Footnote & Contact Info matching Excel bottom section */}
      <div className="px-4 sm:px-8 py-4 bg-white space-y-3 text-xs sm:text-sm">
        {editable ? (
          <input
            type="text"
            value={sheet.footnote}
            onChange={(e) => updateField('footnote', e.target.value)}
            className="w-full italic text-rose-700 font-medium border border-slate-200 rounded px-2.5 py-1 focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
        ) : (
          <p className="italic text-rose-700 font-medium">{sheet.footnote}</p>
        )}

        <div className="pt-1 border-t border-slate-200 space-y-1.5">
          {editable ? (
            <input
              type="text"
              value={sheet.contact_title}
              onChange={(e) => updateField('contact_title', e.target.value)}
              className="font-bold text-navy-900 uppercase border border-slate-200 rounded px-2 py-0.5 text-xs sm:text-sm"
            />
          ) : (
            <div className="font-bold text-navy-900 uppercase tracking-wide">
              {sheet.contact_title}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-slate-800">
            {sheet.contacts.map((line, idx) =>
              editable ? (
                <div key={idx} className="flex items-center gap-1">
                  <input
                    type="text"
                    value={line}
                    onChange={(e) => updateContact(idx, e.target.value)}
                    className="flex-1 border border-slate-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                  <button
                    type="button"
                    onClick={() => removeContact(idx)}
                    className="p-1 text-rose-600 hover:bg-rose-50 rounded border border-rose-200"
                    title="Xóa liên hệ"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <div key={idx} className="font-medium">
                  {line}
                </div>
              ),
            )}
          </div>

          {editable && (
            <button
              type="button"
              onClick={addContact}
              className="inline-flex items-center gap-1 text-xs font-medium text-sky-700 hover:text-sky-800"
            >
              <Plus className="w-3.5 h-3.5" /> Thêm người liên hệ
            </button>
          )}

          <div>
            {editable ? (
              <input
                type="text"
                value={sheet.contact_email}
                onChange={(e) => updateField('contact_email', e.target.value)}
                className="w-full max-w-md border border-slate-200 rounded px-2 py-1 text-xs font-medium text-sky-800 focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            ) : (
              <div className="font-semibold text-sky-800 pt-0.5">{sheet.contact_email}</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
