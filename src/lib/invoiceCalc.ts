// ── Invoice-specific financial calculations ──
// Safe money handling in cents. No floating-point issues.

export interface InvoiceLineCalc {
  description: string;
  title?: string | null;
  qty: number;
  unit_price_cents: number;
  sort_order?: number;
  source_type?: string | null;
  source_id?: string | null;
}

export interface InvoiceTotals {
  subtotal_cents: number;
  discount_cents: number;
  tax_cents: number;
  total_cents: number;
  balance_cents: number;
}

/**
 * Calculate invoice totals from line items + discount + tax.
 * All values in cents (integers).
 */
export function calculateInvoiceTotals(
  items: InvoiceLineCalc[],
  taxCents: number,
  discountCents: number,
  paidCents: number = 0,
): InvoiceTotals {
  const subtotalCents = items.reduce(
    (sum, item) => sum + Math.max(0, Math.round(item.qty * item.unit_price_cents)),
    0,
  );

  const clampedDiscount = Math.min(Math.max(0, Math.round(discountCents)), subtotalCents);
  const clampedTax = Math.max(0, Math.round(taxCents));
  const totalCents = Math.max(0, subtotalCents - clampedDiscount + clampedTax);
  const balanceCents = Math.max(0, totalCents - Math.max(0, Math.round(paidCents)));

  return {
    subtotal_cents: subtotalCents,
    discount_cents: clampedDiscount,
    tax_cents: clampedTax,
    total_cents: totalCents,
    balance_cents: balanceCents,
  };
}

/**
 * Calculate line total in cents.
 */
export function lineTotal(qty: number, unitPriceCents: number): number {
  return Math.max(0, Math.round(qty * unitPriceCents));
}

/**
 * Auto-calculate tax cents from subtotal given tax rates.
 */
export function calculateTaxFromRates(
  subtotalCents: number,
  taxRates: Array<{ rate: number; enabled: boolean }>,
): number {
  return taxRates
    .filter((t) => t.enabled && t.rate > 0)
    .reduce((sum, t) => sum + Math.round(subtotalCents * (t.rate / 100)), 0);
}

/**
 * Invoice status display mapping.
 */
export const INVOICE_STATUS_CONFIG: Record<string, {
  label: string;
  labelFr: string;
  color: string;
  bgColor: string;
}> = {
  draft: { label: 'Draft', labelFr: 'Brouillon', color: 'text-gray-600', bgColor: 'bg-gray-100' },
  sent: { label: 'Sent', labelFr: 'Envoyee', color: 'text-blue-600', bgColor: 'bg-blue-50' },
  partial: { label: 'Partially Paid', labelFr: 'Partiel', color: 'text-amber-600', bgColor: 'bg-amber-50' },
  paid: { label: 'Paid', labelFr: 'Payee', color: 'text-green-600', bgColor: 'bg-green-50' },
  void: { label: 'Void', labelFr: 'Annulee', color: 'text-red-600', bgColor: 'bg-red-50' },
  past_due: { label: 'Past Due', labelFr: 'En retard', color: 'text-red-600', bgColor: 'bg-red-50' },
  sent_not_due: { label: 'Open', labelFr: 'Ouverte', color: 'text-blue-600', bgColor: 'bg-blue-50' },
};

/**
 * Valid status transitions.
 */
export const VALID_TRANSITIONS: Record<string, string[]> = {
  draft: ['sent', 'void'],
  sent: ['paid', 'partial', 'void'],
  partial: ['paid', 'void'],
  paid: [], // terminal
  void: ['draft'], // can revert to draft
};

export function canTransitionTo(currentStatus: string, targetStatus: string): boolean {
  return (VALID_TRANSITIONS[currentStatus] || []).includes(targetStatus);
}
