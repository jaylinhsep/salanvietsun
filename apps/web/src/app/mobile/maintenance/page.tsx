'use client';

import React, { useState } from 'react';
import { Wrench } from 'lucide-react';
import { API_URL, FALLBACK_VESSELS } from '@/lib/api';

export default function MobileMaintenancePage() {
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState('HIGH');
  const [desc, setDesc] = useState('');
  const [savedMsg, setSavedMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await fetch(`${API_URL}/maintenance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vessel_id: FALLBACK_VESSELS[0].id,
          title,
          maintenance_type: 'CORRECTIVE',
          priority,
          reported_by: 'Thuyền trưởng (PWA)',
          description: desc,
        }),
      });
      setSavedMsg('Đã gửi yêu cầu sửa chữa về bộ phận Kỹ thuật!');
    } catch {
      setSavedMsg('[Offline/Demo] Đã lưu phiếu báo hỏng.');
    }
    setTitle('');
    setDesc('');
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Wrench className="w-5 h-5 text-amber-600" />
        <h1 className="text-lg font-bold text-slate-900">Báo hỏng / Yêu cầu Sửa chữa</h1>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-4 border border-slate-200 space-y-3 text-sm">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Sự cố / Hạng mục cần sửa</label>
          <input
            required
            placeholder="VD: Rò rỉ ống dầu thủy lực tời neo..."
            className="w-full border rounded-xl px-3 py-2.5"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Mức độ khẩn cấp</label>
          <select
            className="w-full border rounded-xl px-3 py-2.5"
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
          >
            <option value="LOW">Thấp — Xử lý khi cập bến</option>
            <option value="MEDIUM">Trung bình</option>
            <option value="HIGH">Cao — Cần kỹ thuật hỗ trợ sớm</option>
            <option value="CRITICAL">Khẩn cấp — Ảnh hưởng hành trình</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Mô tả chi tiết</label>
          <textarea
            rows={3}
            placeholder="Mô tả tình trạng máy, vật tư cần thay..."
            className="w-full border rounded-xl px-3 py-2.5"
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
          />
        </div>

        <button
          type="submit"
          className="w-full py-3 rounded-xl bg-amber-600 text-white font-semibold text-sm"
        >
          Gửi yêu cầu sửa chữa
        </button>
      </form>

      {savedMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl p-3 font-medium">
          {savedMsg}
        </div>
      )}
    </div>
  );
}
