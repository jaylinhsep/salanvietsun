'use client';

import React, { useEffect, useState } from 'react';
import { Cpu, Pencil, Plus, Ship, Trash2 } from 'lucide-react';
import { API_URL, FALLBACK_VESSELS, fetchApi, type Vessel, type VesselEquipment } from '@/lib/api';
import { StatusBadge } from '@/components/StatusBadge';

const EMPTY_VESSEL_FORM = {
  code: '',
  name: '',
  registration_no: '',
  vessel_type: 'SELF_PROPELLED' as Vessel['vessel_type'],
  capacity_tons: 2000,
  capacity_teu: 80,
  main_engine_hp: 1000,
  fuel_norm_l_per_hour: 55,
  status: 'AVAILABLE' as Vessel['status'],
  inspection_expiry: '2027-06-01',
  captain_name: '',
  captain_phone: '',
};

const EMPTY_EQ_FORM = {
  name: '',
  category: 'MAIN_ENGINE' as VesselEquipment['category'],
  serial_no: '',
  running_hours: 0,
  next_service_hours: 500,
  status: 'OPERATIONAL' as VesselEquipment['status'],
};

const CATEGORY_LABELS: Record<string, string> = {
  MAIN_ENGINE: 'Máy chính',
  GENERATOR: 'Máy phát điện',
  GPS_AIS: 'Thiết bị AIS / GPS',
  WINCH: 'Tời neo / Tời kéo',
  CRANE: 'Cẩu hàng',
};

