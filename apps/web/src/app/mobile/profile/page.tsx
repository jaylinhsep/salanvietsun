'use client';

import React from 'react';
import { Ship, ShieldCheck, Phone } from 'lucide-react';
import { FALLBACK_VESSELS } from '@/lib/api';

export default function MobileProfilePage() {
  const vessel = FALLBACK_VESSELS[0];

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl p-5 border border-slate-200 space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-sky-100 text-maritime-600 flex items-center justify-center">
            <Ship className="w-6 h-6" />
          </div>
          <div>
            <div className="font-bold text-slate-900">{vessel.name}</div>
            <div className="text-xs text-slate-500">
              Mã: {vessel.code} • Số ĐK: {vessel.registration_no}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 p-3 rounded-xl">
          <div>
            <div className="text-slate-500">Trọng tải</div>
            <div className="font-semibold">{vessel.capacity_tons.toLocaleString('vi-VN')} tấn</div>
          </div>
          <div>
            <div className="text-slate-500">Sức chở</div>
            <div className="font-semibold">{vessel.capacity_teu} TEU</div>
          </div>
          <div>
            <div className="text-slate-500">Máy chính</div>
            <div className="font-semibold">{vessel.main_engine_hp} HP</div>
          </div>
          <div>
            <div className="text-slate-500">Định mức</div>
            <div className="font-semibold">{vessel.fuel_norm_l_per_hour} L/giờ</div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-4 border border-slate-200 space-y-2 text-sm">
        <div className="flex items-center gap-2 font-semibold text-slate-900">
          <ShieldCheck className="w-4 h-4 text-emerald-600" /> Hồ sơ pháp lý & Đăng kiểm
        </div>
        <div className="text-xs text-slate-600">
          Hạn đăng kiểm: <strong>{vessel.inspection_expiry}</strong>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-4 border border-slate-200 space-y-2 text-sm">
        <div className="flex items-center gap-2 font-semibold text-slate-900">
          <Phone className="w-4 h-4 text-maritime-600" /> Liên hệ Điều độ Trung tâm
        </div>
        <div className="text-xs text-slate-600">Hotline 24/7: <strong>1900 6868</strong> (Phòng Điều độ VietSun)</div>
      </div>
    </div>
  );
}
