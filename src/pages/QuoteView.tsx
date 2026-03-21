import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { FileText, CheckCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { formatMoneyFromCents } from '../lib/invoicesApi';

interface QuoteData {
  invoice: {
    id: string;
    invoice_number: string;
    subject: string | null;
    status: string;
    issued_at: string | null;
    due_date: string | null;
    subtotal_cents: number;
    tax_cents: number;
    total_cents: number;
    currency: string;
  };
  client: { first_name: string; last_name: string; company: string | null; email: string | null } | null;
  items: Array<{ id: string; description: string; qty: number; unit_price_cents: number; line_total_cents: number }>;
}

export default function QuoteView() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<QuoteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) return;
    loadQuote();
  }, [token]);

  async function loadQuote() {
    try {
      // Fetch invoice by view_token
      const { data: invoice, error: invErr } = await supabase
        .from('invoices')
        .select('id, invoice_number, subject, status, issued_at, due_date, subtotal_cents, tax_cents, total_cents, currency, client_id')
        .eq('view_token', token)
        .is('deleted_at', null)
        .maybeSingle();

      if (invErr || !invoice) {
        setError('Quote not found');
        setLoading(false);
        return;
      }

      // Track view via backend
      const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3002';
      fetch(`${API_BASE}/api/quotes/${invoice.id}/track-view`, { method: 'POST' }).catch(() => {});

      // Get items
      const { data: items } = await supabase
        .from('invoice_items')
        .select('id, description, qty, unit_price_cents, line_total_cents')
        .eq('invoice_id', invoice.id)
        .order('created_at', { ascending: true });

      // Get client
      let client = null;
      if (invoice.client_id) {
        const { data: c } = await supabase
          .from('clients')
          .select('first_name, last_name, company, email')
          .eq('id', invoice.client_id)
          .maybeSingle();
        client = c;
      }

      setData({
        invoice: {
          id: invoice.id,
          invoice_number: invoice.invoice_number,
          subject: invoice.subject,
          status: invoice.status,
          issued_at: invoice.issued_at,
          due_date: invoice.due_date,
          subtotal_cents: Number(invoice.subtotal_cents || 0),
          tax_cents: Number(invoice.tax_cents || 0),
          total_cents: Number(invoice.total_cents || 0),
          currency: invoice.currency || 'CAD',
        },
        client,
        items: (items || []).map((i: any) => ({
          id: i.id,
          description: i.description,
          qty: i.qty,
          unit_price_cents: Number(i.unit_price_cents || 0),
          line_total_cents: Number(i.line_total_cents || 0),
        })),
      });
    } catch (err: any) {
      setError('Could not load quote');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-secondary flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-outline-subtle border-t-text-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-surface-secondary flex items-center justify-center">
        <div className="text-center">
          <FileText size={40} className="text-text-tertiary mx-auto mb-3" />
          <h1 className="text-lg font-bold text-text-primary">Quote Not Found</h1>
          <p className="text-sm text-text-tertiary mt-1">This link may have expired or is invalid.</p>
        </div>
      </div>
    );
  }

  const { invoice, client, items } = data;
  const cur = invoice.currency;

  return (
    <div className="min-h-screen bg-surface-secondary py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header card */}
        <div className="bg-surface rounded-2xl border border-outline p-6 mb-4">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <FileText size={16} className="text-primary" />
                </div>
                <h1 className="text-[18px] font-bold text-text-primary">Quote {invoice.invoice_number}</h1>
              </div>
              {invoice.subject && (
                <p className="text-[13px] text-text-secondary">{invoice.subject}</p>
              )}
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-[12px] font-semibold">
              <CheckCircle size={12} />
              Received
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-4 text-[13px]">
            {client && (
              <div>
                <p className="text-text-tertiary text-[11px] font-semibold uppercase tracking-wider mb-1">Client</p>
                <p className="font-semibold text-text-primary">{client.first_name} {client.last_name}</p>
                {client.company && <p className="text-text-secondary">{client.company}</p>}
                {client.email && <p className="text-text-secondary">{client.email}</p>}
              </div>
            )}
            <div>
              <p className="text-text-tertiary text-[11px] font-semibold uppercase tracking-wider mb-1">Details</p>
              {invoice.issued_at && <p className="text-text-secondary">Issued: {new Date(invoice.issued_at).toLocaleDateString()}</p>}
              {invoice.due_date && <p className="text-text-secondary">Due: {new Date(invoice.due_date).toLocaleDateString()}</p>}
            </div>
          </div>
        </div>

        {/* Line items */}
        <div className="bg-surface rounded-2xl border border-outline p-6 mb-4">
          <h2 className="text-[14px] font-bold text-text-primary mb-4">Items</h2>
          <table className="w-full text-[13px]">
            <thead className="border-b border-outline">
              <tr>
                <th className="text-left py-2 font-semibold text-text-secondary">Description</th>
                <th className="text-center py-2 font-semibold text-text-secondary">Qty</th>
                <th className="text-right py-2 font-semibold text-text-secondary">Price</th>
                <th className="text-right py-2 font-semibold text-text-secondary">Total</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b border-outline/50">
                  <td className="py-2.5 text-text-primary">{item.description}</td>
                  <td className="py-2.5 text-center text-text-secondary">{item.qty}</td>
                  <td className="py-2.5 text-right text-text-secondary">{formatMoneyFromCents(item.unit_price_cents, cur)}</td>
                  <td className="py-2.5 text-right font-medium text-text-primary">{formatMoneyFromCents(item.line_total_cents, cur)}</td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr><td colSpan={4} className="py-6 text-center text-text-tertiary">No items</td></tr>
              )}
            </tbody>
          </table>

          {/* Totals */}
          <div className="mt-4 ml-auto w-full max-w-xs space-y-1.5 bg-surface-secondary rounded-xl p-4">
            <div className="flex justify-between text-[13px]">
              <span className="text-text-secondary">Subtotal</span>
              <span className="font-semibold">{formatMoneyFromCents(invoice.subtotal_cents, cur)}</span>
            </div>
            <div className="flex justify-between text-[13px]">
              <span className="text-text-secondary">Tax</span>
              <span className="font-semibold">{formatMoneyFromCents(invoice.tax_cents, cur)}</span>
            </div>
            <div className="flex justify-between text-[15px] border-t border-outline pt-2">
              <span className="font-bold text-text-primary">Total</span>
              <span className="font-bold text-text-primary">{formatMoneyFromCents(invoice.total_cents, cur)}</span>
            </div>
          </div>
        </div>

        <p className="text-center text-[11px] text-text-tertiary mt-6">
          Powered by Lume CRM
        </p>
      </div>
    </div>
  );
}
