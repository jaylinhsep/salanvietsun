'use client';

import React from 'react';

const LABELS: Record<string, { text: string; cls: string }> = {
  AVAILABLE: { text: 'Sẵn sàng', cls: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  IN_VOYAGE: { text: 'Đang chạy chuyến', cls: 'bg-sky-100 text-sky-800 border-sky-200' },
  IN_TRANSIT: { text: 'Đang vận chuyển', cls: 'bg-sky-100 text-sky-800 border-sky-200' },
  MAINTENANCE: { text: 'Đang bảo trì', cls: 'bg-amber-100 text-amber-800 border-amber-200' },
  IDLE: { text: 'Neo đậu chờ', cls: 'bg-slate-100 text-slate-700 border-slate-200' },
  PLANNED: { text: 'Đã lập kế hoạch', cls: 'bg-indigo-100 text-indigo-800 border-indigo-200' },
  DEPARTED: { text: 'Đã rời cảng', cls: 'bg-sky-100 text-sky-800 border-sky-200' },
  ARRIVED: { text: 'Đã cập cảng', cls: 'bg-teal-100 text-teal-800 border-teal-200' },
  COMPLETED: { text: 'Hoàn thành', cls: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  CONFIRMED: { text: 'Đã xác nhận', cls: 'bg-blue-100 text-blue-800 border-blue-200' },
  PENDING: { text: 'Chờ xử lý', cls: 'bg-slate-100 text-slate-700 border-slate-200' },
  PAID: { text: 'Đã thanh toán', cls: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  PARTIAL: { text: 'Thanh toán 1 phần', cls: 'bg-amber-100 text-amber-800 border-amber-200' },
  UNPAID: { text: 'Chưa thanh toán', cls: 'bg-rose-100 text-rose-800 border-rose-200' },
  OPEN: { text: 'Mới tiếp nhận', cls: 'bg-rose-100 text-rose-800 border-rose-200' },
  IN_PROGRESS: { text: 'Đang thực hiện', cls: 'bg-amber-100 text-amber-800 border-amber-200' },
  HIGH: { text: 'Cao', cls: 'bg-orange-100 text-orange-800 border-orange-200' },
  CRITICAL: { text: 'Khẩn cấp', cls: 'bg-rose-100 text-rose-800 border-rose-200' },
  MEDIUM: { text: 'Trung bình', cls: 'bg-sky-100 text-sky-800 border-sky-200' },
  LOW: { text: 'Thấp', cls: 'bg-slate-100 text-slate-700 border-slate-200' },
  BUNKERING: { text: 'Cấp dầu', cls: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  CONSUMPTION: { text: 'Tiêu thụ', cls: 'bg-amber-100 text-amber-800 border-amber-200' },
  OPERATIONAL: { text: 'Hoạt động tốt', cls: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  WARNING: { text: 'Cần kiểm tra', cls: 'bg-amber-100 text-amber-800 border-amber-200' },
  FAULTY: { text: 'Hỏng / Lỗi', cls: 'bg-rose-100 text-rose-800 border-rose-200' },
};

export function StatusBadge({ status }: { status: string }) {
  const item = LABELS[status] || { text: status, cls: 'bg-slate-100 text-slate-700 border-slate-200' };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${item.cls}`}>
      {item.text}
    </span>
  );
}
