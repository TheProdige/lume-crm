-- Company settings table for storing business details used in invoices, quotes, and emails
create table if not exists public.company_settings (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.orgs(id) on delete cascade,
  created_by uuid references auth.users(id),
  company_name text not null default '',
  phone text not null default '',
  website text not null default '',
  email text not null default '',
  street1 text not null default '',
  street2 text not null default '',
  city text not null default '',
  province text not null default '',
  postal_code text not null default '',
  country text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- RLS policies
alter table public.company_settings enable row level security;

create policy "Users can view company settings for their org"
  on public.company_settings for select
  using (
    org_id in (
      select org_id from public.memberships where user_id = auth.uid()
    )
    or created_by = auth.uid()
    or org_id is null
  );

create policy "Users can insert company settings"
  on public.company_settings for insert
  with check (auth.uid() is not null);

create policy "Users can update company settings"
  on public.company_settings for update
  using (
    org_id in (
      select org_id from public.memberships where user_id = auth.uid()
    )
    or created_by = auth.uid()
    or org_id is null
  );
