/* ═══════════════════════════════════════════════════════════════
   Automation Engine — Event-driven rule executor.
   Listens to CRM events via the event bus, matches automation
   rules, schedules or executes actions.
   ═══════════════════════════════════════════════════════════════ */

import { SupabaseClient } from '@supabase/supabase-js';
import { eventBus, CRMEvent, CRMEventType } from './eventBus';
import {
  ActionContext,
  ActionType,
  executeAction,
  resolveEntityVariables,
} from './actions';

interface AutomationRule {
  id: string;
  org_id: string;
  name: string;
  trigger_event: string;
  conditions: Record<string, any>;
  delay_seconds: number;
  actions: Array<{ type: ActionType; config: Record<string, any> }>;
  is_active: boolean;
}

interface EngineConfig {
  supabase: SupabaseClient;
  twilio: { client: any; phoneNumber: string } | null;
  resendApiKey: string;
  baseUrl: string;
}

let engineConfig: EngineConfig | null = null;

// ── Condition evaluator ─────────────────────────────────────

function evaluateConditions(
  conditions: Record<string, any>,
  event: CRMEvent,
): boolean {
  if (!conditions || Object.keys(conditions).length === 0) return true;

  // Simple condition matching against event metadata
  for (const [key, expected] of Object.entries(conditions)) {
    const actual = event.metadata[key];

    // Support operators
    if (typeof expected === 'object' && expected !== null && !Array.isArray(expected)) {
      if ('eq' in expected && actual !== expected.eq) return false;
      if ('neq' in expected && actual === expected.neq) return false;
      if ('in' in expected && Array.isArray(expected.in) && !expected.in.includes(actual)) return false;
      if ('not_in' in expected && Array.isArray(expected.not_in) && expected.not_in.includes(actual)) return false;
    } else {
      // Direct equality
      if (actual !== expected) return false;
    }
  }
  return true;
}

// ── Deduplication key builder ───────────────────────────────

function buildExecutionKey(ruleId: string, entityId: string, actionIndex: number): string {
  const today = new Date().toISOString().slice(0, 10);
  return `${ruleId}:${entityId}:${actionIndex}:${today}`;
}

// ── Execute actions for a rule ──────────────────────────────

async function executeRuleActions(
  rule: AutomationRule,
  event: CRMEvent,
  config: EngineConfig,
) {
  const vars = await resolveEntityVariables(
    config.supabase,
    event.orgId,
    event.entityType,
    event.entityId,
  );

  const ctx: ActionContext = {
    supabase: config.supabase,
    orgId: event.orgId,
    entityType: event.entityType,
    entityId: event.entityId,
    twilio: config.twilio,
    resendApiKey: config.resendApiKey,
    baseUrl: config.baseUrl,
  };

  for (let i = 0; i < rule.actions.length; i++) {
    const action = rule.actions[i];
    const executionKey = buildExecutionKey(rule.id, event.entityId, i);
    const startTime = Date.now();

    try {
      const result = await executeAction(action.type, action.config, vars, ctx);
      const durationMs = Date.now() - startTime;

      // Log execution
      await config.supabase.from('automation_execution_logs').insert({
        org_id: event.orgId,
        automation_rule_id: rule.id,
        trigger_event: event.type,
        entity_type: event.entityType,
        entity_id: event.entityId,
        action_type: action.type,
        action_config: action.config,
        result_success: result.success,
        result_data: result.data || null,
        result_error: result.error || null,
        duration_ms: durationMs,
      });

      if (!result.success) {
        console.error(`[automationEngine] action ${action.type} failed for rule "${rule.name}":`, result.error);
      }
    } catch (err: any) {
      const durationMs = Date.now() - startTime;
      console.error(`[automationEngine] action ${action.type} threw for rule "${rule.name}":`, err.message);

      await config.supabase.from('automation_execution_logs').insert({
        org_id: event.orgId,
        automation_rule_id: rule.id,
        trigger_event: event.type,
        entity_type: event.entityType,
        entity_id: event.entityId,
        action_type: action.type,
        action_config: action.config,
        result_success: false,
        result_error: err.message,
        duration_ms: durationMs,
      });
    }
  }
}

// ── Resolve execution time ──────────────────────────────────

