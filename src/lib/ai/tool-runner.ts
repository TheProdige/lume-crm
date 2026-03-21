/* ═══════════════════════════════════════════════════════════════
   AI Tool Runner
   Executes tools with permission checks, logging, and error handling.
   ═══════════════════════════════════════════════════════════════ */

import { toolRegistry } from './tool-registry';
import type { ToolContext, ToolResult, ToolCallRecord } from './types';
import { supabase } from '../supabase';

/**
 * Execute a tool by ID with full permission checking and logging.
 */
export async function runTool(
  toolId: string,
  params: Record<string, unknown>,
  ctx: ToolContext
): Promise<{ result: ToolResult; record: ToolCallRecord }> {
  const startTime = Date.now();

  const tool = toolRegistry.get(toolId);
  if (!tool) {
    const result: ToolResult = { success: false, error: `Unknown tool: ${toolId}` };
    const record = buildRecord(toolId, 'read', params, result, 0, ctx);
    return { result, record };
  }

  // Permission check
  if (!toolRegistry.canUse(toolId, ctx.permissions)) {
    const result: ToolResult = {
      success: false,
      error: `Permission denied for tool: ${toolId}`,
    };
    const record = buildRecord(toolId, tool.category, params, result, 0, ctx);
    await logToolCall(record);
    return { result, record };
  }

  // Execute
  let result: ToolResult;
  try {
    result = await tool.execute(params, ctx);
  } catch (err) {
    result = {
      success: false,
      error: err instanceof Error ? err.message : 'Tool execution failed',
    };
  }

  const durationMs = Date.now() - startTime;
  const record = buildRecord(toolId, tool.category, params, result, durationMs, ctx);

  // Log to DB (fire-and-forget)
  void logToolCall(record);

  return { result, record };
}

function buildRecord(
  toolId: string,
  category: string,
  params: Record<string, unknown>,
  result: ToolResult,
  durationMs: number,
  ctx: ToolContext
): ToolCallRecord {
  return {
    org_id: ctx.orgId,
    conversation_id: ctx.conversationId,
    message_id: null,
    tool_id: toolId,
    tool_category: category as ToolCallRecord['tool_category'],
    parameters: params,
    result_success: result.success,
    result_data: result.data ?? null,
    result_error: result.error ?? null,
    duration_ms: durationMs,
    created_by: ctx.userId,
  };
}

async function logToolCall(record: ToolCallRecord): Promise<void> {
  try {
    await supabase.from('ai_tool_calls').insert({
      org_id: record.org_id,
      conversation_id: record.conversation_id,
      message_id: record.message_id,
      tool_id: record.tool_id,
      tool_category: record.tool_category,
      parameters: record.parameters,
      result_success: record.result_success,
      result_data: record.result_data,
      result_error: record.result_error,
      duration_ms: record.duration_ms,
      created_by: record.created_by,
    });
  } catch {
    // Silent — tool logging should never break the chat
  }
}
