// ═══════════════════════════════════════════════════════════════════════════
// LIA Structured Project Memory
// Persists creative briefs, decisions, prompt history, and learnings
// across sessions via localStorage with structured data.
// ═══════════════════════════════════════════════════════════════════════════

const STORAGE_KEY = 'lia-structured-memory';
const MAX_BRIEFS = 10;
const MAX_DECISIONS = 30;
const MAX_PROMPT_HISTORY = 50;

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ClientBrief {
  id: string;
  createdAt: string;
  updatedAt: string;
  product: string;
  audience: string;
  platform: string;
  goal: string;
  priceRange?: string;
  competitors?: string;
  visualStyle?: string;
  format?: string;
  budget?: string;
  constraints?: string;
  notes?: string;
}

export interface CreativeDecision {
  id: string;
  briefId?: string;
  createdAt: string;
  type: 'angle' | 'emotion' | 'style' | 'template' | 'model' | 'direction' | 'feedback';
  decision: string;
  reasoning?: string;
  validated: boolean; // user confirmed this worked
}

export interface PromptHistoryEntry {
  id: string;
  createdAt: string;
  prompt: string;
  model: string;
  outcome: 'success' | 'failure' | 'unknown';
  downloaded: boolean;
  favorited: boolean;
  notes?: string;
}

export interface CampaignPlan {
  id: string;
  name: string;
  briefId?: string;
  createdAt: string;
  updatedAt: string;
  steps: CampaignStep[];
  status: 'planning' | 'in_progress' | 'completed';
}

export interface CampaignStep {
  id: string;
  title: string;
  templateId: string;
  prompt: string;
  status: 'pending' | 'in_progress' | 'completed' | 'skipped';
  generationId?: string;
  outputUrl?: string;
  completedAt?: string;
  notes?: string;
}

export interface LiaMemory {
  briefs: ClientBrief[];
  decisions: CreativeDecision[];
  promptHistory: PromptHistoryEntry[];
  campaigns: CampaignPlan[];
  preferences: Record<string, string>;
}

// ─── Load / Save ─────────────────────────────────────────────────────────────

function loadMemory(): LiaMemory {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* corrupt data */ }
  return { briefs: [], decisions: [], promptHistory: [], campaigns: [], preferences: {} };
}

function saveMemory(mem: LiaMemory): void {
  // Trim to limits
  mem.briefs = mem.briefs.slice(-MAX_BRIEFS);
  mem.decisions = mem.decisions.slice(-MAX_DECISIONS);
  mem.promptHistory = mem.promptHistory.slice(-MAX_PROMPT_HISTORY);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(mem));
}

// ─── Briefs ─────────────────────────────────────────────────────────────────