async function resolveExecuteAt(
  rule: AutomationRule,
  event: CRMEvent,
  config: EngineConfig,
): Promise<Date> {
  // Negative delay = "X seconds before the event's reference time"
  // Used for appointment reminders (e.g., -86400 = 1 day before start_time)
  if (rule.delay_seconds < 0 && (event.entityType === 'schedule_event' || event.entityType === 'appointment')) {
    const { data: evt } = await config.supabase
      .from('schedule_events')
      .select('start_at, start_time')
      .eq('id', event.entityId)
      .maybeSingle();

    const startField = evt?.start_at || evt?.start_time;
    if (startField) {
      const eventTime = new Date(startField).getTime();
      const executeAt = new Date(eventTime + rule.delay_seconds * 1000);
      // If the calculated time is already past, execute immediately
      if (executeAt.getTime() <= Date.now()) {
        return new Date(Date.now() + 5000); // 5s from now
      }
      return executeAt;
    }
  }

  // Normal positive delay from now
  return new Date(Date.now() + Math.abs(rule.delay_seconds) * 1000);
}

// ── Schedule delayed actions ────────────────────────────────

async function scheduleDelayedActions(
  rule: AutomationRule,
  event: CRMEvent,
  config: EngineConfig,
) {
  const executeAt = await resolveExecuteAt(rule, event, config);

  for (let i = 0; i < rule.actions.length; i++) {
    const action = rule.actions[i];
    const executionKey = buildExecutionKey(rule.id, event.entityId, i);

    try {
      await config.supabase.from('automation_scheduled_tasks').insert({
        org_id: event.orgId,
        automation_rule_id: rule.id,
        entity_type: event.entityType,
        entity_id: event.entityId,
        action_config: { ...action, trigger_event: event.type, event_metadata: event.metadata },
        execute_at: executeAt.toISOString(),
        status: 'pending',
        execution_key: executionKey,
      });
    } catch (err: any) {
      // Unique constraint violation = duplicate, skip
      if (err?.code === '23505') {
        console.log(`[automationEngine] skipped duplicate scheduled task: ${executionKey}`);
      } else {
        console.error(`[automationEngine] failed to schedule task:`, err.message);
      }
    }
  }
}

// ── Event handler ───────────────────────────────────────────

async function handleEvent(event: CRMEvent) {
  if (!engineConfig) return;

  try {
    // Find matching active rules for this event type and org
    const { data: rules, error } = await engineConfig.supabase
      .from('automation_rules')
      .select('*')
      .eq('org_id', event.orgId)
      .eq('trigger_event', event.type)
      .eq('is_active', true);

    if (error) {
      console.error('[automationEngine] failed to fetch rules:', error.message);
      return;
    }
    if (!rules || rules.length === 0) return;

    for (const rule of rules as AutomationRule[]) {
      // Evaluate conditions
      if (!evaluateConditions(rule.conditions, event)) continue;

      // Execute or schedule
      if (rule.delay_seconds !== 0) {
        await scheduleDelayedActions(rule, event, engineConfig);
      } else {
        await executeRuleActions(rule, event, engineConfig);
      }
    }
  } catch (err: any) {
    console.error('[automationEngine] error handling event:', err.message);
  }
}

// ── Scheduled task processor (called by scheduler) ──────────