export default function FleetPage() {
  const [vessels, setVessels] = useState<Vessel[]>(FALLBACK_VESSELS);
  const [filter, setFilter] = useState<string>('ALL');

  // Create / Edit Vessel modal state
  const [showVesselModal, setShowVesselModal] = useState(false);
  const [editingVesselId, setEditingVesselId] = useState<string | null>(null);
  const [vesselForm, setVesselForm] = useState(EMPTY_VESSEL_FORM);

  // Equipment modal state
  const [equipmentVessel, setEquipmentVessel] = useState<Vessel | null>(null);
  const [equipmentList, setEquipmentList] = useState<VesselEquipment[]>([]);
  const [editingEqId, setEditingEqId] = useState<string | null>(null);
  const [eqForm, setEqForm] = useState(EMPTY_EQ_FORM);

  const loadVessels = () => {
    fetchApi<Vessel[]>('/fleet/vessels', FALLBACK_VESSELS).then((r) => setVessels(r.data));
  };

  useEffect(() => {
    loadVessels();
  }, []);

  const openCreateVessel = () => {
    setEditingVesselId(null);
    setVesselForm(EMPTY_VESSEL_FORM);
    setShowVesselModal(true);
  };

  const openEditVessel = (v: Vessel) => {
    setEditingVesselId(v.id);
    setVesselForm({
      code: v.code,
      name: v.name,
      registration_no: v.registration_no,
      vessel_type: v.vessel_type,
      capacity_tons: v.capacity_tons,
      capacity_teu: v.capacity_teu,
      main_engine_hp: v.main_engine_hp,
      fuel_norm_l_per_hour: v.fuel_norm_l_per_hour,
      status: v.status,
      inspection_expiry: v.inspection_expiry ? v.inspection_expiry.slice(0, 10) : '',
      captain_name: v.captain_name || '',
      captain_phone: v.captain_phone || '',
    });
    setShowVesselModal(true);
  };

  const handleSaveVessel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingVesselId) {
      try {
        const res = await fetch(`${API_URL}/fleet/vessels/${editingVesselId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(vesselForm),
        });
        if (!res.ok) throw new Error('Update failed');
        loadVessels();
      } catch {
        setVessels((prev) =>
          prev.map((v) => (v.id === editingVesselId ? { ...v, ...vesselForm } : v)),
        );
      }
    } else {
      try {
        const res = await fetch(`${API_URL}/fleet/vessels`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(vesselForm),
        });
        if (!res.ok) throw new Error('Create failed');
        loadVessels();
      } catch {
        setVessels((prev) => [
          ...prev,
          {
            id: `local-${Date.now()}`,
            ...vesselForm,
            lat: 10.7615,
            lng: 106.7918,
            current_speed_knots: 0,
            current_fuel_liters: 5000,
          } as Vessel,
        ]);
      }
    }
    setShowVesselModal(false);
  };

  const openEquipmentModal = async (v: Vessel) => {
    setEquipmentVessel(v);
    setEditingEqId(null);
    setEqForm(EMPTY_EQ_FORM);
    const { data } = await fetchApi<VesselEquipment[]>(`/fleet/equipment?vesselId=${v.id}`, []);
    setEquipmentList(data);
  };

  const handleSaveEquipment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!equipmentVessel) return;

    if (editingEqId) {
      try {
        const res = await fetch(`${API_URL}/fleet/equipment/${editingEqId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(eqForm),
        });
        if (!res.ok) throw new Error('Update equipment failed');
        const updated = await res.json();
        setEquipmentList((prev) => prev.map((x) => (x.id === editingEqId ? { ...x, ...updated } : x)));
      } catch {
        setEquipmentList((prev) =>
          prev.map((x) => (x.id === editingEqId ? { ...x, ...eqForm } : x)),
        );
      }
      setEditingEqId(null);
      setEqForm(EMPTY_EQ_FORM);
    } else {
      try {
        const res = await fetch(`${API_URL}/fleet/equipment`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...eqForm, vessel_id: equipmentVessel.id }),
        });
        if (!res.ok) throw new Error('Create equipment failed');
        const created = await res.json();
        setEquipmentList((prev) => [created, ...prev]);
      } catch {
        setEquipmentList((prev) => [
          {
            id: `eq-${Date.now()}`,
            vessel_id: equipmentVessel.id,
            ...eqForm,
          },
          ...prev,
        ]);
      }
      setEqForm(EMPTY_EQ_FORM);
    }
  };

  const handleEditEqClick = (eq: VesselEquipment) => {
    setEditingEqId(eq.id);
    setEqForm({
      name: eq.name,
      category: eq.category,
      serial_no: eq.serial_no || '',
      running_hours: Number(eq.running_hours || 0),
      next_service_hours: Number(eq.next_service_hours || 0),
      status: eq.status,
    });
  };

  const handleDeleteEq = async (id: string) => {
    try {
      await fetch(`${API_URL}/fleet/equipment/${id}`, { method: 'DELETE' });
    } catch {
      // ignore offline
    }
    setEquipmentList((prev) => prev.filter((x) => x.id !== id));
  };

  const filtered = filter === 'ALL' ? vessels : vessels.filter((v) => v.status === filter);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Quản lý Đội tàu & Thiết bị</h1>
          <p className="text-sm text-slate-500">Hồ sơ sà lan tự hành, sà lan boong, tàu kéo, đăng kiểm & thiết bị trên tàu</p>
        </div>
        <button
          onClick={openCreateVessel}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-maritime-600 text-white text-sm font-medium hover:bg-maritime-500"
        >
          <Plus className="w-4 h-4" /> Thêm phương tiện
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {['ALL', 'AVAILABLE', 'IN_VOYAGE', 'MAINTENANCE'].map((st) => (
          <button
            key={st}
            onClick={() => setFilter(st)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${
              filter === st
                ? 'bg-navy-900 text-white border-navy-900'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            {st === 'ALL' ? 'Tất cả' : st === 'AVAILABLE' ? 'Sẵn sàng' : st === 'IN_VOYAGE' ? 'Đang chạy' : 'Bảo trì'}
          </button>
        ))}
      </div>

      {/* Vessel Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((v) => (
          <div key={v.id} className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-3">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-lg bg-sky-50 flex items-center justify-center text-maritime-600">
                  <Ship className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-bold text-slate-900">{v.name}</div>
                  <div className="text-xs text-slate-500">
                    {v.code} • Đăng ký: {v.registration_no}
                  </div>
                </div>
              </div>
              <StatusBadge status={v.status} />
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-3 rounded-lg">
              <div>
                <span className="text-slate-500">Trọng tải:</span>{' '}
                <strong className="text-slate-900">{v.capacity_tons.toLocaleString('vi-VN')} tấn</strong>
              </div>
              <div>
                <span className="text-slate-500">Sức chở:</span>{' '}
                <strong className="text-slate-900">{v.capacity_teu} TEU</strong>
              </div>
              <div>
                <span className="text-slate-500">Máy chính:</span>{' '}
                <strong className="text-slate-900">{v.main_engine_hp} HP</strong>
              </div>
              <div>
                <span className="text-slate-500">Định mức dầu:</span>{' '}
                <strong className="text-slate-900">{v.fuel_norm_l_per_hour} L/h</strong>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100">
              <div>
                <div className="text-slate-500">Thuyền trưởng</div>
                <div className="font-medium text-slate-800">{v.captain_name || 'Chưa gán'}</div>
              </div>
              <div className="text-right">
                <div className="text-slate-500">Hạn đăng kiểm</div>
                <div className="font-medium text-slate-800">{v.inspection_expiry ? v.inspection_expiry.slice(0, 10) : 'Chưa cập nhật'}</div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => openEditVessel(v)}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                <Pencil className="w-3.5 h-3.5 text-maritime-600" /> Sửa thông tin
              </button>
              <button
                onClick={() => openEquipmentModal(v)}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                <Cpu className="w-3.5 h-3.5 text-indigo-600" /> Thiết bị
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Add / Edit Vessel Modal */}
      {showVesselModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <form onSubmit={handleSaveVessel} className="bg-white rounded-xl max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-slate-900">
              {editingVesselId ? 'Cập nhật Thông tin Phương tiện' : 'Thêm Sà lan / Tàu kéo mới'}
            </h2>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Mã tàu</label>
                <input
                  required
                  placeholder="VS-SL-06"
                  className="w-full border rounded-lg px-3 py-2"
                  value={vesselForm.code}
                  onChange={(e) => setVesselForm({ ...vesselForm, code: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Số đăng ký</label>
                <input
                  required
                  placeholder="SG-8899"
                  className="w-full border rounded-lg px-3 py-2"
                  value={vesselForm.registration_no}
                  onChange={(e) => setVesselForm({ ...vesselForm, registration_no: e.target.value })}
                />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-slate-600 mb-1">Tên phương tiện</label>
                <input
                  required
                  placeholder="Sà lan Việt Sun ..."
                  className="w-full border rounded-lg px-3 py-2"
                  value={vesselForm.name}
                  onChange={(e) => setVesselForm({ ...vesselForm, name: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Loại phương tiện</label>
                <select
                  className="w-full border rounded-lg px-3 py-2"
                  value={vesselForm.vessel_type}
                  onChange={(e) => setVesselForm({ ...vesselForm, vessel_type: e.target.value as any })}
                >
                  <option value="SELF_PROPELLED">Sà lan tự hành</option>
                  <option value="DUMB_BARGE">Sà lan boong (không tự hành)</option>
                  <option value="TUGBOAT">Tàu kéo</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Trạng thái</label>
                <select
                  className="w-full border rounded-lg px-3 py-2"
                  value={vesselForm.status}
                  onChange={(e) => setVesselForm({ ...vesselForm, status: e.target.value as any })}
                >
                  <option value="AVAILABLE">Sẵn sàng</option>
                  <option value="IN_VOYAGE">Đang chạy chuyến</option>
                  <option value="MAINTENANCE">Đang bảo trì</option>
                  <option value="IDLE">Neo đậu chờ</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Trọng tải (tấn)</label>
                <input
                  type="number"
                  className="w-full border rounded-lg px-3 py-2"
                  value={vesselForm.capacity_tons}
                  onChange={(e) => setVesselForm({ ...vesselForm, capacity_tons: Number(e.target.value) })}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Sức chở (TEU)</label>
                <input
                  type="number"
                  className="w-full border rounded-lg px-3 py-2"
                  value={vesselForm.capacity_teu}
                  onChange={(e) => setVesselForm({ ...vesselForm, capacity_teu: Number(e.target.value) })}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Công suất máy chính (HP)</label>
                <input
                  type="number"
                  className="w-full border rounded-lg px-3 py-2"
                  value={vesselForm.main_engine_hp}
                  onChange={(e) => setVesselForm({ ...vesselForm, main_engine_hp: Number(e.target.value) })}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Định mức dầu (L/giờ)</label>
                <input
                  type="number"
                  step="0.1"
                  className="w-full border rounded-lg px-3 py-2"
                  value={vesselForm.fuel_norm_l_per_hour}
                  onChange={(e) => setVesselForm({ ...vesselForm, fuel_norm_l_per_hour: Number(e.target.value) })}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Thuyền trưởng</label>
                <input
                  placeholder="Họ và tên"
                  className="w-full border rounded-lg px-3 py-2"
                  value={vesselForm.captain_name}
                  onChange={(e) => setVesselForm({ ...vesselForm, captain_name: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">SĐT Thuyền trưởng</label>
                <input
                  placeholder="090..."
                  className="w-full border rounded-lg px-3 py-2"
                  value={vesselForm.captain_phone}
                  onChange={(e) => setVesselForm({ ...vesselForm, captain_phone: e.target.value })}
                />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-slate-600 mb-1">Hạn đăng kiểm</label>
                <input
                  type="date"
                  className="w-full border rounded-lg px-3 py-2"
                  value={vesselForm.inspection_expiry}
                  onChange={(e) => setVesselForm({ ...vesselForm, inspection_expiry: e.target.value })}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setShowVesselModal(false)} className="px-4 py-2 rounded-lg border text-sm">
                Hủy
              </button>
              <button type="submit" className="px-4 py-2 rounded-lg bg-maritime-600 text-white text-sm font-medium">
                {editingVesselId ? 'Lưu thay đổi' : 'Lưu phương tiện'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Equipment Management Modal */}
      {equipmentVessel && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full p-6 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Thiết bị trên {equipmentVessel.name} ({equipmentVessel.code})
                </h2>
                <p className="text-xs text-slate-500">Thêm, sửa thông số giờ chạy máy & trạng thái thiết bị</p>
              </div>
              <button
                onClick={() => setEquipmentVessel(null)}
                className="px-3 py-1 rounded-lg border text-xs font-medium text-slate-600 hover:bg-slate-50"
              >
                Đóng
              </button>
            </div>

            {/* Add / Edit Equipment Form */}
            <form onSubmit={handleSaveEquipment} className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3 text-sm">
              <div className="font-semibold text-xs text-slate-700 uppercase">
                {editingEqId ? 'Đang sửa thiết bị' : 'Thêm thiết bị mới'}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <input
                  required
                  placeholder="Tên thiết bị (VD: Máy chính Cummins)"
                  className="border rounded-lg px-3 py-2 bg-white sm:col-span-2"
                  value={eqForm.name}
                  onChange={(e) => setEqForm({ ...eqForm, name: e.target.value })}
                />
                <select
                  className="border rounded-lg px-3 py-2 bg-white"
                  value={eqForm.category}
                  onChange={(e) => setEqForm({ ...eqForm, category: e.target.value as any })}
                >
                  <option value="MAIN_ENGINE">Máy chính</option>
                  <option value="GENERATOR">Máy phát điện</option>
                  <option value="GPS_AIS">Thiết bị AIS / GPS</option>
                  <option value="WINCH">Tời neo / Tời kéo</option>
                  <option value="CRANE">Cẩu hàng</option>
                </select>
                <input
                  placeholder="Số Serial"
                  className="border rounded-lg px-3 py-2 bg-white"
                  value={eqForm.serial_no}
                  onChange={(e) => setEqForm({ ...eqForm, serial_no: e.target.value })}
                />
                <input
                  type="number"
                  placeholder="Giờ đã chạy"
                  className="border rounded-lg px-3 py-2 bg-white"
                  value={eqForm.running_hours}
                  onChange={(e) => setEqForm({ ...eqForm, running_hours: Number(e.target.value) })}
                />
                <select
                  className="border rounded-lg px-3 py-2 bg-white"
                  value={eqForm.status}
                  onChange={(e) => setEqForm({ ...eqForm, status: e.target.value as any })}
                >
                  <option value="OPERATIONAL">Hoạt động tốt</option>
                  <option value="WARNING">Cần kiểm tra</option>
                  <option value="FAULTY">Hỏng / Lỗi</option>
                </select>
              </div>
              <div className="flex justify-end gap-2">
                {editingEqId && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingEqId(null);
                      setEqForm(EMPTY_EQ_FORM);
                    }}
                    className="px-3 py-1.5 rounded-lg border bg-white text-xs"
                  >
                    Hủy sửa
                  </button>
                )}
                <button type="submit" className="px-4 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-medium">
                  {editingEqId ? 'Cập nhật thiết bị' : '+ Thêm thiết bị'}
                </button>
              </div>
            </form>

            {/* Equipment List */}
            <div className="space-y-2">
              {equipmentList.length === 0 ? (
                <div className="text-center py-6 text-sm text-slate-500 border border-dashed rounded-xl">
                  Chưa có thiết bị nào được khai báo cho tàu này.
                </div>
              ) : (
                equipmentList.map((eq) => (
                  <div
                    key={eq.id}
                    className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-white text-sm"
                  >
                    <div>
                      <div className="font-semibold text-slate-900 flex items-center gap-2">
                        {eq.name}
                        <StatusBadge status={eq.status} />
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {CATEGORY_LABELS[eq.category] || eq.category} • Serial: {eq.serial_no || 'N/A'} • Giờ chạy:{' '}
                        <strong>{eq.running_hours}h</strong>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleEditEqClick(eq)}
                        className="p-1.5 rounded-lg border hover:bg-slate-50 text-slate-600"
                        title="Sửa thiết bị"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteEq(eq.id)}
                        className="p-1.5 rounded-lg border hover:bg-rose-50 text-rose-600"
                        title="Xóa thiết bị"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
