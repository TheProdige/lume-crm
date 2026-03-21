import React from 'react';
import type { InvoiceRenderData } from '../types';
import { formatMoneyFromCents } from '../../../lib/invoicesApi';

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '--';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '--';
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function statusBadge(status: string, accentColor: string) {
  const map: Record<string, string> = {
    draft: 'Draft', sent: 'Sent', partial: 'Partial', paid: 'Paid', void: 'Void',
  };
  const isPaid = status === 'paid';
  return (
    <span
      className="inline-block rounded px-3 py-1 text-xs font-bold uppercase tracking-wider"
      style={{
        backgroundColor: isPaid ? '#059669' : status === 'void' ? '#dc2626' : accentColor,
        color: '#fff',
      }}
    >
      {map[status] || status}
    </span>
  );
}

export default function ClassicTemplate({ data }: { data: InvoiceRenderData }) {
  const fmt = (cents: number) => formatMoneyFromCents(cents, data.currency);
  const primary = data.primary_color || '#1a1a2e';
  const accent = data.accent_color || '#4f46e5';

  return (
    <div className="bg-white text-gray-900 print:shadow-none" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      {/* Header */}
      <div className="flex items-start justify-between border-b-2 pb-6" style={{ borderColor: primary }}>
        <div>
          {data.company_logo_url ? (
            <img src={data.company_logo_url} alt={data.company_name} className="h-12 max-w-[200px] object-contain" />
          ) : (
            <h1 className="text-2xl font-bold tracking-tight" style={{ color: primary }}>{data.company_name}</h1>
          )}
          {data.company_address && <p className="mt-1 text-xs text-gray-500">{data.company_address}</p>}
          {data.company_email && <p className="text-xs text-gray-500">{data.company_email}</p>}
          {data.company_phone && <p className="text-xs text-gray-500">{data.company_phone}</p>}
        </div>
        <div className="text-right">
          <h2 className="text-3xl font-bold tracking-tight" style={{ color: primary }}>INVOICE</h2>
          <p className="mt-1 text-sm font-medium text-gray-600">{data.invoice_number}</p>
          {statusBadge(data.status, accent)}
        </div>
      </div>

      {/* Meta + Client */}
      <div className="mt-6 grid grid-cols-2 gap-8">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Bill To</p>
          <p className="mt-1 text-sm font-bold" style={{ color: primary }}>{data.client_name}</p>
          {data.client_company && <p className="text-xs text-gray-600">{data.client_company}</p>}
          {data.client_email && <p className="text-xs text-gray-500">{data.client_email}</p>}
          {data.client_phone && <p className="text-xs text-gray-500">{data.client_phone}</p>}
          {data.client_address && <p className="text-xs text-gray-500">{data.client_address}</p>}
        </div>
        <div className="text-right">
          <div className="space-y-1 text-xs">
            <p><span className="font-semibold text-gray-500">Date:</span> {fmtDate(data.created_at)}</p>
            <p><span className="font-semibold text-gray-500">Issued:</span> {fmtDate(data.issued_at)}</p>
            <p><span className="font-semibold text-gray-500">Due Date:</span> {fmtDate(data.due_date)}</p>
          </div>
        </div>
      </div>

      {/* Subject */}
      {data.subject && (
        <div className="mt-4 rounded border border-gray-200 bg-gray-50 px-3 py-2">
          <p className="text-xs text-gray-500">Subject</p>
          <p className="text-sm font-medium">{data.subject}</p>
        </div>
      )}

      {/* Line Items Table */}
      <div className="mt-6">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ backgroundColor: primary }}>
              <th className="px-3 py-2 text-left text-xs font-bold uppercase tracking-wider text-white">Description</th>
              <th className="px-3 py-2 text-right text-xs font-bold uppercase tracking-wider text-white">Qty</th>
              <th className="px-3 py-2 text-right text-xs font-bold uppercase tracking-wider text-white">Unit Price</th>
              <th className="px-3 py-2 text-right text-xs font-bold uppercase tracking-wider text-white">Total</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((item, i) => (
              <tr key={item.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                <td className="px-3 py-2.5 text-gray-900">
                  {item.title && <span className="font-medium">{item.title} — </span>}
                  {item.description}
                </td>
                <td className="px-3 py-2.5 text-right text-gray-600">{item.qty}</td>
                <td className="px-3 py-2.5 text-right text-gray-600">{fmt(item.unit_price_cents)}</td>
                <td className="px-3 py-2.5 text-right font-medium">{fmt(item.line_total_cents)}</td>
              </tr>
            ))}
            {data.items.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-gray-400">No line items</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Totals */}
      <div className="mt-4 flex justify-end">
        <div className="w-72 space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">Subtotal</span>
            <span>{fmt(data.subtotal_cents)}</span>
          </div>
          {data.discount_cents > 0 && (
            <div className="flex justify-between text-red-600">
              <span>Discount</span>
              <span>-{fmt(data.discount_cents)}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-gray-500">Tax</span>
            <span>{fmt(data.tax_cents)}</span>
          </div>
          <div className="flex justify-between border-t-2 pt-2 text-base font-bold" style={{ borderColor: primary }}>
            <span>Total</span>
            <span>{fmt(data.total_cents)}</span>
          </div>
          {data.paid_cents > 0 && (
            <div className="flex justify-between text-green-600">
              <span>Paid</span>
              <span>{fmt(data.paid_cents)}</span>
            </div>
          )}
          {data.balance_cents > 0 && data.balance_cents !== data.total_cents && (
            <div className="flex justify-between font-bold" style={{ color: accent }}>
              <span>Balance Due</span>
              <span>{fmt(data.balance_cents)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Notes */}
      {data.notes && (
        <div className="mt-6 border-t border-gray-200 pt-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Notes</p>
          <p className="mt-1 whitespace-pre-wrap text-xs text-gray-600">{data.notes}</p>
        </div>
      )}

      {/* Footer */}
      <div className="mt-8 border-t border-gray-200 pt-4 text-center text-[10px] text-gray-400">
        <p>Thank you for your business</p>
        {data.company_name && <p className="mt-0.5">{data.company_name}</p>}
      </div>
    </div>
  );
}