export async function processScheduledTasks(supabase: SupabaseClient) {
  if (!engineConfig) return;

  const now = new Date().toISOString();

  // Fetch pending tasks that are ready
  const { data: tasks, error } = await supabase
    .from('automation_scheduled_tasks')
    .select('*, automation_rules(name, actions, conditions)')
    .eq('status', 'pending')
    .lte('execute_at', now)
    .order('execute_at', { ascending: true })
    .limit(50);

  if (error) {
    console.error('[automationEngine] failed to fetch scheduled tasks:', error.message);
    return;
  }
  if (!tasks || tasks.length === 0) return;

  for (const task of tasks as any[]) {
    // Mark as running
    await supabase
      .from('automation_scheduled_tasks')
      .update({ status: 'running', attempts: task.attempts + 1 })
      .eq('id', task.id);

    try {
      const actionConfig = task.action_config;
      const actionType = actionConfig.type as ActionType;
      const config = actionConfig.config || {};

      // Check stop conditions before executing
      const shouldStop = await checkStopConditions(
        supabase,
        task.entity_type,
        task.entity_id,
        actionConfig.trigger_event,
      );

      if (shouldStop) {
        await supabase
          .from('automation_scheduled_tasks')
          .update({ status: 'cancelled', completed_at: now })
          .eq('id', task.id);
        continue;
      }

      const vars = await resolveEntityVariables(
        supabase,
        task.org_id,
        task.entity_type,
        task.entity_id,
      );

      const ctx: ActionContext = {
        supabase,
        orgId: task.org_id,
        entityType: task.entity_type,
        entityId: task.entity_id,
        twilio: engineConfig.twilio,
        resendApiKey: engineConfig.resendApiKey,
        baseUrl: engineConfig.baseUrl,
      };

      const startTime = Date.now();
      const result = await executeAction(actionType, config, vars, ctx);
      const durationMs = Date.now() - startTime;

      // Log execution
      await supabase.from('automation_execution_logs').insert({
        org_id: task.org_id,
        automation_rule_id: task.automation_rule_id,
        scheduled_task_id: task.id,
        trigger_event: actionConfig.trigger_event || 'scheduled',
        entity_type: task.entity_type,
        entity_id: task.entity_id,
        action_type: actionType,
        action_config: config,
        result_success: result.success,
        result_data: result.data || null,
        result_error: result.error || null,
        duration_ms: durationMs,
      });

      // Update task status
      await supabase
        .from('automation_scheduled_tasks')
        .update({
          status: result.success ? 'completed' : 'failed',
          completed_at: new Date().toISOString(),
          last_error: result.error || null,
        })
        .eq('id', task.id);
    } catch (err: any) {
      console.error(`[automationEngine] scheduled task ${task.id} failed:`, err.message);
      await supabase
        .from('automation_scheduled_tasks')
        .update({
          status: 'failed',
          completed_at: new Date().toISOString(),
          last_error: err.message,
        })
        .eq('id', task.id);
    }
  }
}

// ── Stop condition checker ──────────────────────────────────

async function checkStopConditions(
  supabase: SupabaseClient,
  entityType: string,
  entityId: string,
  triggerEvent?: string,
): Promise<boolean> {
  // Invoice reminders: stop if paid, cancelled, disputed, or client archived
  if (entityType === 'invoice') {
    const { data: inv } = await supabase
      .from('invoices')
      .select('status, client_id, clients(deleted_at)')
      .eq('id', entityId)
      .maybeSingle() as any;

    if (!inv) return true; // Invoice deleted
    if (['paid', 'cancelled', 'void'].includes(inv.status)) return true;
    if (inv.clients?.deleted_at) return true; // Client archived/deleted
  }

  // Estimate follow-ups: stop if accepted, rejected, or lead archived
  if (entityType === 'invoice' && triggerEvent === 'estimate.sent') {
    const { data: inv } = await supabase
      .from('invoices')
      .select('status')
      .eq('id', entityId)
      .maybeSingle();

    if (!inv) return true;
    if (['paid', 'accepted', 'rejected', 'cancelled', 'void'].includes(inv.status)) return true;
  }

  // Appointment reminders: stop if cancelled
  if (entityType === 'schedule_event' || entityType === 'appointment') {
    const { data: evt } = await supabase
      .from('schedule_events')
      .select('status, deleted_at')
      .eq('id', entityId)
      .maybeSingle();

    if (!evt) return true;
    if (evt.deleted_at) return true;
    if (evt.status === 'cancelled') return true;
  }

  // Lead: stop if archived or deleted
  if (entityType === 'lead') {
    const { data: lead } = await supabase
      .from('leads')
      .select('status, deleted_at')
      .eq('id', entityId)
      .maybeSingle();

    if (!lead) return true;
    if (lead.deleted_at) return true;
    if (lead.status === 'lost') return true;
  }

  return false;
}

// ── Public API ──────────────────────────────────────────────

export function initAutomationEngine(config: EngineConfig) {
  engineConfig = config;

  // Initialize event bus with supabase
  eventBus.init(config.supabase);

  // Listen to all events
  eventBus.onAnyEvent(handleEvent);

  console.log('[automationEngine] initialized and listening for events');
}
