-- Add structured address fields to clients table for Google Places integration
alter table public.clients
  add column if not exists street_number text null,
  add column if not exists street_name   text null,
  add column if not exists city          text null,
  add column if not exists province      text null,
  add column if not exists postal_code   text null,
  add column if not exists country       text null,
  add column if not exists latitude      numeric null,
  add column if not exists longitude     numeric null,
  add column if not exists place_id      text null;

-- Index on place_id for fast duplicate-address lookups
create index if not exists idx_clients_org_place_id
  on public.clients (org_id, place_id)
  where place_id is not null and deleted_at is null;

-- Recreate the clients_active view to include the new columns
create or replace view public.clients_active as
  select * from public.clients where deleted_at is null;
