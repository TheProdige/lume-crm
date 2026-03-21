-- ============================================================
-- MIGRATION: 20260410000000_invoice_enhancements.sql
-- Invoice system enhancements.
-- Idempotent: safe to re-run.
--
-- Real existing schema at time of writing:
--   invoices: id, org_id, created_by, client_id, invoice_number, status,
--             subject, issued_at, due_date, subtotal_cents, tax_cents,
--             total_cents, paid_cents, balance_cents, paid_at, created_at,
--             updated_at, deleted_at, job_id, view_token, is_viewed, ...
--   invoice_items: id, org_id, invoice_id, description, qty,
--                  unit_price_cents, line_total_cents, created_at, deleted_at
--   invoice_templates: id, org_id, name, content, is_default,
--                      created_at, updated_at, deleted_at
-- ============================================================
begin;

-- ══════════════════════════════════════════════════════════════
-- 1. Add missing columns to invoices
-- ══════════════════════════════════════════════════════════════

alter table public.invoices
  add column if not exists notes text default null;

alter table public.invoices
  add column if not exists internal_notes text default null;

alter table public.invoices
  add column if not exists discount_cents integer not null default 0;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'chk_invoices_discount_gte0' and conrelid = 'public.invoices'::regclass
  ) then
    alter table public.invoices
      add constraint chk_invoices_discount_gte0 check (discount_cents >= 0);
  end if;
end $$;

alter table public.invoices
  add column if not exists template_id uuid default null;

alter table public.invoices
  add column if not exists sent_at timestamptz default null;

-- ══════════════════════════════════════════════════════════════
-- 2. Add missing columns to invoice_items
-- ══════════════════════════════════════════════════════════════

alter table public.invoice_items
  add column if not exists sort_order integer not null default 0;

alter table public.invoice_items
  add column if not exists source_type text default null;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'chk_ii_source_type' and conrelid = 'public.invoice_items'::regclass
  ) then
    alter table public.invoice_items
      add constraint chk_ii_source_type
      check (source_type is null or source_type in ('manual','job_line_item','predefined_service','template'));
  end if;
end $$;

alter table public.invoice_items
  add column if not exists source_id uuid default null;

alter table public.invoice_items
  add column if not exists title text default null;

-- ══════════════════════════════════════════════════════════════
-- 3. Upgrade invoice_templates
--    Real table has: id, org_id, name, content, is_default,
--    created_at, updated_at, deleted_at.
--    We add all the missing columns the app needs.
-- ══════════════════════════════════════════════════════════════

-- Make org_id nullable so system templates can have org_id = null
alter table public.invoice_templates
  alter column org_id drop not null;

-- Add all missing columns one by one
alter table public.invoice_templates add column if not exists title text default '';
alter table public.invoice_templates add column if not exists description text default '';
alter table public.invoice_templates add column if not exists line_items jsonb not null default '[]';
alter table public.invoice_templates add column if not exists taxes jsonb not null default '[]';
alter table public.invoice_templates add column if not exists payment_terms text default '';
alter table public.invoice_templates add column if not exists client_note text default '';
alter table public.invoice_templates add column if not exists branding jsonb not null default '{}';
alter table public.invoice_templates add column if not exists payment_methods jsonb not null default '{}';
alter table public.invoice_templates add column if not exists email_subject text default '';
alter table public.invoice_templates add column if not exists email_body text default '';
alter table public.invoice_templates add column if not exists archived_at timestamptz default null;
alter table public.invoice_templates add column if not exists layout_type text not null default 'classic';
alter table public.invoice_templates add column if not exists is_system_template boolean not null default false;
alter table public.invoice_templates add column if not exists slug text default null;
alter table public.invoice_templates add column if not exists created_by uuid default null;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'chk_tpl_layout_type' and conrelid = 'public.invoice_templates'::regclass
  ) then
    alter table public.invoice_templates
      add constraint chk_tpl_layout_type check (layout_type in ('classic','modern','minimal'));
  end if;
end $$;

-- Now that invoice_templates has all columns, add the FK on invoices
do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'fk_invoices_template_id' and conrelid = 'public.invoices'::regclass
  ) then
    alter table public.invoices
      add constraint fk_invoices_template_id
      foreign key (template_id) references public.invoice_templates(id) on delete set null;
  end if;
end $$;

