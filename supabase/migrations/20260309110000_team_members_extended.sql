-- Extend team_members table with address, labour cost, schedule, permissions, and communication preferences
-- Safe: uses ADD COLUMN IF NOT EXISTS pattern

alter table public.team_members
  add column if not exists avatar_url text default null,
  add column if not exists street1 text not null default '',
  add column if not exists street2 text not null default '',
  add column if not exists city text not null default '',
  add column if not exists province text not null default '',
  add column if not exists postal_code text not null default '',
  add column if not exists country text not null default '',
  add column if not exists labour_cost_hourly numeric(10,2) default null,
  add column if not exists working_hours jsonb not null default '{
    "sunday":    {"active": false, "start": "08:00", "end": "17:00"},
    "monday":    {"active": true,  "start": "08:00", "end": "17:00"},
    "tuesday":   {"active": true,  "start": "08:00", "end": "17:00"},
    "wednesday": {"active": true,  "start": "08:00", "end": "17:00"},
    "thursday":  {"active": true,  "start": "08:00", "end": "17:00"},
    "friday":    {"active": true,  "start": "08:00", "end": "17:00"},
    "saturday":  {"active": false, "start": "08:00", "end": "17:00"}
  }'::jsonb,
  add column if not exists permissions jsonb not null default '{}'::jsonb,
  add column if not exists communication_preferences jsonb not null default '{
    "surveys": true,
    "errors": true,
    "system": true,
    "appointment_reminders": true,
    "invoice_reminders": true
  }'::jsonb;
