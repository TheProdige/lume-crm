-- ═══════════════════════════════════════════════════════════════
-- Location Services — GPS Tracking, Geofencing, Proof of Presence
-- ═══════════════════════════════════════════════════════════════

-- ── gps_providers ───────────────────────────────────────────────
-- Stores the active GPS provider configuration per org.
create table if not exists public.gps_providers (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.orgs(id) on delete cascade,
  provider    text not null check (provider in ('traccar', 'life360')),
  active      boolean not null default true,
  config      jsonb not null default '{}',
  -- Traccar: { server_url, api_token, username, password }
  -- Life360: { access_token, refresh_token, circle_id }
  last_sync   timestamptz,
  sync_status text check (sync_status in ('ok', 'error', 'syncing', 'never')),
  error_msg   text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- One active provider per org
create unique index if not exists gps_providers_org_provider_uniq
  on public.gps_providers(org_id, provider);

-- ── technician_locations ────────────────────────────────────────
-- Normalized location data from any GPS provider.
create table if not exists public.technician_locations (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references public.orgs(id) on delete cascade,
  user_id         uuid not null,  -- FK to auth.users / memberships
  provider        text not null,  -- traccar | life360
  external_id     text,           -- device ID in the provider system
  latitude        double precision not null,
  longitude       double precision not null,
  accuracy_m      double precision,  -- GPS accuracy in meters
  speed_kmh       double precision,
  heading         double precision,  -- 0-360
  battery_pct     smallint,          -- 0-100
  altitude_m      double precision,
  address         text,              -- reverse geocoded address
  recorded_at     timestamptz not null,  -- when provider recorded the position
  received_at     timestamptz not null default now(),
  raw_payload     jsonb              -- full provider response for debugging
);

-- Fast lookup: latest position per tech per org
create index if not exists tech_locations_org_user_idx
  on public.technician_locations(org_id, user_id, recorded_at desc);

-- Time-range queries for route history
create index if not exists tech_locations_recorded_idx
  on public.technician_locations(org_id, recorded_at desc);

-- ── technician_device_mappings ──────────────────────────────────
-- Maps GPS provider devices/members to CRM team members.
create table if not exists public.technician_device_mappings (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references public.orgs(id) on delete cascade,
  provider_id     uuid not null references public.gps_providers(id) on delete cascade,
  user_id         uuid not null,
  external_id     text not null,     -- device ID or member ID in provider
  external_name   text,              -- display name from provider
  active          boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create unique index if not exists tech_device_map_uniq
  on public.technician_device_mappings(org_id, provider_id, external_id);

-- ── geofences ───────────────────────────────────────────────────
-- Geofence zones (typically jobsites).
create table if not exists public.geofences (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references public.orgs(id) on delete cascade,
  name            text not null,
  latitude        double precision not null,
  longitude       double precision not null,
  radius_m        int not null default 100,  -- radius in meters
  job_id          uuid,  -- optional link to a job
  active          boolean not null default true,
  created_at      timestamptz not null default now()
);

create index if not exists geofences_org_idx
  on public.geofences(org_id) where active = true;

-- ── proof_of_presence ───────────────────────────────────────────
-- Records when a technician enters/exits a geofence.
create table if not exists public.proof_of_presence (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references public.orgs(id) on delete cascade,
  user_id         uuid not null,
  geofence_id     uuid not null references public.geofences(id) on delete cascade,
  job_id          uuid,
  event_type      text not null check (event_type in ('enter', 'exit')),
  latitude        double precision not null,
  longitude       double precision not null,
  distance_m      double precision not null,  -- distance from geofence center
  recorded_at     timestamptz not null default now()
);

create index if not exists pop_org_user_idx
  on public.proof_of_presence(org_id, user_id, recorded_at desc);

create index if not exists pop_geofence_idx
  on public.proof_of_presence(geofence_id, recorded_at desc);

-- ── RLS ─────────────────────────────────────────────────────────
alter table public.gps_providers enable row level security;
alter table public.technician_locations enable row level security;
alter table public.technician_device_mappings enable row level security;
alter table public.geofences enable row level security;
alter table public.proof_of_presence enable row level security;

-- gps_providers
create policy "gps_providers_org" on public.gps_providers
  for all using (org_id in (
    select org_id from public.memberships where user_id = auth.uid()
  ));

-- technician_locations
create policy "tech_locations_org" on public.technician_locations
  for all using (org_id in (
    select org_id from public.memberships where user_id = auth.uid()
  ));

-- technician_device_mappings
create policy "tech_device_map_org" on public.technician_device_mappings
  for all using (org_id in (
    select org_id from public.memberships where user_id = auth.uid()
  ));

-- geofences
create policy "geofences_org" on public.geofences
  for all using (org_id in (
    select org_id from public.memberships where user_id = auth.uid()
  ));

-- proof_of_presence
create policy "pop_org" on public.proof_of_presence
  for all using (org_id in (
    select org_id from public.memberships where user_id = auth.uid()
  ));

-- ── Updated_at triggers ─────────────────────────────────────────
drop trigger if exists gps_providers_updated_at on public.gps_providers;
create trigger gps_providers_updated_at
  before update on public.gps_providers
  for each row execute function public.set_updated_at();

drop trigger if exists tech_device_map_updated_at on public.technician_device_mappings;
create trigger tech_device_map_updated_at
  before update on public.technician_device_mappings
  for each row execute function public.set_updated_at();
