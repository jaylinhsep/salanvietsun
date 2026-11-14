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

type TabKey = 'VOYAGES' | 'PORTS' | 'CUSTOMERS';

const EMPTY_VOYAGE_FORM = {
  voyage_no: '',
  received_date: new Date().toISOString().slice(0, 10),
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
  const [voyages, setVoyages] = useState<Voyage[]>(FALLBACK_VOYAGES);
  const [vessels, setVessels] = useState<Vessel[]>(FALLBACK_VESSELS);
  const [ports, setPorts] = useState<Port[]>(FALLBACK_PORTS);
  const [customers, setCustomers] = useState<Customer[]>(FALLBACK_CUSTOMERS);

  // Voyage modal
  const [showVoyageModal, setShowVoyageModal] = useState(false);
  const [editingVoyageId, setEditingVoyageId] = useState<string | null>(null);
  const [voyageForm, setVoyageForm] = useState(EMPTY_VOYAGE_FORM);

  // Port modal
  const [showPortModal, setShowPortModal] = useState(false);
  const [editingPortId, setEditingPortId] = useState<string | null>(null);
  const [portForm, setPortForm] = useState(EMPTY_PORT_FORM);

  // Customer modal
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [editingCustomerId, setEditingCustomerId] = useState<string | null>(null);
  const [customerForm, setCustomerForm] = useState(EMPTY_CUSTOMER_FORM);

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
  const openCreateVoyage = () => {
    setEditingVoyageId(null);
    setVoyageForm({
      ...EMPTY_VOYAGE_FORM,
      voyage_no: `VOY-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
      customer_id: customers[0]?.id || '',
      vessel_id: vessels[0]?.id || '',
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
    await fetch(`${API_URL}/dispatch/ports/${id}`, { method: 'DELETE' }).catch(() => null);
    loadAll();
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
    await fetch(`${API_URL}/orders/customers/${id}`, { method: 'DELETE' }).catch(() => null);
    loadAll();
  };

  const sumTeus = voyages.reduce((acc, vy) => acc + Number(vy.total_teus || 0), 0);

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
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-700">
              Bảng theo dõi điều độ sà lan & sản lượng TEU (bấm vào từng chuyến để nhập/xem chi tiết từng container)
            </span>
            <span className="font-bold text-rose-600 text-sm">Tổng sản lượng: {sumTeus} TEUs</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left whitespace-nowrap">
              <thead className="bg-slate-100 text-slate-700 uppercase font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-3 py-2.5">Ngày nhận</th>
                  <th className="px-3 py-2.5">Mã chuyến</th>
                  <th className="px-3 py-2.5">PIC</th>
                  <th className="px-3 py-2.5">Khách hàng</th>
                  <th className="px-2 py-2.5 text-center">20E</th>
                  <th className="px-2 py-2.5 text-center">20F</th>
                  <th className="px-2 py-2.5 text-center">40E</th>
                  <th className="px-2 py-2.5 text-center">40F</th>
                  <th className="px-3 py-2.5 text-center text-rose-700 bg-rose-50">Số TEUs</th>
                  <th className="px-3 py-2.5">POL (Cảng đi)</th>
                  <th className="px-3 py-2.5">POD (Cảng đến)</th>
                  <th className="px-3 py-2.5">Tàu cập</th>
                  <th className="px-3 py-2.5">Hạn lệnh</th>
                  <th className="px-3 py-2.5">SL Tiếp nhận</th>
                  <th className="px-3 py-2.5">Trạng thái</th>
                  <th className="px-3 py-2.5 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {voyages.map((vy) => (
                  <tr
                    key={vy.id}
                    onClick={() => selectVoyage(vy.id)}
                    className="hover:bg-sky-50/60 cursor-pointer"
                    title="Bấm để xem hoặc nhập chi tiết container của chuyến này"
                  >
                    <td className="px-3 py-2.5 text-slate-600">
                      {vy.received_date ? vy.received_date.slice(0, 10) : '—'}
                    </td>
                    <td className="px-3 py-2.5 font-semibold text-maritime-700 underline decoration-dotted">
                      <div>{vy.voyage_no}</div>
                      <div className="text-[10px] font-normal text-slate-500 no-underline">
                        {vy.detail_count ? `${vy.detail_count} cont chi tiết` : 'Chưa nhập chi tiết'}
                      </div>
                    </td>
                    <td className="px-3 py-2.5">{vy.pic_name || '—'}</td>
                    <td className="px-3 py-2.5 font-medium text-slate-900">
                      {vy.customer_code ? `${vy.customer_code} (${vy.customer_name})` : vy.customer_name || '—'}
                    </td>
                    <td className="px-2 py-2.5 text-center">{vy.cont_20e || 0}</td>
                    <td className="px-2 py-2.5 text-center">{vy.cont_20f || 0}</td>
                    <td className="px-2 py-2.5 text-center">{vy.cont_40e || 0}</td>
                    <td className="px-2 py-2.5 text-center">{vy.cont_40f || 0}</td>
                    <td className="px-3 py-2.5 text-center font-bold text-rose-700 bg-rose-50/60">
                      {vy.total_teus || 0}
                    </td>
                    <td className="px-3 py-2.5 font-medium">{vy.origin_name || '—'}</td>
                    <td className="px-3 py-2.5 font-medium text-maritime-700">{vy.dest_name || '—'}</td>
                    <td className="px-3 py-2.5 text-slate-600">
                      {vy.vessel_berth_date ? vy.vessel_berth_date.slice(0, 10) : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-slate-600">
                      {vy.order_deadline ? vy.order_deadline.slice(0, 10) : '—'}
                    </td>
                    <td className="px-3 py-2.5 font-semibold text-slate-800">{vy.vessel_name || 'Chưa gán'}</td>
                    <td className="px-3 py-2.5">
                      <StatusBadge status={vy.status} />
                    </td>
                    <td
                      className="px-3 py-2.5 text-right space-x-1.5"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={() => selectVoyage(vy.id)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 font-medium"
                      >
                        <ListChecks className="w-3 h-3" /> Chi tiết
                      </button>
                      <button
                        onClick={() => openEditVoyage(vy)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-slate-200 text-slate-700 hover:bg-slate-100"
                      >
                        <Pencil className="w-3 h-3 text-maritime-600" /> Sửa
                      </button>
                      {vy.status === 'PLANNED' && (
                        <button
                          onClick={() => advanceStatus(vy, 'IN_TRANSIT')}
                          className="px-2.5 py-1 rounded bg-sky-600 text-white hover:bg-sky-500"
                        >
                          Xuất bến
                        </button>
                      )}
                      {vy.status === 'IN_TRANSIT' && (
                        <button
                          onClick={() => advanceStatus(vy, 'COMPLETED')}
                          className="px-2.5 py-1 rounded bg-emerald-600 text-white hover:bg-emerald-500"
                        >
                          Hoàn thành
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
                <label className="block text-xs font-medium text-slate-600 mb-1">Mã chuyến</label>
                <input
                  required
                  className="w-full border rounded-lg px-3 py-2"
                  value={voyageForm.voyage_no}
                  onChange={(e) => setVoyageForm({ ...voyageForm, voyage_no: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Ngày nhận</label>
                <input
                  type="date"
                  className="w-full border rounded-lg px-3 py-2"
                  value={voyageForm.received_date}
                  onChange={(e) => setVoyageForm({ ...voyageForm, received_date: e.target.value })}
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
                  onChange={(e) => setVoyageForm({ ...voyageForm, vessel_id: e.target.value })}
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
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setShowVoyageModal(false)} className="px-4 py-2 rounded-lg border text-sm">
                Hủy
              </button>
              <button type="submit" className="px-4 py-2 rounded-lg bg-maritime-600 text-white text-sm font-medium">
                {editingVoyageId ? 'Lưu thay đổi' : 'Phát lệnh điều độ'}
              </button>
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
