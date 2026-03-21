-- ═══════════════════════════════════════════════════════════════
-- Workflow Presets & Draft/Published Support
-- ═══════════════════════════════════════════════════════════════

-- Add status column to workflows (draft / published / paused)
alter table public.workflows add column if not exists status text not null default 'draft' check (status in ('draft', 'published', 'paused'));
alter table public.workflows add column if not exists preset_id text;       -- which preset it was cloned from
alter table public.workflows add column if not exists category text;        -- e.g. 'lead', 'estimate', 'invoice', 'job', 'review', 'field'
alter table public.workflows add column if not exists icon text;            -- lucide icon name
alter table public.workflows add column if not exists version integer not null default 1;

-- Add delay node type to workflow_nodes
alter table public.workflow_nodes drop constraint if exists workflow_nodes_node_type_check;
alter table public.workflow_nodes add constraint workflow_nodes_node_type_check check (node_type in ('trigger', 'condition', 'action', 'delay'));

-- Index for preset lookups
create index if not exists workflows_preset_idx on public.workflows(org_id, preset_id);
