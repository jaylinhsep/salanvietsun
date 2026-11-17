'use client';

import React, { useEffect, useState } from 'react';
import { Anchor, Building2, Compass, ListChecks, Pencil, Plus, Trash2 } from 'lucide-react';
import {
  API_URL,
  FALLBACK_CUSTOMERS,
  FALLBACK_PORTS,
  FALLBACK_VESSELS,
  FALLBACK_VOYAGES,
  fetchApi,
  type Customer,
  type Port,
  type Vessel,
  type Voyage,
} from '@/lib/api';
import { StatusBadge } from '@/components/StatusBadge';
import { VoyageContainersPanel } from '@/components/VoyageContainersPanel';
import { getBargeColorStyle } from '@/lib/barge-colors';
import { computeNextVoyageNo } from '@/lib/voyage-number';

type TabKey = 'VOYAGES' | 'PORTS' | 'CUSTOMERS';

const EMPTY_VOYAGE_FORM = {
  voyage_no: '',
  received_date: '',
  pic_name: '',
  customer_id: '',
  vessel_id: '',
  origin_port_id: '',
  destination_port_id: '',
  cont_20e: 0,
  cont_20f: 0,
  cont_40e: 0,
  cont_40f: 0,
  vessel_berth_date: '',
  order_deadline: '',
  status: 'PLANNED',
  captain_notes: '',
};

const EMPTY_PORT_FORM = {
  code: '',
  name: '',
  region: 'TP. Hồ Chí Minh',
  port_type: 'PORT',
  lat: 10.7615,
  lng: 106.7918,
};

const EMPTY_CUSTOMER_FORM = {
  code: '',
  name: '',
  tax_code: '',
  contact_person: '',
  phone: '',
  address: '',
};

