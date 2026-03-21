/* ═══════════════════════════════════════════════════════════════
   AI Module — Public API
   ═══════════════════════════════════════════════════════════════ */

export { orchestrate } from './orchestrator';
export { toolRegistry } from './tool-registry';
export { registerAllTools } from './tools';
export { buildSystemPrompt } from './system-prompt';
export { buildCRMContextBlock, parseRouteEntity, fetchDashboardContext } from './context-builder';
export { buildMessageArray, trimHistory, estimateTokens } from './memory';
export { runTool } from './tool-runner';

// Types
export type {
  AIChatMode,
  ToolDefinition,
  ToolParameter,
  ToolCategory,
  ToolContext,
  ToolResult,
  ToolCallRecord,
  CRMContext,
  OrchestratorRequest,
  OrchestratorResponse,
  StreamCallbacks,
  SystemPromptParts,
} from './types';