-- Update RLS select policy to also allow system templates (org_id IS NULL)
drop policy if exists invoice_templates_select_org on public.invoice_templates;
create policy invoice_templates_select_org on public.invoice_templates
  for select using (
    public.has_org_membership(auth.uid(), org_id)
    or (org_id is null and is_system_template = true)
  );

-- ══════════════════════════════════════════════════════════════
-- 4. Invoice send events (audit trail)
-- ══════════════════════════════════════════════════════════════

create table if not exists public.invoice_send_events (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  org_id uuid not null,
  event_type text not null default 'sent',
  recipient_email text,
  recipient_phone text,
  channel text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'chk_se_event_type' and conrelid = 'public.invoice_send_events'::regclass
  ) then
    alter table public.invoice_send_events
      add constraint chk_se_event_type
      check (event_type in ('sent','resent','reminder','viewed','bounced'));
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'chk_se_channel' and conrelid = 'public.invoice_send_events'::regclass
  ) then
    alter table public.invoice_send_events
      add constraint chk_se_channel
      check (channel is null or channel in ('email','sms'));
  end if;
end $$;

alter table public.invoice_send_events enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='invoice_send_events' and policyname='ise_select_org') then
    create policy ise_select_org on public.invoice_send_events
      for select using (public.has_org_membership(auth.uid(), org_id));
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='invoice_send_events' and policyname='ise_insert_org') then
    create policy ise_insert_org on public.invoice_send_events
      for insert with check (public.has_org_membership(auth.uid(), org_id));
  end if;
end $$;

create index if not exists idx_ise_invoice on public.invoice_send_events(invoice_id);
create index if not exists idx_ise_org on public.invoice_send_events(org_id);

-- ══════════════════════════════════════════════════════════════
-- 5. Update recalculate_invoice_totals to handle discounts
-- ══════════════════════════════════════════════════════════════

create or replace function public.recalculate_invoice_totals(p_invoice_id uuid)
returns void language plpgsql security definer set search_path = public as $fn$
declare
  v_sub bigint; v_disc bigint; v_tax bigint; v_tot bigint; v_paid bigint;
begin
  select coalesce(sum(line_total_cents),0) into v_sub
  from public.invoice_items where invoice_id = p_invoice_id and deleted_at is null;

  select coalesce(discount_cents,0), coalesce(tax_cents,0), coalesce(paid_cents,0)
    into v_disc, v_tax, v_paid
  from public.invoices where id = p_invoice_id;

  v_disc := least(v_disc, v_sub);
  v_tot  := greatest(0, v_sub - v_disc + v_tax);

  update public.invoices
  set subtotal_cents = v_sub, total_cents = v_tot,
      balance_cents = greatest(0, v_tot - v_paid), updated_at = now()
  where id = p_invoice_id;
end; $fn$;

-- ══════════════════════════════════════════════════════════════
-- 6. Enhanced rpc_save_invoice_draft (drop old, create new)
-- ══════════════════════════════════════════════════════════════

drop function if exists public.rpc_save_invoice_draft(uuid, text, date, integer, jsonb);
drop function if exists public.rpc_save_invoice_draft(uuid, text, date, integer, jsonb, text, text, integer, uuid);

create function public.rpc_save_invoice_draft(
  p_invoice_id uuid,
  p_subject text default null,
  p_due_date date default null,
  p_tax_cents integer default 0,
  p_items jsonb default '[]'::jsonb,
  p_notes text default null,
  p_internal_notes text default null,
  p_discount_cents integer default 0,
  p_template_id uuid default null
) returns jsonb language plpgsql security definer set search_path = public as $fn$
declare
  v_uid uuid := auth.uid();
  v_org uuid;
  v_item jsonb;
  v_sort integer := 0;