export default function DispatchPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('VOYAGES');
  const [selectedVoyageId, setSelectedVoyageId] = useState<string | null>(null);
  const [voyages, setVoyages] = useState<Voyage[]>([]);
  const [vessels, setVessels] = useState<Vessel[]>([]);
  const [ports, setPorts] = useState<Port[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);

  // Voyage modal
  const [showVoyageModal, setShowVoyageModal] = useState(false);
  const [editingVoyageId, setEditingVoyageId] = useState<string | null>(null);
  const [voyageForm, setVoyageForm] = useState(EMPTY_VOYAGE_FORM);
  const [isManualVoyageNo, setIsManualVoyageNo] = useState(false);

  // Port modal
  const [showPortModal, setShowPortModal] = useState(false);
  const [editingPortId, setEditingPortId] = useState<string | null>(null);
  const [portForm, setPortForm] = useState(EMPTY_PORT_FORM);

  // Customer modal
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [editingCustomerId, setEditingCustomerId] = useState<string | null>(null);
  const [customerForm, setCustomerForm] = useState(EMPTY_CUSTOMER_FORM);

  // Filters for Voyages list
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [filterVesselId, setFilterVesselId] = useState<string>('');
  const [filterCustomerId, setFilterCustomerId] = useState<string>('');
  const [filterDate, setFilterDate] = useState<string>('');
  const [filterMonth, setFilterMonth] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [visibleLimit, setVisibleLimit] = useState<number>(15);

  const loadAll = () => {
    fetchApi<Voyage[]>('/dispatch/voyages', FALLBACK_VOYAGES).then((r) => setVoyages(r.data));
    fetchApi<Vessel[]>('/fleet/vessels', FALLBACK_VESSELS).then((r) => setVessels(r.data));
    fetchApi<Port[]>('/dispatch/ports', FALLBACK_PORTS).then((r) => setPorts(r.data));
    fetchApi<Customer[]>('/orders/customers', FALLBACK_CUSTOMERS).then((r) => setCustomers(r.data));
  };

  useEffect(() => {
    loadAll();
    if (typeof window !== 'undefined') {
      const vid = new URLSearchParams(window.location.search).get('voyageId');
      if (vid) setSelectedVoyageId(vid);
    }
  }, []);

  const selectVoyage = (id: string | null) => {
    setSelectedVoyageId(id);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      if (id) url.searchParams.set('voyageId', id);
      else url.searchParams.delete('voyageId');
      window.history.replaceState({}, '', url.pathname + url.search);
    }
  };

  const selectedVoyage = voyages.find((v) => v.id === selectedVoyageId) || null;

  const calcTeus = (f: typeof voyageForm) =>
    Number(f.cont_20e || 0) + Number(f.cont_20f || 0) + (Number(f.cont_40e || 0) + Number(f.cont_40f || 0)) * 2;

  // --- VOYAGE HANDLERS ---
  const suggestVoyageNoForVessel = (vesselId: string, receivedDate?: string) => {
    const target = vessels.find((v) => v.id === vesselId);
    const existingForVessel = voyages
      .filter((vy) => !vesselId || vy.vessel_id === vesselId)
      .map((vy) => vy.voyage_no);
    return computeNextVoyageNo({
      vesselCode: target?.code,
      vesselName: target?.name,
      existingVoyageNos: existingForVessel,
      receivedDate,
    });
  };

  const openCreateVoyage = () => {
    const today = new Date().toISOString().slice(0, 10);
    const defaultVessel =
      vessels.find((v) => v.code === 'NV36' || v.code === 'NV18' || v.code === 'NV38') ||
      vessels[0];
    const initialVesselId = defaultVessel?.id || '';
    setEditingVoyageId(null);
    setIsManualVoyageNo(false);
    setVoyageForm({
      ...EMPTY_VOYAGE_FORM,
      received_date: today,
      voyage_no: suggestVoyageNoForVessel(initialVesselId, today),
      customer_id: customers[0]?.id || '',
      vessel_id: initialVesselId,
      origin_port_id: ports[0]?.id || '',
      destination_port_id: ports[1]?.id || ports[0]?.id || '',
    });
    setShowVoyageModal(true);
  };

  const openEditVoyage = (vy: Voyage) => {
    setEditingVoyageId(vy.id);
    setVoyageForm({
      voyage_no: vy.voyage_no,
      received_date: vy.received_date ? vy.received_date.slice(0, 10) : new Date().toISOString().slice(0, 10),
      pic_name: vy.pic_name || '',
      customer_id: vy.customer_id || customers[0]?.id || '',
      vessel_id: vy.vessel_id || vessels[0]?.id || '',
      origin_port_id: vy.origin_port_id || ports[0]?.id || '',
      destination_port_id: vy.destination_port_id || ports[1]?.id || '',
      cont_20e: Number(vy.cont_20e || 0),
      cont_20f: Number(vy.cont_20f || 0),
      cont_40e: Number(vy.cont_40e || 0),
      cont_40f: Number(vy.cont_40f || 0),
      vessel_berth_date: vy.vessel_berth_date ? vy.vessel_berth_date.slice(0, 10) : '',
      order_deadline: vy.order_deadline ? vy.order_deadline.slice(0, 10) : '',
      status: vy.status,
      captain_notes: vy.captain_notes || '',
    });
    setShowVoyageModal(true);
  };

  const handleSaveVoyage = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = editingVoyageId
        ? `${API_URL}/dispatch/voyages/${editingVoyageId}`
        : `${API_URL}/dispatch/voyages`;
      const res = await fetch(url, {
        method: editingVoyageId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(voyageForm),
      });
      if (!res.ok) {
        const errText = await res.text();
        alert(`Không lưu được lệnh điều độ (${res.status}): ${errText}`);
        return;
      }
      setShowVoyageModal(false);
      loadAll();
    } catch (err: any) {
      alert(`Lỗi kết nối API: ${err?.message || err}`);
    }
  };

  const advanceStatus = async (vy: Voyage, nextStatus: string) => {
    await fetch(`${API_URL}/dispatch/voyages/${vy.id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: nextStatus }),
    }).catch(() => null);
    loadAll();
  };

  const handleDeleteVoyage = async (id: string, voyageNo?: string) => {
    if (
      !confirm(
        `Xóa chuyến "${voyageNo || id}" (Hủy kế hoạch)?\nCác booking đang ghép vào chuyến (nếu có) sẽ tự động quay về hàng chờ.`,
      )
    ) {
      return;
    }
    try {
      const res = await fetch(`${API_URL}/dispatch/voyages/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        alert(`Không thể xóa chuyến (${res.status}): ${await res.text()}`);
        return;
      }
      setShowVoyageModal(false);
      if (selectedVoyageId === id) selectVoyage(null);
      loadAll();
    } catch (err: any) {
      alert(`Lỗi kết nối API: ${err?.message || err}`);
    }
  };

  // --- PORT HANDLERS ---
  const openCreatePort = () => {
    setEditingPortId(null);
    setPortForm(EMPTY_PORT_FORM);
    setShowPortModal(true);
  };

  const openEditPort = (p: Port) => {
    setEditingPortId(p.id);
    setPortForm({
      code: p.code,
      name: p.name,
      region: p.region || 'TP. Hồ Chí Minh',
      port_type: p.port_type || 'PORT',
      lat: Number(p.lat || 10.7615),
      lng: Number(p.lng || 106.7918),
    });
    setShowPortModal(true);
  };

  const handleSavePort = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingPortId) {
      await fetch(`${API_URL}/dispatch/ports/${editingPortId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(portForm),
      }).catch(() => null);
    } else {
      await fetch(`${API_URL}/dispatch/ports`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(portForm),
      }).catch(() => null);
    }
    setShowPortModal(false);
    loadAll();
  };

  const handleDeletePort = async (id: string) => {
    if (!confirm('Xóa cảng này?')) return;
    try {
      const res = await fetch(`${API_URL}/dispatch/ports/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        alert(`Không thể xóa cảng (${res.status}): ${await res.text()}`);
        return;
      }
      loadAll();
    } catch (err: any) {
      alert(`Lỗi kết nối API: ${err?.message || err}`);
    }
  };

  // --- CUSTOMER HANDLERS ---
  const openCreateCustomer = () => {
    setEditingCustomerId(null);
    setCustomerForm(EMPTY_CUSTOMER_FORM);
    setShowCustomerModal(true);
  };

  const openEditCustomer = (c: Customer) => {
    setEditingCustomerId(c.id);
    setCustomerForm({
      code: c.code,
      name: c.name,
      tax_code: c.tax_code || '',
      contact_person: c.contact_person || '',
      phone: c.phone || '',
      address: c.address || '',
    });
    setShowCustomerModal(true);
  };

  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingCustomerId) {
      await fetch(`${API_URL}/orders/customers/${editingCustomerId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(customerForm),
      }).catch(() => null);
    } else {
      await fetch(`${API_URL}/orders/customers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(customerForm),
      }).catch(() => null);
    }
    setShowCustomerModal(false);
    loadAll();
  };

  const handleDeleteCustomer = async (id: string) => {
    if (!confirm('Xóa khách hàng này?')) return;
    try {
      const res = await fetch(`${API_URL}/orders/customers/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        alert(`Không thể xóa khách hàng (${res.status}): ${await res.text()}`);
        return;
      }
      loadAll();
    } catch (err: any) {
      alert(`Lỗi kết nối API: ${err?.message || err}`);
    }
  };

  const getVoyageDate = (vy: Voyage) =>
    (vy.received_date || vy.etd || vy.vessel_berth_date || '').slice(0, 10);

  const filteredVoyages = [...voyages]
    .filter((vy) => {
      const d = getVoyageDate(vy);
      if (filterDate && d !== filterDate) return false;
      if (filterMonth && !d.startsWith(filterMonth)) return false;
      if (filterCustomerId && vy.customer_id !== filterCustomerId) return false;
      if (filterStatus !== 'ALL' && vy.status !== filterStatus) return false;
      if (filterVesselId && vy.vessel_id !== filterVesselId) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const hay = `${vy.voyage_no} ${vy.vessel_name} ${vy.customer_code || ''} ${vy.customer_name || ''} ${vy.booking_nos || ''} ${vy.origin_name || ''} ${vy.dest_name || ''} ${d}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    })
    .sort((a, b) => {
      const dA = getVoyageDate(a);
      const dB = getVoyageDate(b);
      if (dB !== dA) return dB.localeCompare(dA);
      return (b.voyage_no || '').localeCompare(a.voyage_no || '', 'vi');
    });

  const hasActiveFilter = Boolean(
    filterDate || filterMonth || filterCustomerId || filterVesselId || filterStatus !== 'ALL' || searchQuery.trim(),
  );

  const sum20e = filteredVoyages.reduce((acc, vy) => acc + Number(vy.cont_20e || 0), 0);
  const sum20f = filteredVoyages.reduce((acc, vy) => acc + Number(vy.cont_20f || 0), 0);
  const sum40e = filteredVoyages.reduce((acc, vy) => acc + Number(vy.cont_40e || 0), 0);
  const sum40f = filteredVoyages.reduce((acc, vy) => acc + Number(vy.cont_40f || 0), 0);
  const sumTeus = filteredVoyages.reduce((acc, vy) => acc + Number(vy.total_teus || 0), 0);
  const sumDetailCount = filteredVoyages.reduce((acc, vy) => acc + Number(vy.detail_count || 0), 0);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Điều độ Chuyến & Gán Container</h1>
          <p className="text-sm text-slate-500">
            Quản lý cảng đi (POL), cảng đến (POD), khách hàng và gán sản lượng container (20E/20F/40E/40F) cho từng sà lan
          </p>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === 'VOYAGES' && (
            <button
              onClick={openCreateVoyage}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-maritime-600 text-white text-sm font-medium hover:bg-maritime-500"
            >
              <Plus className="w-4 h-4" /> Lập lệnh điều độ
            </button>
          )}
          {activeTab === 'PORTS' && (
            <button
              onClick={openCreatePort}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-maritime-600 text-white text-sm font-medium hover:bg-maritime-500"
            >
              <Plus className="w-4 h-4" /> Thêm Cảng (POL/POD)
            </button>
          )}
          {activeTab === 'CUSTOMERS' && (
            <button
              onClick={openCreateCustomer}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-maritime-600 text-white text-sm font-medium hover:bg-maritime-500"
            >
              <Plus className="w-4 h-4" /> Thêm Khách hàng
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
        <button
          onClick={() => {
            setActiveTab('VOYAGES');
            selectVoyage(null);
          }}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium ${
            activeTab === 'VOYAGES'
              ? 'bg-navy-900 text-white'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          <Compass className="w-4 h-4" /> Bảng Điều độ & Container ({voyages.length})
        </button>
        <button
          onClick={() => setActiveTab('PORTS')}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium ${
            activeTab === 'PORTS'
              ? 'bg-navy-900 text-white'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          <Anchor className="w-4 h-4" /> Danh mục Cảng đi / Đến ({ports.length})
        </button>
        <button
          onClick={() => setActiveTab('CUSTOMERS')}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium ${
            activeTab === 'CUSTOMERS'
              ? 'bg-navy-900 text-white'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          <Building2 className="w-4 h-4" /> Danh mục Khách hàng ({customers.length})
        </button>
      </div>

      {/* TAB 1: VOYAGES & CONTAINERS */}
      {activeTab === 'VOYAGES' && selectedVoyage && (
        <VoyageContainersPanel
          voyage={selectedVoyage}
          ports={ports}
          customers={customers}
          vessels={vessels}
          onBack={() => selectVoyage(null)}
          onVoyageUpdated={loadAll}
        />
      )}

      {activeTab === 'VOYAGES' && !selectedVoyage && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 space-y-2 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                placeholder="Tìm mã chuyến, booking, tuyến..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setVisibleLimit(15);
                }}
                className="px-2.5 py-1.5 rounded border border-slate-300 bg-white text-xs w-52"
              />
              <div className="inline-flex items-center gap-1 bg-white border border-slate-300 rounded px-2 py-1">
                <span className="text-[11px] text-slate-500">Ngày:</span>
                <input
                  type="date"
                  value={filterDate}
                  onChange={(e) => {
                    setFilterDate(e.target.value);
                    if (e.target.value) setFilterMonth('');
                    setVisibleLimit(15);
                  }}
                  className="text-xs outline-none bg-transparent"
                  title="Lọc theo ngày cụ thể"
                />
              </div>
              <div className="inline-flex items-center gap-1 bg-white border border-slate-300 rounded px-2 py-1">
                <span className="text-[11px] text-slate-500">Tháng:</span>
                <input
                  type="month"
                  value={filterMonth}
                  onChange={(e) => {
                    setFilterMonth(e.target.value);
                    if (e.target.value) setFilterDate('');
                    setVisibleLimit(15);
                  }}
                  className="text-xs outline-none bg-transparent"
                  title="Lọc theo tháng"
                />
              </div>
              <select
                value={filterCustomerId}
                onChange={(e) => {
                  setFilterCustomerId(e.target.value);
                  setVisibleLimit(15);
                }}
                className="px-2.5 py-1.5 rounded border border-slate-300 bg-white text-xs max-w-[160px]"
              >
                <option value="">Tất cả Khách hàng ({customers.length})</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} — {c.name}
                  </option>
                ))}
              </select>
              <select
                value={filterVesselId}
                onChange={(e) => {
                  setFilterVesselId(e.target.value);
                  setVisibleLimit(15);
                }}
                className="px-2.5 py-1.5 rounded border border-slate-300 bg-white text-xs max-w-[155px]"
              >
                <option value="">Tất cả Sà lan ({vessels.length})</option>
                {vessels.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name} ({v.code})
                  </option>
                ))}
              </select>
              <select
                value={filterStatus}
                onChange={(e) => {
                  setFilterStatus(e.target.value);
                  setVisibleLimit(15);
                }}
                className="px-2.5 py-1.5 rounded border border-slate-300 bg-white text-xs"
              >
                <option value="ALL">Tất cả trạng thái ({voyages.length})</option>
                <option value="COMPLETED">Đã hoàn thành</option>
                <option value="PLANNED">Đã lập kế hoạch / Đang gom</option>
                <option value="IN_TRANSIT">Đang vận chuyển</option>
              </select>
              {hasActiveFilter && (
                <button
                  type="button"
                  onClick={() => {
                    setFilterDate('');
                    setFilterMonth('');
                    setFilterCustomerId('');
                    setFilterVesselId('');
                    setFilterStatus('ALL');
                    setSearchQuery('');
                    setVisibleLimit(15);
                  }}
                  className="px-2.5 py-1.5 rounded bg-slate-200 text-slate-700 hover:bg-slate-300 font-medium"
                >
                  Xóa lọc
                </button>
              )}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-200/70">
              <span className="text-slate-500">
                Sắp xếp: <strong>Ngày gần nhất trên cùng</strong> • Đang hiện {Math.min(visibleLimit, filteredVoyages.length)} / {filteredVoyages.length} chuyến
              </span>
              <span className="font-bold text-rose-600 text-xs sm:text-sm">
                Tổng theo bộ lọc: {filteredVoyages.length} chuyến • {sumTeus.toLocaleString('en-US')} TEUs ({sumDetailCount.toLocaleString('en-US')} cont chi tiết)
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-100 text-slate-700 uppercase font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-2.5 py-2.5 w-[92px]">Ngày</th>
                  <th className="px-2.5 py-2.5 min-w-[150px]">Mã chuyến / BK</th>
                  <th className="px-2.5 py-2.5">Sà lan</th>
                  <th className="px-2.5 py-2.5">Khách hàng</th>
                  <th className="px-2.5 py-2.5">Tuyến (POL → POD)</th>
                  <th className="px-1.5 py-2.5 text-center w-9">20E</th>
                  <th className="px-1.5 py-2.5 text-center w-9">20F</th>
                  <th className="px-1.5 py-2.5 text-center w-9">40E</th>
                  <th className="px-1.5 py-2.5 text-center w-9">40F</th>
                  <th className="px-2 py-2.5 text-center text-rose-700 bg-rose-50 w-14">TEUs</th>
                  <th className="px-2.5 py-2.5 text-right w-[170px]">Trạng thái / Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-300/80">
                {filteredVoyages.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="px-4 py-8 text-center text-slate-500">
                      Không tìm thấy chuyến tàu nào phù hợp bộ lọc.
                    </td>
                  </tr>
                ) : (
                  filteredVoyages.slice(0, visibleLimit).map((vy) => {
                    const displayDate = getVoyageDate(vy);
                    const bargeStyle = getBargeColorStyle(vy.vessel_code || vy.vessel_name);
                    return (
                      <tr
                        key={vy.id}
                        onClick={() => selectVoyage(vy.id)}
                        className={`${bargeStyle.rowClass} cursor-pointer align-top transition-colors`}
                        title="Bấm để xem hoặc nhập chi tiết container của chuyến này"
                      >
                        <td className="px-2.5 py-2 text-slate-700 whitespace-nowrap">
                          <div className="font-semibold">{displayDate || '—'}</div>
                          {vy.vessel_berth_date && (
                            <div className="text-[10px] text-slate-400">
                              Cập: {vy.vessel_berth_date.slice(5, 10)}
                            </div>
                          )}
                          {vy.order_deadline && (
                            <div className="text-[10px] text-amber-600">
                              Hạn: {vy.order_deadline.slice(5, 10)}
                            </div>
                          )}
                        </td>
                        <td className="px-2.5 py-2">
                          <div className="font-semibold text-maritime-700 underline decoration-dotted">
                            {vy.voyage_no}
                          </div>
                          <div className="text-[10px] text-slate-500">
                            {vy.detail_count ? (
                              (vy.named_cont_count ?? vy.detail_count) >= vy.detail_count ? (
                                <span className="text-emerald-700 font-medium">{vy.detail_count} cont chi tiết</span>
                              ) : (vy.named_cont_count || 0) > 0 ? (
                                <span className="text-amber-700 font-medium">
                                  {vy.named_cont_count}/{vy.detail_count} số cont
                                </span>
                              ) : (
                                <span className="text-slate-600">{vy.detail_count} dòng (chưa có số cont)</span>
                              )
                            ) : (
                              'Chưa nhập cont'
                            )}
                            {vy.pic_name ? ` • ${vy.pic_name}` : ''}
                          </div>
                          {vy.booking_nos && (
                            <div
                              className="text-[10px] text-indigo-600 max-w-[170px] truncate"
                              title={vy.booking_nos}
                            >
                              BK: {vy.booking_nos}
                            </div>
                          )}
                        </td>
                        <td className="px-2.5 py-2 font-semibold text-slate-800 leading-snug">
                          {vy.vessel_name ? (
                            <span
                              className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-semibold ${bargeStyle.badgeClass}`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${bargeStyle.dotClass}`} />
                              {vy.vessel_name}
                            </span>
                          ) : (
                            'Chưa gán'
                          )}
                        </td>
                        <td className="px-2.5 py-2 font-medium text-slate-900 leading-snug">
                          {vy.customer_code ? vy.customer_code : vy.customer_name || '—'}
                          {vy.customer_name && vy.customer_name !== vy.customer_code && (
                            <div className="text-[10px] text-slate-500 font-normal truncate max-w-[120px]">
                              {vy.customer_name}
                            </div>
                          )}
                        </td>
                        <td className="px-2.5 py-2 leading-snug">
                          <div className="font-medium text-slate-700">{vy.origin_name || '—'}</div>
                          <div className="font-semibold text-maritime-700">→ {vy.dest_name || '—'}</div>
                        </td>
                        <td className="px-1.5 py-2 text-center tabular-nums text-slate-600">
                          {vy.cont_20e || 0}
                        </td>
                        <td className="px-1.5 py-2 text-center tabular-nums text-slate-700 font-medium">
                          {vy.cont_20f || 0}
                        </td>
                        <td className="px-1.5 py-2 text-center tabular-nums text-slate-600">
                          {vy.cont_40e || 0}
                        </td>
                        <td className="px-1.5 py-2 text-center tabular-nums text-slate-700 font-medium">
                          {vy.cont_40f || 0}
                        </td>
                        <td className="px-2 py-2 text-center font-bold text-rose-700 bg-rose-50/60 tabular-nums">
                          {vy.total_teus || 0}
                        </td>
                        <td
                          className="px-2.5 py-2 text-right space-y-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex justify-end">
                            <StatusBadge status={vy.status} />
                          </div>
                          <div className="flex flex-wrap justify-end gap-1">
                            <button
                              onClick={() => selectVoyage(vy.id)}
                              className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 font-medium text-[11px]"
                            >
                              <ListChecks className="w-3 h-3" /> Cont
                            </button>
                            <button
                              onClick={() => openEditVoyage(vy)}
                              className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded border border-slate-200 text-slate-700 hover:bg-slate-100 text-[11px]"
                            >
                              <Pencil className="w-3 h-3 text-maritime-600" /> Sửa
                            </button>
                            <button
                              onClick={() => handleDeleteVoyage(vy.id, vy.voyage_no)}
                              className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border border-rose-200 text-rose-600 hover:bg-rose-50 text-[11px]"
                              title="Xóa chuyến (Hủy kế hoạch)"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                            {vy.status === 'PLANNED' && (
                              <button
                                onClick={() => advanceStatus(vy, 'IN_TRANSIT')}
                                className="px-2 py-0.5 rounded bg-sky-600 text-white hover:bg-sky-500 text-[11px]"
                              >
                                Xuất bến
                              </button>
                            )}
                            {vy.status === 'IN_TRANSIT' && (
                              <button
                                onClick={() => advanceStatus(vy, 'COMPLETED')}
                                className="px-2 py-0.5 rounded bg-emerald-600 text-white hover:bg-emerald-500 text-[11px]"
                              >
                                Xong
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
              {filteredVoyages.length > 0 && (
                <tfoot className="bg-amber-50/90 border-t-2 border-amber-300 font-bold text-slate-900">
                  <tr>
                    <td colSpan={5} className="px-3 py-2.5 text-right uppercase text-[11px] tracking-wide">
                      Tổng cộng ({filteredVoyages.length} chuyến • {sumDetailCount.toLocaleString('en-US')} cont chi tiết):
                    </td>
                    <td className="px-1.5 py-2.5 text-center tabular-nums">{sum20e}</td>
                    <td className="px-1.5 py-2.5 text-center tabular-nums">{sum20f}</td>
                    <td className="px-1.5 py-2.5 text-center tabular-nums">{sum40e}</td>
                    <td className="px-1.5 py-2.5 text-center tabular-nums">{sum40f}</td>
                    <td className="px-2 py-2.5 text-center text-rose-700 bg-rose-100/80 tabular-nums text-sm">
                      {sumTeus.toLocaleString('en-US')}
                    </td>
                    <td className="px-2.5 py-2.5 text-right text-[11px] text-slate-500 font-normal">
                      TEUs
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
          {filteredVoyages.length > 15 && (
            <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
              <span>
                Đang hiển thị <strong>{Math.min(visibleLimit, filteredVoyages.length)}</strong> / {filteredVoyages.length} chuyến (xếp theo ngày gần nhất)
              </span>
              <div className="flex flex-wrap gap-2">
                {visibleLimit < filteredVoyages.length && (
                  <>
                    <button
                      onClick={() => setVisibleLimit((v) => v + 15)}
                      className="px-3 py-1 rounded border border-slate-300 bg-white font-medium hover:bg-slate-100"
                    >
                      Sổ thêm 15 chuyến
                    </button>
                    <button
                      onClick={() => setVisibleLimit((v) => v + 50)}
                      className="px-3 py-1 rounded border border-slate-300 bg-white font-medium hover:bg-slate-100"
                    >
                      +50 chuyến
                    </button>
                    <button
                      onClick={() => setVisibleLimit(filteredVoyages.length)}
                      className="px-3 py-1 rounded bg-navy-900 text-white font-medium hover:bg-navy-800"
                    >
                      Hiện tất cả ({filteredVoyages.length})
                    </button>
                  </>
                )}
                {visibleLimit > 15 && (
                  <button
                    onClick={() => setVisibleLimit(15)}
                    className="px-3 py-1 rounded border border-slate-300 bg-white font-medium hover:bg-slate-100"
                  >
                    Thu gọn còn 15
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: PORTS */}
      {activeTab === 'PORTS' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-xs uppercase text-slate-600 border-b">
              <tr>
                <th className="px-4 py-3">Mã cảng</th>
                <th className="px-4 py-3">Tên cảng / Bến (POL / POD)</th>
                <th className="px-4 py-3">Khu vực</th>
                <th className="px-4 py-3">Loại</th>
                <th className="px-4 py-3">Tọa độ PostGIS</th>
                <th className="px-4 py-3 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {ports.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-bold text-navy-900">{p.code}</td>
                  <td className="px-4 py-3 font-medium">{p.name}</td>
                  <td className="px-4 py-3 text-slate-600">{p.region}</td>
                  <td className="px-4 py-3 text-xs">{p.port_type}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">
                    {Number(p.lat).toFixed(4)}, {Number(p.lng).toFixed(4)}
                  </td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <button
                      onClick={() => openEditPort(p)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded border text-xs hover:bg-slate-100"
                    >
                      <Pencil className="w-3 h-3 text-maritime-600" /> Sửa
                    </button>
                    <button
                      onClick={() => handleDeletePort(p.id)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded border text-xs text-rose-600 hover:bg-rose-50"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 3: CUSTOMERS */}
      {activeTab === 'CUSTOMERS' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-xs uppercase text-slate-600 border-b">
              <tr>
                <th className="px-4 py-3">Mã KH</th>
                <th className="px-4 py-3">Tên Khách hàng</th>
                <th className="px-4 py-3">Người liên hệ</th>
                <th className="px-4 py-3">Điện thoại</th>
                <th className="px-4 py-3">Mã số thuế</th>
                <th className="px-4 py-3 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {customers.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-bold text-navy-900">{c.code}</td>
                  <td className="px-4 py-3 font-medium">{c.name}</td>
                  <td className="px-4 py-3 text-slate-600">{c.contact_person || '—'}</td>
                  <td className="px-4 py-3 text-slate-600">{c.phone || '—'}</td>
                  <td className="px-4 py-3 text-slate-500">{c.tax_code || '—'}</td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <button
                      onClick={() => openEditCustomer(c)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded border text-xs hover:bg-slate-100"
                    >
                      <Pencil className="w-3 h-3 text-maritime-600" /> Sửa
                    </button>
                    <button
                      onClick={() => handleDeleteCustomer(c.id)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded border text-xs text-rose-600 hover:bg-rose-50"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* MODAL: CREATE / EDIT VOYAGE */}
      {showVoyageModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveVoyage}
            className="bg-white rounded-xl max-w-2xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto"
          >
            <h2 className="text-lg font-bold text-slate-900">
              {editingVoyageId ? 'Chỉnh sửa Lệnh Điều độ & Container' : 'Tạo Lệnh Điều độ & Gán Container'}
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-medium text-slate-600">Mã chuyến</label>
                  {!editingVoyageId && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsManualVoyageNo(false);
                        setVoyageForm((prev) => ({
                          ...prev,
                          voyage_no: suggestVoyageNoForVessel(prev.vessel_id, prev.received_date),
                        }));
                      }}
                      className="text-[11px] font-semibold text-maritime-600 hover:underline"
                    >
                      Tự động
                    </button>
                  )}
                </div>
                <input
                  required
                  className="w-full border rounded-lg px-3 py-2 font-semibold"
                  value={voyageForm.voyage_no}
                  onChange={(e) => {
                    setIsManualVoyageNo(true);
                    setVoyageForm({ ...voyageForm, voyage_no: e.target.value.toUpperCase() });
                  }}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Ngày nhận</label>
                <input
                  type="date"
                  className="w-full border rounded-lg px-3 py-2"
                  value={voyageForm.received_date}
                  onChange={(e) => {
                    const nextDate = e.target.value;
                    setVoyageForm((prev) => ({
                      ...prev,
                      received_date: nextDate,
                      voyage_no:
                        !editingVoyageId && !isManualVoyageNo
                          ? suggestVoyageNoForVessel(prev.vessel_id, nextDate)
                          : prev.voyage_no,
                    }));
                  }}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">PIC (Người phụ trách)</label>
                <input
                  placeholder="VD: Mr Phi / Mr Nguyên"
                  className="w-full border rounded-lg px-3 py-2"
                  value={voyageForm.pic_name}
                  onChange={(e) => setVoyageForm({ ...voyageForm, pic_name: e.target.value })}
                />
              </div>

              <div className="col-span-2 sm:col-span-1">
                <label className="block text-xs font-medium text-slate-600 mb-1">Khách hàng</label>
                <select
                  className="w-full border rounded-lg px-3 py-2"
                  value={voyageForm.customer_id}
                  onChange={(e) => setVoyageForm({ ...voyageForm, customer_id: e.target.value })}
                >
                  <option value="">-- Chọn khách hàng --</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code} — {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="col-span-2 sm:col-span-2">
                <label className="block text-xs font-medium text-slate-600 mb-1">Sà lan tiếp nhận (SL)</label>
                <select
                  required
                  className="w-full border rounded-lg px-3 py-2"
                  value={voyageForm.vessel_id}
                  onChange={(e) => {
                    const nextVesselId = e.target.value;
                    setVoyageForm((prev) => ({
                      ...prev,
                      vessel_id: nextVesselId,
                      voyage_no:
                        !editingVoyageId && !isManualVoyageNo
                          ? suggestVoyageNoForVessel(nextVesselId, prev.received_date)
                          : prev.voyage_no,
                    }));
                  }}
                >
                  {vessels.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.code} — {v.name} ({v.capacity_teu} TEU)
                    </option>
                  ))}
                </select>
              </div>

              <div className="col-span-2 sm:col-span-1">
                <label className="block text-xs font-medium text-slate-600 mb-1">POL (Cảng đi)</label>
                <select
                  required
                  className="w-full border rounded-lg px-3 py-2"
                  value={voyageForm.origin_port_id}
                  onChange={(e) => setVoyageForm({ ...voyageForm, origin_port_id: e.target.value })}
                >
                  {ports.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.code} — {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="col-span-2 sm:col-span-2">
                <label className="block text-xs font-medium text-slate-600 mb-1">POD (Cảng đến)</label>
                <select
                  required
                  className="w-full border rounded-lg px-3 py-2"
                  value={voyageForm.destination_port_id}
                  onChange={(e) => setVoyageForm({ ...voyageForm, destination_port_id: e.target.value })}
                >
                  {ports.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.code} — {p.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Container counts */}
              <div className="col-span-2 sm:col-span-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-700 uppercase">Sản lượng Container gán chuyến</span>
                  <span className="text-xs font-bold text-rose-600">Tổng quy đổi: {calcTeus(voyageForm)} TEUs</span>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">20E (Rỗng)</label>
                    <input
                      type="number"
                      min={0}
                      className="w-full border rounded-lg px-2.5 py-1.5 bg-white"
                      value={voyageForm.cont_20e}
                      onChange={(e) => setVoyageForm({ ...voyageForm, cont_20e: Number(e.target.value) })}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">20F (Hàng)</label>
                    <input
                      type="number"
                      min={0}
                      className="w-full border rounded-lg px-2.5 py-1.5 bg-white"
                      value={voyageForm.cont_20f}
                      onChange={(e) => setVoyageForm({ ...voyageForm, cont_20f: Number(e.target.value) })}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">40E (Rỗng)</label>
                    <input
                      type="number"
                      min={0}
                      className="w-full border rounded-lg px-2.5 py-1.5 bg-white"
                      value={voyageForm.cont_40e}
                      onChange={(e) => setVoyageForm({ ...voyageForm, cont_40e: Number(e.target.value) })}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">40F (Hàng)</label>
                    <input
                      type="number"
                      min={0}
                      className="w-full border rounded-lg px-2.5 py-1.5 bg-white"
                      value={voyageForm.cont_40f}
                      onChange={(e) => setVoyageForm({ ...voyageForm, cont_40f: Number(e.target.value) })}
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Tàu cập</label>
                <input
                  type="date"
                  className="w-full border rounded-lg px-3 py-2"
                  value={voyageForm.vessel_berth_date}
                  onChange={(e) => setVoyageForm({ ...voyageForm, vessel_berth_date: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Hạn lệnh</label>
                <input
                  type="date"
                  className="w-full border rounded-lg px-3 py-2"
                  value={voyageForm.order_deadline}
                  onChange={(e) => setVoyageForm({ ...voyageForm, order_deadline: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Trạng thái</label>
                <select
                  className="w-full border rounded-lg px-3 py-2"
                  value={voyageForm.status}
                  onChange={(e) => setVoyageForm({ ...voyageForm, status: e.target.value })}
                >
                  <option value="PLANNED">Đã lập kế hoạch</option>
                  <option value="IN_TRANSIT">Đang vận chuyển</option>
                  <option value="ARRIVED">Đã cập cảng</option>
                  <option value="COMPLETED">Hoàn thành</option>
                </select>
              </div>

              <div className="col-span-2 sm:col-span-3">
                <label className="block text-xs font-medium text-slate-600 mb-1">Ghi chú cho Thuyền trưởng</label>
                <input
                  className="w-full border rounded-lg px-3 py-2"
                  placeholder="Lưu ý thủy triều, xếp dỡ..."
                  value={voyageForm.captain_notes}
                  onChange={(e) => setVoyageForm({ ...voyageForm, captain_notes: e.target.value })}
                />
              </div>
            </div>
            <div className="flex items-center justify-between gap-2 pt-2">
              <div>
                {editingVoyageId && (
                  <button
                    type="button"
                    onClick={() => handleDeleteVoyage(editingVoyageId, voyageForm.voyage_no)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 text-sm font-medium"
                  >
                    <Trash2 className="w-4 h-4" /> Xóa chuyến (Hủy kế hoạch)
                  </button>
                )}
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowVoyageModal(false)} className="px-4 py-2 rounded-lg border text-sm">
                  Hủy
                </button>
                <button type="submit" className="px-4 py-2 rounded-lg bg-maritime-600 text-white text-sm font-medium">
                  {editingVoyageId ? 'Lưu thay đổi' : 'Phát lệnh điều độ'}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: CREATE / EDIT PORT */}
      {showPortModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <form onSubmit={handleSavePort} className="bg-white rounded-xl max-w-md w-full p-6 space-y-4">
            <h2 className="text-lg font-bold text-slate-900">
              {editingPortId ? 'Chỉnh sửa Thông tin Cảng' : 'Thêm Cảng đi / Cảng đến'}
            </h2>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Mã cảng</label>
                <input
                  required
                  placeholder="VD: BENNGHE"
                  className="w-full border rounded-lg px-3 py-2"
                  value={portForm.code}
                  onChange={(e) => setPortForm({ ...portForm, code: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Loại bến</label>
                <select
                  className="w-full border rounded-lg px-3 py-2"
                  value={portForm.port_type}
                  onChange={(e) => setPortForm({ ...portForm, port_type: e.target.value })}
                >
                  <option value="PORT">Cảng biển / Cảng sông</option>
                  <option value="ICD">ICD / Cảng cạn</option>
                  <option value="ANCHORAGE">Khu neo đậu</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-slate-600 mb-1">Tên cảng / bến</label>
                <input
                  required
                  placeholder="VD: Cảng Bến Nghé"
                  className="w-full border rounded-lg px-3 py-2"
                  value={portForm.name}
                  onChange={(e) => setPortForm({ ...portForm, name: e.target.value })}
                />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-slate-600 mb-1">Tỉnh / Khu vực</label>
                <input
                  className="w-full border rounded-lg px-3 py-2"
                  value={portForm.region}
                  onChange={(e) => setPortForm({ ...portForm, region: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Vĩ độ (Lat)</label>
                <input
                  type="number"
                  step="0.0001"
                  className="w-full border rounded-lg px-3 py-2"
                  value={portForm.lat}
                  onChange={(e) => setPortForm({ ...portForm, lat: Number(e.target.value) })}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Kinh độ (Lng)</label>
                <input
                  type="number"
                  step="0.0001"
                  className="w-full border rounded-lg px-3 py-2"
                  value={portForm.lng}
                  onChange={(e) => setPortForm({ ...portForm, lng: Number(e.target.value) })}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setShowPortModal(false)} className="px-4 py-2 rounded-lg border text-sm">
                Hủy
              </button>
              <button type="submit" className="px-4 py-2 rounded-lg bg-maritime-600 text-white text-sm font-medium">
                {editingPortId ? 'Lưu cảng' : 'Thêm cảng'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: CREATE / EDIT CUSTOMER */}
      {showCustomerModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <form onSubmit={handleSaveCustomer} className="bg-white rounded-xl max-w-md w-full p-6 space-y-4">
            <h2 className="text-lg font-bold text-slate-900">
              {editingCustomerId ? 'Chỉnh sửa Khách hàng' : 'Thêm Khách hàng mới'}
            </h2>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Mã KH</label>
                <input
                  required
                  placeholder="VD: VSV, LOGHPG"
                  className="w-full border rounded-lg px-3 py-2"
                  value={customerForm.code}
                  onChange={(e) => setCustomerForm({ ...customerForm, code: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Mã số thuế</label>
                <input
                  placeholder="030..."
                  className="w-full border rounded-lg px-3 py-2"
                  value={customerForm.tax_code}
                  onChange={(e) => setCustomerForm({ ...customerForm, tax_code: e.target.value })}
                />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-slate-600 mb-1">Tên Khách hàng / Công ty</label>
                <input
                  required
                  placeholder="Tên công ty..."
                  className="w-full border rounded-lg px-3 py-2"
                  value={customerForm.name}
                  onChange={(e) => setCustomerForm({ ...customerForm, name: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Người liên hệ</label>
                <input
                  className="w-full border rounded-lg px-3 py-2"
                  value={customerForm.contact_person}
                  onChange={(e) => setCustomerForm({ ...customerForm, contact_person: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Số điện thoại</label>
                <input
                  className="w-full border rounded-lg px-3 py-2"
                  value={customerForm.phone}
                  onChange={(e) => setCustomerForm({ ...customerForm, phone: e.target.value })}
                />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-slate-600 mb-1">Địa chỉ</label>
                <input
                  className="w-full border rounded-lg px-3 py-2"
                  value={customerForm.address}
                  onChange={(e) => setCustomerForm({ ...customerForm, address: e.target.value })}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setShowCustomerModal(false)} className="px-4 py-2 rounded-lg border text-sm">
                Hủy
              </button>
              <button type="submit" className="px-4 py-2 rounded-lg bg-maritime-600 text-white text-sm font-medium">
                {editingCustomerId ? 'Lưu khách hàng' : 'Thêm khách hàng'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
