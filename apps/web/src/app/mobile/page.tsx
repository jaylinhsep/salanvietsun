'use client';

import React, { useEffect, useState } from 'react';
import { CheckCircle2, MapPin, Navigation, Ship } from 'lucide-react';
import { API_URL, FALLBACK_VESSELS, FALLBACK_VOYAGES, fetchApi, type Vessel, type Voyage } from '@/lib/api';
import { StatusBadge } from '@/components/StatusBadge';

export default function MobileCaptainHomePage() {
  const [vessel, setVessel] = useState<Vessel>(FALLBACK_VESSELS[0]);
  const [voyage, setVoyage] = useState<Voyage | null>(FALLBACK_VOYAGES[0]);
  const [message, setMessage] = useState<string>('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchApi<{ vessel: Vessel | null; activeVoyage: Voyage | null }>(
      '/mobile/captain-summary?vesselCode=VS-SL-01',
      { vessel: FALLBACK_VESSELS[0], activeVoyage: FALLBACK_VOYAGES[0] },
    ).then((r) => {
      if (r.data.vessel) setVessel(r.data.vessel);
      if (r.data.activeVoyage) setVoyage(r.data.activeVoyage);
    });
  }, []);

  const handleCheckIn = (action: 'DEPART' | 'ARRIVE' | 'CHECKPOINT') => {
    setLoading(true);
    setMessage('');

    const submit = async (lat: number, lng: number) => {
      try {
        const res = await fetch(`${API_URL}/mobile/checkin`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            vessel_id: vessel.id,
            voyage_id: voyage?.id,
            lat,
            lng,
            action,
          }),
        });
        const data = await res.json();
        setMessage(
          `Đã gửi Check-in (${action}) tại ${lat.toFixed(4)}, ${lng.toFixed(4)} • Gần cảng: ${
            data.nearest_port?.name || 'Đang trên tuyến'
          }`,
        );
      } catch {
        setMessage(
          `[Offline/Demo] Đã ghi nhận Check-in (${action}) tại ${lat.toFixed(4)}, ${lng.toFixed(4)}`,
        );
      } finally {
        setLoading(false);
      }
    };

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => submit(pos.coords.latitude, pos.coords.longitude),
        () => submit(vessel.lat || 10.6721, vessel.lng || 106.8542),
        { timeout: 5000 },
      );
    } else {
      submit(vessel.lat || 10.6721, vessel.lng || 106.8542);
    }
  };

  return (
    <div className="space-y-4">
      {/* Vessel Card */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Ship className="w-5 h-5 text-maritime-600" />
            <span className="font-bold text-slate-900">{vessel.name}</span>
          </div>
          <StatusBadge status={vessel.status} />
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 pt-1">
          <div>
            Tồn dầu: <strong className="text-slate-900">{vessel.current_fuel_liters.toLocaleString('vi-VN')} L</strong>
          </div>
          <div>
            Tốc độ: <strong className="text-slate-900">{vessel.current_speed_knots} kn</strong>
          </div>
        </div>
      </div>

      {/* Active Voyage */}
      {voyage ? (
        <div className="bg-gradient-to-br from-navy-900 to-navy-700 text-white rounded-2xl p-4 shadow-md space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-sky-300 uppercase tracking-wider">
              Lệnh điều độ hiện tại
            </span>
            <span className="text-xs bg-white/15 px-2 py-0.5 rounded-full font-semibold">
              {voyage.voyage_no}
            </span>
          </div>
          <div>
            <div className="text-base font-bold">{voyage.origin_name}</div>
            <div className="text-sky-300 text-sm font-medium">→ {voyage.dest_name}</div>
          </div>
          <div className="text-xs text-slate-200 bg-white/10 rounded-xl p-3">
            <div>Hàng: <strong>{voyage.cargo_type || 'Container'}</strong> ({voyage.cargo_weight_tons || 0} tấn)</div>
            <div className="mt-1">Cự ly: <strong>{voyage.planned_distance_nm} hải lý</strong></div>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl p-5 text-center text-sm text-slate-500 border">
          Hiện chưa có lệnh điều độ nào đang chạy.
        </div>
      )}

      {/* Big Touch Actions */}
      <div className="space-y-2.5">
        <div className="text-xs font-semibold text-slate-500 uppercase px-1">Thao tác nhanh tại hiện trường</div>
        <button
          disabled={loading}
          onClick={() => handleCheckIn('CHECKPOINT')}
          className="w-full py-3.5 px-4 rounded-xl bg-maritime-600 text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-sm active:scale-[0.99]"
        >
          <Navigation className="w-4 h-4" /> Gửi vị trí GPS hiện tại
        </button>
        <div className="grid grid-cols-2 gap-2.5">
          <button
            disabled={loading}
            onClick={() => handleCheckIn('DEPART')}
            className="py-3 px-3 rounded-xl bg-emerald-600 text-white font-semibold text-xs flex items-center justify-center gap-1.5"
          >
            <MapPin className="w-4 h-4" /> Xác nhận Rời cảng
          </button>
          <button
            disabled={loading}
            onClick={() => handleCheckIn('ARRIVE')}
            className="py-3 px-3 rounded-xl bg-amber-600 text-white font-semibold text-xs flex items-center justify-center gap-1.5"
          >
            <CheckCircle2 className="w-4 h-4" /> Xác nhận Cập cảng
          </button>
        </div>
      </div>

      {message && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl p-3 font-medium">
          {message}
        </div>
      )}
    </div>
  );
}
