/* ═══════════════════════════════════════════════════════════════
   AI Conversation Memory Manager
   Manages conversation history windowing for context limits.
   ═══════════════════════════════════════════════════════════════ */

/**
 * Trims conversation history to fit within a token budget.
 * Uses a simple heuristic: ~4 chars per token (conservative for English/French).
 *
 * Strategy:
 * 1. Always keep the system message (index 0).
 * 2. Always keep the last N user/assistant exchanges.
 * 3. Trim oldest messages first if over budget.
 */
export function trimHistory(
  messages: { role: string; content: string }[],
  maxTokens: number = 4000
): { role: string; content: string }[] {
  const CHARS_PER_TOKEN = 4;
  const maxChars = maxTokens * CHARS_PER_TOKEN;

  // If it all fits, return as-is
  const totalChars = messages.reduce((sum, m) => sum + m.content.length, 0);
  if (totalChars <= maxChars) return messages;

  // Separate system messages from conversation
  const systemMsgs = messages.filter((m) => m.role === 'system');
  const convMsgs = messages.filter((m) => m.role !== 'system');

  const systemChars = systemMsgs.reduce((sum, m) => sum + m.content.length, 0);
  const remainingBudget = maxChars - systemChars;

  // Take messages from the end (most recent) until budget is full
  const trimmed: { role: string; content: string }[] = [];
  let usedChars = 0;

  for (let i = convMsgs.length - 1; i >= 0; i--) {
    const msgChars = convMsgs[i].content.length;
    if (usedChars + msgChars > remainingBudget) break;
    trimmed.unshift(convMsgs[i]);
    usedChars += msgChars;
  }

  return [...systemMsgs, ...trimmed];
}

/**
 * Estimate token count from text (rough heuristic).
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Build the message array for Ollama from orchestrator context.
 * Prepends the system prompt, appends conversation history, then the user message.
 */
export function buildMessageArray(
  systemPrompt: string,
  history: { role: string; content: string }[],
  userMessage: string
): { role: string; content: string }[] {
  const messages = [
    { role: 'system', content: systemPrompt },
    ...history,
    { role: 'user', content: userMessage },
  ];

  // Trim to fit llama3.2's ~8k context window (leave room for response)
  return trimHistory(messages, 6000);
}
