/**
 * Centralized stage/status mapping for leads and pipeline deals.
 * Single source of truth — replaces duplicated maps in pipelineApi, leadsApi, and server/routes/leads.
 */

// ── DB slugs (what the database stores) ──
export const STAGE_SLUGS = ['new', 'follow_up_1', 'follow_up_2', 'follow_up_3', 'closed', 'lost'] as const;
export type StageSlug = (typeof STAGE_SLUGS)[number];

// ── Display labels ──
export const STAGE_LABELS = ['New', 'Follow-up 1', 'Follow-up 2', 'Follow-up 3', 'Closed', 'Lost'] as const;
export type StageLabel = (typeof STAGE_LABELS)[number];

// ── Slug → Label ──
export const SLUG_TO_LABEL: Record<string, StageLabel> = {
  new: 'New',
  follow_up_1: 'Follow-up 1',
  follow_up_2: 'Follow-up 2',
  follow_up_3: 'Follow-up 3',
  closed: 'Closed',
  lost: 'Lost',
};

// ── Label → Slug ──
export const LABEL_TO_SLUG: Record<string, StageSlug> = {
  'New': 'new',
  'Follow-up 1': 'follow_up_1',
  'Follow-up 2': 'follow_up_2',
  'Follow-up 3': 'follow_up_3',
  'Closed': 'closed',
  'Lost': 'lost',
};

// ── Legacy value aliases → canonical slug ──
const LEGACY_ALIASES: Record<string, StageSlug> = {
  contacted: 'follow_up_1',
  contact: 'follow_up_1',
  estimate_sent: 'follow_up_2',
  quote_sent: 'follow_up_2',
  follow_up: 'follow_up_1',
  won: 'closed',
  qualified: 'new',
  archived: 'lost',
  lead: 'new',
  proposal: 'follow_up_1',
  negotiation: 'follow_up_2',
};

/** Convert any stage/status string (display label, legacy, or slug) to canonical DB slug */
export function toSlug(value: string | null | undefined): StageSlug {
  if (!value) return 'new';
  const raw = value.trim().toLowerCase().replace(/[\s-]+/g, '_');
  // Direct slug match
  if (SLUG_TO_LABEL[raw]) return raw as StageSlug;
  // Label match
  const fromLabel = LABEL_TO_SLUG[value.trim()];
  if (fromLabel) return fromLabel;
  // Legacy alias
  const fromLegacy = LEGACY_ALIASES[raw];
  if (fromLegacy) return fromLegacy;
  return 'new';
}

/** Convert any stage/status string to display label */
export function toLabel(value: string | null | undefined): StageLabel {
  return SLUG_TO_LABEL[toSlug(value)] || 'New';
}

/** Check if a value is a valid stage slug */
export function isValidSlug(value: string): value is StageSlug {
  return (STAGE_SLUGS as readonly string[]).includes(value);
}
