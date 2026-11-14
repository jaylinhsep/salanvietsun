'use client';

import React, { useEffect, useState } from 'react';
import { FileSpreadsheet, Wallet } from 'lucide-react';
import {
  API_URL,
  FALLBACK_INVOICES,
  FALLBACK_ORDERS,
  fetchApi,
  formatVND,
  type Invoice,
  type Order,
} from '@/lib/api';
import { StatusBadge } from '@/components/StatusBadge';

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>(FALLBACK_ORDERS);
  const [invoices, setInvoices] = useState<Invoice[]>(FALLBACK_INVOICES);

  const load = () => {
    fetchApi<Order[]>('/orders', FALLBACK_ORDERS).then((r) => setOrders(r.data));
    fetchApi<Invoice[]>('/orders/invoices', FALLBACK_INVOICES).then((r) => setInvoices(r.data));
  };

  useEffect(() => {
    load();
  }, []);

  const handlePayFull = async (inv: Invoice) => {
    try {
      await fetch(`${API_URL}/orders/invoices/${inv.id}/payment`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: inv.balance_due }),
      });
      load();
    } catch {
      setInvoices((prev) =>
        prev.map((x) =>
          x.id === inv.id ? { ...x, paid_amount: x.total_amount, balance_due: 0, payment_status: 'PAID' } : x,
        ),
      );
    }
  };

  const totalReceivable = invoices.reduce((s, i) => s + Number(i.balance_due || 0), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Quản lý Đơn hàng, Cước phí & Công nợ</h1>
        <p className="text-sm text-slate-500">Theo dõi hợp đồng vận chuyển, tính cước theo tấn/chuyến, hóa đơn VAT & thu hồi công nợ</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-xs font-medium text-slate-500 uppercase">Tổng đơn hàng</div>
          <div className="mt-1 text-2xl font-bold text-slate-900">{orders.length} đơn</div>
        </div>
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-xs font-medium text-slate-500 uppercase">Doanh thu cước dự kiến</div>
          <div className="mt-1 text-2xl font-bold text-maritime-600">
            {formatVND(orders.reduce((s, o) => s + Number(o.total_freight) + Number(o.surcharge), 0))}
          </div>
        </div>
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-xs font-medium text-slate-500 uppercase">Công nợ chưa thu</div>
          <div className="mt-1 text-2xl font-bold text-rose-600">{formatVND(totalReceivable)}</div>
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 font-semibold text-slate-900 flex items-center gap-2">
          <FileSpreadsheet className="w-4 h-4 text-maritime-600" /> Danh sách Đơn hàng Vận tải
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-xs uppercase text-slate-600">
              <tr>
                <th className="px-4 py-3">Mã đơn</th>
                <th className="px-4 py-3">Khách hàng</th>
                <th className="px-4 py-3">Tuyến đường</th>
                <th className="px-4 py-3">Hàng hóa</th>
                <th className="px-4 py-3">Tổng cước + Phụ phí</th>
                <th className="px-4 py-3">Trạng thái</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {orders.map((o) => (
                <tr key={o.id}>
                  <td className="px-4 py-3 font-semibold text-navy-900">{o.order_no}</td>
                  <td className="px-4 py-3 font-medium">{o.customer_name}</td>
                  <td className="px-4 py-3 text-xs">
                    <div>{o.origin_name}</div>
                    <div className="text-maritime-600">→ {o.dest_name}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div>{o.cargo_type}</div>
                    <div className="text-xs text-slate-500">{o.cargo_weight_tons} tấn</div>
                  </td>
                  <td className="px-4 py-3 font-semibold text-slate-900">
                    {formatVND(Number(o.total_freight) + Number(o.surcharge))}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={o.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Invoices Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 font-semibold text-slate-900 flex items-center gap-2">
          <Wallet className="w-4 h-4 text-indigo-600" /> Hóa đơn & Công nợ Phải thu
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-xs uppercase text-slate-600">
              <tr>
                <th className="px-4 py-3">Số hóa đơn</th>
                <th className="px-4 py-3">Khách hàng</th>
                <th className="px-4 py-3">Tổng tiền (VAT)</th>
                <th className="px-4 py-3">Đã thanh toán</th>
                <th className="px-4 py-3">Còn nợ</th>
                <th className="px-4 py-3">Trạng thái</th>
                <th className="px-4 py-3">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {invoices.map((inv) => (
                <tr key={inv.id}>
                  <td className="px-4 py-3 font-semibold">{inv.invoice_no}</td>
                  <td className="px-4 py-3">{inv.customer_name}</td>
                  <td className="px-4 py-3 font-medium">{formatVND(inv.total_amount)}</td>
                  <td className="px-4 py-3 text-emerald-700">{formatVND(inv.paid_amount)}</td>
                  <td className="px-4 py-3 font-semibold text-rose-600">{formatVND(inv.balance_due)}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={inv.payment_status} />
                  </td>
                  <td className="px-4 py-3">
                    {inv.payment_status !== 'PAID' && (
                      <button
                        onClick={() => handlePayFull(inv)}
                        className="px-3 py-1 rounded bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-500"
                      >
                        Ghi nhận đã thu
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
