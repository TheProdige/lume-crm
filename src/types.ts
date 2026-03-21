/** DB-aligned lead status slugs */
export type LeadStatus = 'new' | 'follow_up_1' | 'follow_up_2' | 'follow_up_3' | 'closed' | 'lost';

export interface Lead {
  id: string;
  org_id?: string;
  created_by?: string;
  created_at: string;
  updated_at?: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  address?: string | null;
  company?: string;
  title?: string;
  source?: string;
  value?: number;
  status: LeadStatus | string;
  stage?: string | null;
  tags?: string[];
  user_id?: string;
  assigned_to?: string | null;
  notes?: string | null;
  client_id?: string | null;
  converted_to_client_id?: string | null;
  converted_job_id?: string | null;
  converted_at?: string | null;
  deleted_at?: string | null;
  schedule?: Record<string, any> | null;
  assigned_team?: string | null;
  line_items?: Array<Record<string, any>> | null;
  description?: string | null;
}

export interface Task {
  id: string;
  created_at: string;
  title: string;
  description?: string;
  due_date: string;
  completed: boolean;
  lead_id?: string;
  user_id: string;
}

export interface Profile {
  id: string;
  full_name: string;
  avatar_url?: string;
  company_name?: string;
}

/** DB-aligned job status values */
export type JobDbStatus = 'draft' | 'scheduled' | 'in_progress' | 'completed' | 'cancelled';

/** Display-only status labels (derived from DB status + business rules) */
export type JobStatus =
  | 'Draft'
  | 'Scheduled'
  | 'In Progress'
  | 'Completed'
  | 'Cancelled'
  | 'Late'
  | 'Unscheduled'
  | 'Requires Invoicing'
  | 'Action Required'
  | 'Ending within 30 days';

export interface Job {
  id: string;
  org_id: string;
  created_by?: string;
  lead_id?: string | null;
  job_number: string;
  title: string;
  description?: string | null;
  client_id?: string | null;
  team_id?: string | null;
  client_name?: string | null;
  address?: string | null;
  property_address?: string | null;
  scheduled_at?: string | null;
  start_at?: string | null;
  end_at?: string | null;
  status: JobStatus | string;
  total_cents: number;
  total_amount?: number;
  currency: string;
  subtotal?: number;
  tax_total?: number;
  total?: number;
  tax_lines?: Array<{ code: string; label: string; rate: number; enabled: boolean }>;
  job_type?: string | null;
  salesperson_id?: string | null;
  requires_invoicing?: boolean;
  billing_split?: boolean;
  notes?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  geocode_status?: 'ok' | 'failed' | 'pending' | string | null;
  geocoded_at?: string | null;
  invoice_url?: string | null;
  attachments?: Array<{ name: string; url: string }> | null;
  completed_at?: string | null;
  closed_at?: string | null;
  deleted_at?: string | null;
  created_at: string;
  updated_at: string;
}

export type PaymentProvider = 'stripe' | 'paypal' | 'manual';

export type PaymentStatus = 'succeeded' | 'pending' | 'failed' | 'refunded';

export type PaymentMethod = 'card' | 'e-transfer' | 'cash' | 'check';

export interface Payment {
  id: string;
  org_id: string;
  client_id: string | null;
  invoice_id: string | null;
  job_id: string | null;
  provider: PaymentProvider;
  provider_payment_id?: string | null;
  provider_order_id?: string | null;
  provider_event_id?: string | null;
  amount_cents: number;
  currency: string;
  method: PaymentMethod | null;
  status: PaymentStatus;
  payment_date: string;
  payout_date: string | null;
  created_at: string;
  updated_at?: string;
  deleted_at: string | null;
  payment_request_id?: string | null;
  stripe_charge_id?: string | null;
  stripe_transfer_id?: string | null;
  stripe_balance_transaction_id?: string | null;
  application_fee_amount?: number | null;
  stripe_fee_amount?: number | null;
  net_amount?: number | null;
  paid_at?: string | null;
  failure_reason?: string | null;
}

// ── Stripe Connect ──

export type ConnectedAccountType = 'express' | 'standard' | 'custom';

export interface ConnectedAccount {
  id: string;
  org_id: string;
  stripe_account_id: string;
  account_type: ConnectedAccountType;
  onboarding_complete: boolean;
  charges_enabled: boolean;
  payouts_enabled: boolean;
  details_submitted: boolean;
  country: string | null;
  default_currency: string;
  created_at: string;
  updated_at: string;
}

// ── Payment Requests ──

export type PaymentRequestStatus = 'pending' | 'sent' | 'paid' | 'expired' | 'cancelled';

export interface PaymentRequest {
  id: string;
  org_id: string;
  invoice_id: string;
  public_token: string;
  amount_cents: number;
  currency: string;
  status: PaymentRequestStatus;
  expires_at: string | null;
  stripe_payment_intent_id: string | null;
  payment_url: string | null;
  created_at: string;
  updated_at: string;
}

// ── Webhook Events ──

export type WebhookEventStatus = 'pending' | 'processed' | 'failed' | 'skipped';

export interface WebhookEvent {
  id: string;
  provider: 'stripe' | 'paypal';
  stripe_event_id: string | null;
  stripe_account_id: string | null;
  event_type: string;
  payload: Record<string, unknown>;
  status: WebhookEventStatus;
  processed_at: string | null;
  error_message: string | null;
  created_at: string;
}