export function saveBrief(brief: Omit<ClientBrief, 'id' | 'createdAt' | 'updatedAt'>): ClientBrief {
  const mem = loadMemory();
  const entry: ClientBrief = {
    ...brief,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  mem.briefs.push(entry);
  saveMemory(mem);
  return entry;
}

export function updateBrief(id: string, updates: Partial<ClientBrief>): void {
  const mem = loadMemory();
  const idx = mem.briefs.findIndex((b) => b.id === id);
  if (idx >= 0) {
    mem.briefs[idx] = { ...mem.briefs[idx], ...updates, updatedAt: new Date().toISOString() };
    saveMemory(mem);
  }
}

export function getBriefs(): ClientBrief[] {
  return loadMemory().briefs;
}

export function getLatestBrief(): ClientBrief | null {
  const briefs = loadMemory().briefs;
  return briefs.length > 0 ? briefs[briefs.length - 1] : null;
}

// ─── Decisions ──────────────────────────────────────────────────────────────

export function saveDecision(decision: Omit<CreativeDecision, 'id' | 'createdAt'>): void {
  const mem = loadMemory();
  mem.decisions.push({
    ...decision,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  });
  saveMemory(mem);
}

export function getDecisions(briefId?: string): CreativeDecision[] {
  const mem = loadMemory();
  return briefId ? mem.decisions.filter((d) => d.briefId === briefId) : mem.decisions;
}

export function getValidatedDecisions(): CreativeDecision[] {
  return loadMemory().decisions.filter((d) => d.validated);
}

// ─── Prompt History ─────────────────────────────────────────────────────────

export function savePromptResult(entry: Omit<PromptHistoryEntry, 'id' | 'createdAt'>): void {
  const mem = loadMemory();
  mem.promptHistory.push({
    ...entry,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  });
  saveMemory(mem);
}

export function getPromptHistory(): PromptHistoryEntry[] {
  return loadMemory().promptHistory;
}

export function getSuccessfulPrompts(): PromptHistoryEntry[] {
  return loadMemory().promptHistory.filter((p) => p.outcome === 'success' || p.downloaded || p.favorited);
}

// ─── Campaigns ──────────────────────────────────────────────────────────────

export function saveCampaign(campaign: Omit<CampaignPlan, 'id' | 'createdAt' | 'updatedAt'>): CampaignPlan {
  const mem = loadMemory();
  const entry: CampaignPlan = {
    ...campaign,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  mem.campaigns.push(entry);
  saveMemory(mem);
  return entry;
}

export function updateCampaign(id: string, updates: Partial<CampaignPlan>): void {
  const mem = loadMemory();
  const idx = mem.campaigns.findIndex((c) => c.id === id);
  if (idx >= 0) {
    mem.campaigns[idx] = { ...mem.campaigns[idx], ...updates, updatedAt: new Date().toISOString() };
    saveMemory(mem);
  }
}

export function updateCampaignStep(campaignId: string, stepId: string, updates: Partial<CampaignStep>): void {
  const mem = loadMemory();
  const campaign = mem.campaigns.find((c) => c.id === campaignId);
  if (campaign) {
    const stepIdx = campaign.steps.findIndex((s) => s.id === stepId);
    if (stepIdx >= 0) {
      campaign.steps[stepIdx] = { ...campaign.steps[stepIdx], ...updates };
      campaign.updatedAt = new Date().toISOString();
      // Auto-update campaign status
      const allDone = campaign.steps.every((s) => s.status === 'completed' || s.status === 'skipped');
      const anyProgress = campaign.steps.some((s) => s.status === 'in_progress' || s.status === 'completed');
      if (allDone) campaign.status = 'completed';
      else if (anyProgress) campaign.status = 'in_progress';
      saveMemory(mem);
    }
  }
}

export function getCampaigns(): CampaignPlan[] {
  return loadMemory().campaigns;
}

export function getActiveCampaigns(): CampaignPlan[] {
  return loadMemory().campaigns.filter((c) => c.status !== 'completed');
}

export function deleteCampaign(id: string): void {
  const mem = loadMemory();
  mem.campaigns = mem.campaigns.filter((c) => c.id !== id);
  saveMemory(mem);
}

// ─── Preferences ────────────────────────────────────────────────────────────

export function setPreference(key: string, value: string): void {
  const mem = loadMemory();
  mem.preferences[key] = value;
  saveMemory(mem);
}

export function getPreference(key: string): string | null {
  return loadMemory().preferences[key] || null;
}

// ─── Prompt Library ─────────────────────────────────────────────────────────

export interface SavedPrompt {
  id: string;
  title: string;
  prompt: string;
  negativePrompt?: string;
  model?: string;
  aspectRatio?: string;
  tags: string[];
  createdAt: string;
}

const PROMPT_LIBRARY_KEY = 'lia-prompt-library';

export function getSavedPrompts(): SavedPrompt[] {
  try { return JSON.parse(localStorage.getItem(PROMPT_LIBRARY_KEY) || '[]'); } catch { return []; }
}

export function savePrompt(prompt: Omit<SavedPrompt, 'id' | 'createdAt'>): SavedPrompt {
  const prompts = getSavedPrompts();
  const entry: SavedPrompt = { ...prompt, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
  prompts.unshift(entry);
  localStorage.setItem(PROMPT_LIBRARY_KEY, JSON.stringify(prompts.slice(0, 100)));
  return entry;
}

export function deleteSavedPrompt(id: string): void {
  const prompts = getSavedPrompts().filter((p) => p.id !== id);
  localStorage.setItem(PROMPT_LIBRARY_KEY, JSON.stringify(prompts));
}

// ─── Build Memory Block for System Prompt ────────────────────────────────────

export function buildMemoryBlock(): string {
  const mem = loadMemory();
  const lines: string[] = [];

  // Latest brief
  const latestBrief = mem.briefs[mem.briefs.length - 1];
  if (latestBrief) {
    lines.push('=== CURRENT PROJECT BRIEF ===');
    lines.push(`Product: ${latestBrief.product}`);
    lines.push(`Audience: ${latestBrief.audience}`);
    lines.push(`Platform: ${latestBrief.platform}`);
    lines.push(`Goal: ${latestBrief.goal}`);
    if (latestBrief.priceRange) lines.push(`Price range: ${latestBrief.priceRange}`);
    if (latestBrief.visualStyle) lines.push(`Visual style: ${latestBrief.visualStyle}`);
    if (latestBrief.format) lines.push(`Format: ${latestBrief.format}`);
    if (latestBrief.constraints) lines.push(`Constraints: ${latestBrief.constraints}`);
    if (latestBrief.notes) lines.push(`Notes: ${latestBrief.notes}`);
  }

  // Validated decisions
  const validated = mem.decisions.filter((d) => d.validated).slice(-10);
  if (validated.length > 0) {
    lines.push('\n=== VALIDATED CREATIVE DECISIONS ===');
    lines.push('These decisions were confirmed by the user as effective:');
    for (const d of validated) {
      lines.push(`  - [${d.type}] ${d.decision}${d.reasoning ? ` (reason: ${d.reasoning})` : ''}`);
    }
  }

  // Successful prompts
  const winners = mem.promptHistory.filter((p) => p.downloaded || p.favorited).slice(-5);
  if (winners.length > 0) {
    lines.push('\n=== WINNING PROMPTS (downloaded/favorited) ===');
    for (const p of winners) {
      lines.push(`  - [${p.model}] "${p.prompt.slice(0, 120)}${p.prompt.length > 120 ? '...' : ''}"`);
    }
    lines.push('Build on these patterns. They represent what the user likes.');
  }

  // Failed prompts (to avoid)
  const failures = mem.promptHistory.filter((p) => p.outcome === 'failure').slice(-3);
  if (failures.length > 0) {
    lines.push('\n=== PROMPTS THAT FAILED (avoid similar patterns) ===');
    for (const p of failures) {
      lines.push(`  - [${p.model}] "${p.prompt.slice(0, 80)}..."${p.notes ? ` Note: ${p.notes}` : ''}`);
    }
  }

  // Active campaigns
  const active = mem.campaigns.filter((c) => c.status !== 'completed');
  if (active.length > 0) {
    lines.push('\n=== ACTIVE CAMPAIGNS ===');
    for (const c of active) {
      const done = c.steps.filter((s) => s.status === 'completed').length;
      lines.push(`  - "${c.name}" (${done}/${c.steps.length} steps done)`);
      for (const s of c.steps) {
        const icon = s.status === 'completed' ? '[done]' : s.status === 'in_progress' ? '[doing]' : '[todo]';
        lines.push(`    ${icon} ${s.title}`);
      }
    }
  }

  // Preferences
  if (Object.keys(mem.preferences).length > 0) {
    lines.push('\n=== USER PREFERENCES ===');
    for (const [k, v] of Object.entries(mem.preferences)) {
      lines.push(`  - ${k}: ${v}`);
    }
  }

  return lines.length > 0 ? lines.join('\n') : '';
}
