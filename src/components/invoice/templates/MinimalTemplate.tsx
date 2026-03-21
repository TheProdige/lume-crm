import React from 'react';
import type { InvoiceRenderData } from '../types';
import { formatMoneyFromCents } from '../../../lib/invoicesApi';

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '--';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '--';
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

export default function MinimalTemplate({ data }: { data: InvoiceRenderData }) {
  const fmt = (cents: number) => formatMoneyFromCents(cents, data.currency);
  const primary = data.primary_color || '#111827';
  const accent = data.accent_color || '#059669';

  return (
    <div className="bg-white text-gray-800" style={{ fontFamily: '"Inter", -apple-system, sans-serif' }}>
      {/* Header — ultra-clean */}
      <div className="flex items-start justify-between">
        <div>
          {data.company_logo_url ? (
            <img src={data.company_logo_url} alt={data.company_name} className="h-8 max-w-[160px] object-contain" />
          ) : (
            <h1 className="text-lg font-semibold" style={{ color: primary }}>{data.company_name}</h1>
          )}
        </div>
        <div className="text-right">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-gray-400">Invoice</p>
          <p className="mt-0.5 text-sm font-semibold" style={{ color: primary }}>{data.invoice_number}</p>
        </div>
      </div>

      {/* Thin accent line */}
      <div className="my-6 h-px" style={{ backgroundColor: accent }} />

      {/* Meta row */}
      <div className="flex gap-8 text-xs text-gray-500">
        <div>
          <p className="font-semibold uppercase tracking-wider text-gray-400">Date</p>
          <p className="mt-0.5">{fmtDate(data.issued_at || data.created_at)}</p>
        </div>
        <div>
          <p className="font-semibold uppercase tracking-wider text-gray-400">Due</p>
          <p className="mt-0.5">{fmtDate(data.due_date)}</p>
        </div>
        <div>
          <p className="font-semibold uppercase tracking-wider text-gray-400">Status</p>
          <p className="mt-0.5 font-semibold" style={{
            color: data.status === 'paid' ? '#059669' : data.status === 'void' ? '#dc2626' : primary,
          }}>
            {data.status === 'partial' ? 'Partial' : data.status.charAt(0).toUpperCase() + data.status.slice(1)}
          </p>
        </div>
      </div>

      {/* Client */}
      <div className="mt-6">
        <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-gray-400">Billed To</p>
        <p className="mt-1 text-sm font-semibold" style={{ color: primary }}>{data.client_name}</p>
        <div className="text-xs text-gray-500">
          {data.client_email && <p>{data.client_email}</p>}
          {data.client_phone && <p>{data.client_phone}</p>}
        </div>
      </div>

      {/* Subject */}
      {data.subject && (
        <p className="mt-4 text-xs italic text-gray-500">{data.subject}</p>
      )}

      {/* Items — minimal table */}
      <div className="mt-6">
        <div className="border-b border-gray-200 pb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
          <div className="grid grid-cols-12 gap-2">
            <div className="col-span-6">Description</div>
            <div className="col-span-2 text-right">Qty</div>
            <div className="col-span-2 text-right">Price</div>
            <div className="col-span-2 text-right">Total</div>
          </div>
        </div>
        <div className="divide-y divide-gray-100">
          {data.items.map((item) => (
            <div key={item.id} className="grid grid-cols-12 gap-2 py-3 text-xs">
              <div className="col-span-6 text-gray-800">
                {item.title && <span className="font-medium">{item.title}: </span>}
                {item.description}
              </div>
              <div className="col-span-2 text-right text-gray-500">{item.qty}</div>
              <div className="col-span-2 text-right text-gray-500">{fmt(item.unit_price_cents)}</div>
              <div className="col-span-2 text-right font-medium">{fmt(item.line_total_cents)}</div>
            </div>
          ))}
          {data.items.length === 0 && (
            <div className="py-8 text-center text-xs text-gray-400">No items</div>
          )}
        </div>
      </div>

      {/* Totals — right-aligned, minimal */}
      <div className="mt-6 flex justify-end">
        <div className="w-56 space-y-1.5 text-xs">
          <div className="flex justify-between text-gray-500">
            <span>Subtotal</span>
            <span>{fmt(data.subtotal_cents)}</span>
          </div>
          {data.discount_cents > 0 && (
            <div className="flex justify-between text-red-500">
              <span>Discount</span>
              <span>-{fmt(data.discount_cents)}</span>
            </div>
          )}
          <div className="flex justify-between text-gray-500">
            <span>Tax</span>
            <span>{fmt(data.tax_cents)}</span>
          </div>
          <div className="h-px" style={{ backgroundColor: accent }} />
          <div className="flex justify-between pt-1 text-sm font-bold" style={{ color: primary }}>
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
              <span>Balance</span>
              <span>{fmt(data.balance_cents)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Notes */}
      {data.notes && (
        <div className="mt-8">
          <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-gray-400">Notes</p>
          <p className="mt-1 whitespace-pre-wrap text-xs text-gray-500">{data.notes}</p>
        </div>
      )}

      {/* Footer */}
      <div className="mt-10 text-center text-[10px] text-gray-300">
        {data.company_name}
      </div>
    </div>
  );
}