begin
  select org_id into v_org from public.invoices
  where id = p_invoice_id and deleted_at is null;
  if v_org is null then raise exception 'Invoice not found.' using errcode='P0002'; end if;
  if not public.has_org_membership(v_uid, v_org) then raise exception 'Forbidden.' using errcode='42501'; end if;

  update public.invoices set
    subject       = coalesce(p_subject, subject),
    due_date      = coalesce(p_due_date, due_date),
    tax_cents     = greatest(0, coalesce(p_tax_cents, 0)),
    notes         = p_notes,
    internal_notes= p_internal_notes,
    discount_cents= greatest(0, coalesce(p_discount_cents, 0)),
    template_id   = p_template_id,
    updated_at    = now()
  where id = p_invoice_id;

  delete from public.invoice_items where invoice_id = p_invoice_id;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_sort := v_sort + 1;
    insert into public.invoice_items (
      org_id, invoice_id, description, title, qty, unit_price_cents,
      sort_order, source_type, source_id
    ) values (
      v_org, p_invoice_id,
      v_item->>'description',
      v_item->>'title',
      greatest(0, (v_item->>'qty')::numeric),
      greatest(0, (v_item->>'unit_price_cents')::integer),
      v_sort,
      nullif(v_item->>'source_type', ''),
      case when (v_item->>'source_id') is not null and (v_item->>'source_id') <> ''
           then (v_item->>'source_id')::uuid else null end
    );
  end loop;

  perform public.recalculate_invoice_totals(p_invoice_id);

  return (select to_jsonb(i.*) from public.invoices i where i.id = p_invoice_id);
end; $fn$;

revoke all on function public.rpc_save_invoice_draft(uuid,text,date,integer,jsonb,text,text,integer,uuid) from public;
grant execute on function public.rpc_save_invoice_draft(uuid,text,date,integer,jsonb,text,text,integer,uuid) to authenticated, service_role;

-- ══════════════════════════════════════════════════════════════
-- 7. Insert system templates
-- ══════════════════════════════════════════════════════════════

insert into public.invoice_templates (
  org_id, name, slug, title, description, layout_type, is_system_template,
  line_items, taxes, branding, payment_terms, client_note,
  payment_methods, email_subject, email_body, is_default
) select
  null, 'Classic', 'classic', 'Classic Invoice',
  'Clean, traditional invoice layout with clear hierarchy.',
  'classic', true,
  '[]'::jsonb, '[]'::jsonb,
  '{"primary_color":"#1a1a2e","accent_color":"#4f46e5","font":"default"}'::jsonb,
  'Net 14', '', '{}'::jsonb,
  'Invoice {invoice_number}',
  E'Hello {client_name},\n\nPlease find your invoice {invoice_number} for {invoice_amount}.\n\nDue: {due_date}\n\nThank you.',
  true
where not exists (select 1 from public.invoice_templates where slug='classic' and is_system_template=true);

insert into public.invoice_templates (
  org_id, name, slug, title, description, layout_type, is_system_template,
  line_items, taxes, branding, payment_terms, client_note,
  payment_methods, email_subject, email_body, is_default
) select
  null, 'Modern', 'modern', 'Modern Invoice',
  'Bold, contemporary design with accent colors.',
  'modern', true,
  '[]'::jsonb, '[]'::jsonb,
  '{"primary_color":"#0f172a","accent_color":"#6366f1","font":"default"}'::jsonb,
  'Net 14', '', '{}'::jsonb,
  'Invoice {invoice_number}',
  E'Hi {client_name},\n\nYour invoice {invoice_number} for {invoice_amount} is ready.\n\nDue: {due_date}\n\nThanks!',
  false
where not exists (select 1 from public.invoice_templates where slug='modern' and is_system_template=true);

insert into public.invoice_templates (
  org_id, name, slug, title, description, layout_type, is_system_template,
  line_items, taxes, branding, payment_terms, client_note,
  payment_methods, email_subject, email_body, is_default
) select
  null, 'Minimal', 'minimal', 'Minimal Invoice',
  'Ultra-clean, whitespace-focused design.',
  'minimal', true,
  '[]'::jsonb, '[]'::jsonb,
  '{"primary_color":"#111827","accent_color":"#059669","font":"default"}'::jsonb,
  'Net 14', '', '{}'::jsonb,
  'Invoice {invoice_number}',
  E'Dear {client_name},\n\nPlease review invoice {invoice_number} ({invoice_amount}).\n\nDue: {due_date}',
  false
where not exists (select 1 from public.invoice_templates where slug='minimal' and is_system_template=true);

-- ══════════════════════════════════════════════════════════════
-- 8. Schema comments
-- ══════════════════════════════════════════════════════════════

comment on table public.invoice_send_events is '[Invoicing] Invoice send/view event audit trail';
comment on column public.invoices.notes is 'Client-visible notes on the invoice';
comment on column public.invoices.internal_notes is 'Internal staff notes (not on invoice)';
comment on column public.invoices.discount_cents is 'Discount in cents (subtracted before tax)';
comment on column public.invoices.template_id is 'Visual template used for rendering';

notify pgrst, 'reload schema';
commit;
