'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Camera,
  CheckCircle2,
  Clock,
  CloudOff,
  Fuel,
  MapPin,
  RefreshCw,
  Ship,
  Wifi,
  WifiOff,
} from 'lucide-react';
import type { Vessel, Voyage } from '@/lib/api';
import {
  CAPTAIN_STEPS,
  compressImageToDataUrl,
  getOfflineCaptainQueue,
  loadWorkflowSnapshot,
  submitCaptainStepAction,
  syncOfflineCaptainQueue,
} from '@/lib/workflow-store';
import { StatusBadge } from '@/components/StatusBadge';

const SELECTED_VESSEL_KEY = 'vietsun_mobile_selected_vessel_v1';

export default function MobileCaptainHomePage() {
  const [vessels, setVessels] = useState<Vessel[]>([]);
  const [voyages, setVoyages] = useState<Voyage[]>([]);
  const [selectedVesselId, setSelectedVesselId] = useState<string>('');

  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [simulateOffline, setSimulateOffline] = useState<boolean>(false);
  const [queueCount, setQueueCount] = useState<number>(0);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [busyStep, setBusyStep] = useState<number | null>(null);

  // Step 1 inputs (Dầu đầu)
  const [fuelStart, setFuelStart] = useState<string>('');
  const [fuelStartPhoto, setFuelStartPhoto] = useState<string>('');

  // Step 5 inputs (Dầu cuối + Cấp thêm + POD)
  const [fuelAdded, setFuelAdded] = useState<string>('0');
  const [fuelEnd, setFuelEnd] = useState<string>('');
  const [podPhoto, setPodPhoto] = useState<string>('');
  const [stepNote, setStepNote] = useState<string>('');

  const effectiveOffline = !isOnline || simulateOffline;

  const refreshAll = async () => {
    const snap = await loadWorkflowSnapshot();
    setVessels(snap.vessels);
    setVoyages(snap.voyages);
    setQueueCount(getOfflineCaptainQueue().length);

    if (!selectedVesselId && snap.vessels.length > 0) {
      const saved =
        typeof window !== 'undefined' ? localStorage.getItem(SELECTED_VESSEL_KEY) : null;
      const initial =
        snap.vessels.find((v) => v.id === saved || v.code === saved) ||
        snap.vessels.find((v) =>
          snap.voyages.some(
            (vy) => vy.vessel_id === v.id && ['PLANNED', 'IN_TRANSIT', 'ARRIVED'].includes(vy.status),
          ),
        ) ||
        snap.vessels[0];
      if (initial) setSelectedVesselId(initial.id);
    }
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsOnline(navigator.onLine);
      const handleOnline = async () => {
        setIsOnline(true);
        if (!simulateOffline) {
          const res = await syncOfflineCaptainQueue();
          setQueueCount(res.remaining);
          if (res.flushed > 0) {
            setStatusMessage(`Đã có sóng 4G: Tự động đồng bộ ${res.flushed} báo cáo offline về máy chủ.`);
            refreshAll();
          }
        }
      };
      const handleOffline = () => setIsOnline(false);
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
      refreshAll();
      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const vessel = useMemo(
    () => vessels.find((v) => v.id === selectedVesselId) || vessels[0] || null,
    [vessels, selectedVesselId],
  );

  // Focus ONLY 1 active voyage on current barge
  const activeVoyage = useMemo(() => {
    if (!vessel) return null;
    return (
      voyages.find(
        (vy) =>
          vy.vessel_id === vessel.id &&
          ['PLANNED', 'DEPARTED', 'IN_TRANSIT', 'ARRIVED'].includes(vy.status),
      ) ||
      voyages.find((vy) => vy.vessel_id === vessel.id) ||
      null
    );
  }, [voyages, vessel]);

  useEffect(() => {
    if (vessel && !fuelStart) {
      setFuelStart(String(activeVoyage?.fuel_start_liters || vessel.current_fuel_liters || 5000));
    }
  }, [vessel, activeVoyage, fuelStart]);

  const currentStep = Number(activeVoyage?.workflow_step || 0);

  const laytimeText = useMemo(() => {
    const start = activeVoyage?.laytime_start_at || activeVoyage?.ata;
    if (!start) return null;
    const mins = Math.max(0, Math.round((Date.now() - new Date(start).getTime()) / 60000));
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h} giờ ${m} phút tại cảng đích`;
  }, [activeVoyage]);

  const handlePhotoUpload = async (
    file: File | undefined,
    setter: React.Dispatch<React.SetStateAction<string>>,
  ) => {
    if (!file) return;
    const dataUrl = await compressImageToDataUrl(file);
    setter(dataUrl);
  };

  const handleTriggerStep = async (step: 1 | 2 | 3 | 4 | 5) => {
    if (!vessel || !activeVoyage) {
      setStatusMessage('Sà lan hiện chưa có lệnh điều độ chuyến.');
      return;
    }
    setBusyStep(step);
    setStatusMessage('');

    const getCoords = (): Promise<{ lat: number; lng: number }> =>
      new Promise((resolve) => {
        if (typeof navigator !== 'undefined' && navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
            () => resolve({ lat: Number(vessel.lat || 10.6721), lng: Number(vessel.lng || 106.8542) }),
            { timeout: 3000 },
          );
        } else {
          resolve({ lat: Number(vessel.lat || 10.6721), lng: Number(vessel.lng || 106.8542) });
        }
      });

    try {
      const coords = await getCoords();
      const res = await submitCaptainStepAction(
        {
          vessel_id: vessel.id,
          vessel_name: vessel.name,
          voyage_id: activeVoyage.id,
          voyage_no: activeVoyage.voyage_no,
          step,
          lat: coords.lat,
          lng: coords.lng,
          fuel_start_liters: step === 1 ? Number(fuelStart || 0) : undefined,
          fuel_added_liters: step === 5 ? Number(fuelAdded || 0) : undefined,
          fuel_end_liters: step === 5 ? Number(fuelEnd || 0) : undefined,
          fuel_start_photo_url: step === 1 && fuelStartPhoto ? fuelStartPhoto : undefined,
          pod_photo_url: step === 5 && podPhoto ? podPhoto : undefined,
          notes: stepNote || undefined,
          timestamp: new Date().toISOString(),
        },
        simulateOffline,
      );

      setQueueCount(res.queuedCount);
      setStepNote('');
      setStatusMessage(
        res.synced
          ? `Đã ghi nhận & gửi Bước ${step} (${CAPTAIN_STEPS[step - 1].shortTitle}) lúc ${new Date().toLocaleTimeString('vi-VN')}.`
          : `[Lưu Offline] Đã lưu Bước ${step} vào bộ nhớ máy (chờ đồng bộ: ${res.queuedCount}). Sẽ tự đẩy khi có 4G!`,
      );
      await refreshAll();
    } finally {
      setBusyStep(null);
    }
  };

  const handleManualSync = async () => {
    if (simulateOffline) {
      setStatusMessage('Hãy tắt chế độ "Giả lập mất sóng 4G" trước khi đồng bộ.');
      return;
    }
    const res = await syncOfflineCaptainQueue();
    setQueueCount(res.remaining);
    setStatusMessage(
      res.flushed > 0
        ? `Đã đồng bộ thành công ${res.flushed} báo cáo lên hệ thống.`
        : 'Không có báo cáo nào đang chờ hoặc máy chủ chưa mở đồng bộ.',
    );
    await refreshAll();
  };

  return (
    <div className="space-y-4 pb-6">
      {/* Network / Offline Queue Banner */}
      <div
        className={`rounded-2xl p-3 border text-xs flex flex-col gap-2 ${
          effectiveOffline
            ? 'bg-amber-50 border-amber-300 text-amber-900'
            : 'bg-emerald-50 border-emerald-200 text-emerald-900'
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 font-semibold">
            {effectiveOffline ? (
              <WifiOff className="w-4 h-4 text-amber-600" />
            ) : (
              <Wifi className="w-4 h-4 text-emerald-600" />
            )}
            <span>
              {effectiveOffline
                ? 'Đang mất sóng 4G — Lưu Offline trên máy'
                : 'Đang trực tuyến — Đồng bộ tức thì'}
            </span>
          </div>

          <button
            type="button"
            onClick={() => setSimulateOffline((v) => !v)}
            className={`px-2.5 py-1 rounded-lg font-medium border text-[11px] ${
              simulateOffline
                ? 'bg-amber-600 text-white border-amber-700'
                : 'bg-white text-slate-700 border-slate-300'
            }`}
          >
            {simulateOffline ? 'Bật lại 4G' : 'Giả lập mất sóng'}
          </button>
        </div>

        {queueCount > 0 && (
          <div className="flex items-center justify-between bg-white/80 rounded-lg px-2.5 py-1.5 border border-amber-200">
            <span className="flex items-center gap-1.5 font-semibold text-amber-800">
              <CloudOff className="w-3.5 h-3.5" /> Chờ đẩy lên server: {queueCount} báo cáo
            </span>
            <button
              type="button"
              onClick={handleManualSync}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-navy-900 text-white text-[11px] font-medium"
            >
              <RefreshCw className="w-3 h-3" /> Đồng bộ
            </button>
          </div>
        )}
      </div>

      {/* Barge Selector (sticky for Captain) */}
      <div className="bg-white rounded-2xl p-3.5 border border-slate-200 shadow-sm space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Ship className="w-4 h-4 text-maritime-600" />
            <span className="text-xs font-semibold text-slate-500 uppercase">Tàu / Sà lan của tôi</span>
          </div>
          {vessel && <StatusBadge status={vessel.status} />}
        </div>
        <select
          className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm font-bold text-slate-900 bg-slate-50"
          value={selectedVesselId}
          onChange={(e) => {
            setSelectedVesselId(e.target.value);
            if (typeof window !== 'undefined') {
              localStorage.setItem(SELECTED_VESSEL_KEY, e.target.value);
            }
          }}
        >
          {vessels.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name} ({v.code}) — Dầu: {Number(v.current_fuel_liters || 0).toLocaleString('vi-VN')} L
            </option>
          ))}
        </select>
      </div>

      {/* Single Active Voyage Focus Card */}
      {activeVoyage ? (
        <div className="bg-gradient-to-br from-navy-900 to-navy-800 text-white rounded-2xl p-4 shadow-md space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-sky-300 uppercase tracking-wider">
              Chuyến hiện tại • Bước {currentStep}/5
            </span>
            <span className="text-xs bg-white/15 px-2.5 py-0.5 rounded-full font-bold">
              {activeVoyage.voyage_no}
            </span>
          </div>

          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-base font-bold">{activeVoyage.origin_name || 'Cảng đi'}</div>
              <div className="text-sky-300 text-sm font-semibold">
                → {activeVoyage.dest_name || 'Cảng đến'}
              </div>
            </div>
            <div className="text-right">
              <div className="text-xl font-extrabold text-amber-300">
                {activeVoyage.total_teus || 0} TEUs
              </div>
              <div className="text-[11px] text-slate-300">
                {activeVoyage.cont_20e || 0}×20E • {activeVoyage.cont_20f || 0}×20F •{' '}
                {activeVoyage.cont_40e || 0}×40E • {activeVoyage.cont_40f || 0}×40F
              </div>
            </div>
          </div>

          {activeVoyage.booking_nos && (
            <div className="text-xs bg-white/10 rounded-lg px-2.5 py-1.5 text-sky-100">
              Booking: <strong>{activeVoyage.booking_nos}</strong>
            </div>
          )}

          {laytimeText && (
            <div className="flex items-center gap-1.5 text-xs bg-emerald-500/20 border border-emerald-400/30 rounded-lg px-2.5 py-1.5 text-emerald-200">
              <Clock className="w-3.5 h-3.5" /> Đang tính Laytime: <strong>{laytimeText}</strong>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl p-5 border border-slate-200 text-center text-sm text-slate-500">
          Sà lan chưa có chuyến đang điều độ. Khi Điều độ viên ghép Booking vào tàu, lệnh sẽ hiện tại đây.
        </div>
      )}

      {statusMessage && (
        <div className="p-3 rounded-xl bg-sky-50 border border-sky-200 text-xs text-sky-900 font-medium">
          {statusMessage}
        </div>
      )}

      {/* 5 Sequential Big Action Cards */}
      {activeVoyage && (
        <div className="space-y-3">
          {CAPTAIN_STEPS.map((st) => {
            const done = currentStep >= st.step;
            const isNext = currentStep + 1 === st.step || (currentStep === 0 && st.step === 1);

            return (
              <div
                key={st.step}
                className={`rounded-2xl border p-4 space-y-3 transition-all ${
                  done
                    ? 'bg-emerald-50/70 border-emerald-300'
                    : isNext
                      ? 'bg-white border-maritime-500 ring-2 ring-maritime-100 shadow-sm'
                      : 'bg-white border-slate-200 opacity-85'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-bold text-sm text-slate-900">{st.title}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{st.desc}</div>
                  </div>
                  {done && <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />}
                </div>

                {/* Extra inputs for Step 1 */}
                {st.step === 1 && !done && (
                  <div className="grid grid-cols-1 gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-xs">
                    <div>
                      <label className="font-semibold text-slate-700 flex items-center gap-1">
                        <Fuel className="w-3.5 h-3.5 text-emerald-600" /> Số lít dầu tồn đầu chuyến (L)
                      </label>
                      <input
                        type="number"
                        className="w-full border rounded-lg px-3 py-2 mt-1 bg-white text-sm font-bold"
                        value={fuelStart}
                        onChange={(e) => setFuelStart(e.target.value)}
                      />
                    </div>
                    <label className="inline-flex items-center justify-center gap-2 py-2 px-3 rounded-lg border border-dashed border-slate-400 bg-white text-slate-700 cursor-pointer font-medium">
                      <Camera className="w-4 h-4 text-maritime-600" />
                      {fuelStartPhoto ? 'Đã đính kèm ảnh thước dầu ✓' : 'Chụp / Chọn ảnh thước dầu đầu'}
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        onChange={(e) => handlePhotoUpload(e.target.files?.[0], setFuelStartPhoto)}
                      />
                    </label>
                  </div>
                )}

                {/* Extra inputs for Step 5 */}
                {st.step === 5 && currentStep < 5 && (
                  <div className="space-y-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-xs">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="font-semibold text-slate-700">Cấp thêm giữa chuyến (L)</label>
                        <input
                          type="number"
                          className="w-full border rounded-lg px-2.5 py-2 mt-1 bg-white font-bold"
                          value={fuelAdded}
                          onChange={(e) => setFuelAdded(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="font-semibold text-slate-700">Tồn dầu cuối chuyến (L)</label>
                        <input
                          type="number"
                          className="w-full border rounded-lg px-2.5 py-2 mt-1 bg-white font-bold"
                          value={fuelEnd}
                          onChange={(e) => setFuelEnd(e.target.value)}
                          placeholder="VD: 4100"
                        />
                      </div>
                    </div>
                    <label className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg border border-dashed border-maritime-400 bg-white text-maritime-700 cursor-pointer font-semibold">
                      <Camera className="w-4 h-4" />
                      {podPhoto ? 'Đã chụp biên bản POD ✓' : 'Chụp ảnh Biên bản Giao nhận (POD)'}
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        onChange={(e) => handlePhotoUpload(e.target.files?.[0], setPodPhoto)}
                      />
                    </label>
                    <input
                      className="w-full border rounded-lg px-2.5 py-1.5 bg-white"
                      placeholder="Ghi chú hoàn thành dỡ hàng (nếu có)..."
                      value={stepNote}
                      onChange={(e) => setStepNote(e.target.value)}
                    />
                  </div>
                )}

                <button
                  type="button"
                  disabled={busyStep === st.step}
                  onClick={() => handleTriggerStep(st.step)}
                  className={`w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-colors ${
                    done
                      ? 'bg-emerald-600/15 text-emerald-800 border border-emerald-300'
                      : isNext
                        ? 'bg-maritime-600 text-white hover:bg-maritime-500 shadow-sm'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <MapPin className="w-4 h-4" />
                  {busyStep === st.step
                    ? 'Đang ghi nhận...'
                    : done
                      ? `Đã hoàn thành (${st.shortTitle}) — Bấm gửi lại`
                      : `XÁC NHẬN: ${st.shortTitle.toUpperCase()}`}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
