/* ═══════════════════════════════════════════════════════════════
   AI Tool Registry
   Centralized registration and lookup for all AI tools.
   ═══════════════════════════════════════════════════════════════ */

import type { ToolDefinition, ToolContext, ToolCategory } from './types';
import { hasPermission, type PermissionsMap } from '../permissions';

class ToolRegistry {
  private tools = new Map<string, ToolDefinition>();

  /** Register a single tool */
  register(tool: ToolDefinition): void {
    if (this.tools.has(tool.id)) {
      console.warn(`[AI ToolRegistry] Overwriting tool: ${tool.id}`);
    }
    this.tools.set(tool.id, tool);
  }

  /** Register multiple tools at once */
  registerAll(tools: ToolDefinition[]): void {
    for (const tool of tools) {
      this.register(tool);
    }
  }

  /** Get a tool by ID */
  get(id: string): ToolDefinition | undefined {
    return this.tools.get(id);
  }

  /** Get all registered tools */
  getAll(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }

  /** Get tools filtered by category */
  getByCategory(category: ToolCategory): ToolDefinition[] {
    return this.getAll().filter((t) => t.category === category);
  }

  /**
   * Get tools the user is allowed to use based on their permissions.
   * Read tools with no requiredPermissions are always available.
   */
  getAvailableTools(permissions: PermissionsMap): ToolDefinition[] {
    return this.getAll().filter((tool) => {
      if (tool.requiredPermissions.length === 0) return true;
      return tool.requiredPermissions.every((perm) =>
        hasPermission(permissions, perm as any)
      );
    });
  }

  /**
   * Build tool descriptions for the system prompt.
   * Only includes tools the user has permission to use.
   */
  buildToolDescriptions(permissions: PermissionsMap): string {
    const available = this.getAvailableTools(permissions);
    if (available.length === 0) return '';

    const grouped = {
      read: available.filter((t) => t.category === 'read'),
      write: available.filter((t) => t.category === 'write'),
      action: available.filter((t) => t.category === 'action'),
    };

    const lines: string[] = ['## Available Tools\n'];

    if (grouped.read.length > 0) {
      lines.push('### Read Tools (safe, query-only)');
      for (const t of grouped.read) {
        lines.push(formatToolForPrompt(t));
      }
      lines.push('');
    }

    if (grouped.write.length > 0) {
      lines.push('### Write Tools (creates or updates data)');
      for (const t of grouped.write) {
        lines.push(formatToolForPrompt(t));
      }
      lines.push('');
    }

    if (grouped.action.length > 0) {
      lines.push('### Action Tools (side effects — use with confirmation)');
      for (const t of grouped.action) {
        lines.push(formatToolForPrompt(t));
      }
      lines.push('');
    }

    return lines.join('\n');
  }

  /** Check if user has permission for a specific tool */
  canUse(toolId: string, permissions: PermissionsMap): boolean {
    const tool = this.tools.get(toolId);
    if (!tool) return false;
    if (tool.requiredPermissions.length === 0) return true;
    return tool.requiredPermissions.every((perm) =>
      hasPermission(permissions, perm as any)
    );
  }
}

function formatToolForPrompt(tool: ToolDefinition): string {
  const params = tool.parameters
    .map((p) => {
      const req = p.required ? ' (required)' : ' (optional)';
      const enumStr = p.enum ? ` [${p.enum.join(' | ')}]` : '';
      return `    - ${p.name}: ${p.type}${req}${enumStr} — ${p.description}`;
    })
    .join('\n');

  return `- **${tool.id}**: ${tool.description}\n${params}`;
}

/** Singleton registry instance */
export const toolRegistry = new ToolRegistry();
