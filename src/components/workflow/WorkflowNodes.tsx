import React, { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import {
  Zap, GitBranch, Play, Mail, MessageSquare, CheckSquare, UserPlus,
  RefreshCw, Tag, StickyNote, Bell, Star, Globe, Send, CreditCard,
  Calendar, MapPin, LogOut, FileText, AlertCircle, ClipboardCheck,
  Clock, Timer,
} from 'lucide-react';
import { cn } from '../../lib/utils';

// ── Icon resolver ──
const ICON_MAP: Record<string, typeof Zap> = {
  Zap, GitBranch, Play, Mail, MessageSquare, CheckSquare, UserPlus,
  RefreshCw, Tag, StickyNote, Bell, Star, Globe, Send, CreditCard,
  Calendar, MapPin, LogOut, FileText, AlertCircle, ClipboardCheck,
  Clock, Timer,
  UserCog: UserPlus,
  CheckCircle: CheckSquare,
};

function getIcon(name?: string) {
  if (!name) return Zap;
  return ICON_MAP[name] || Zap;
}

// ── Shared handle styles ──
const handleClass = '!w-2 !h-2 !bg-text-tertiary/60 !border-[1.5px] !border-surface !rounded-full';

// ── Node data types ──
interface TriggerData {
  label: string;
  triggerType?: string;
  icon?: string;
  status?: 'idle' | 'triggered' | 'running';
  [key: string]: unknown;
}

interface ConditionData {
  label: string;
  conditions?: any[];
  operator?: 'AND' | 'OR';
  [key: string]: unknown;
}

interface ActionData {
  label: string;
  actionType?: string;
  icon?: string;
  status?: 'idle' | 'running' | 'completed' | 'error';
  [key: string]: unknown;
}

interface DelayData {
  label: string;
  delay_value?: number;
  delay_unit?: string;
  [key: string]: unknown;
}

// ═══════════════════════════════════════════════════════════════
// TRIGGER NODE
// ═══════════════════════════════════════════════════════════════
export const TriggerNode = memo(function TriggerNode({ data, selected }: NodeProps) {
  const d = data as TriggerData;
  const Icon = getIcon(d.icon);

  return (
    <div className={cn(
      'bg-surface border rounded-xl shadow-sm min-w-[210px] transition-all duration-150',
      selected ? 'border-primary/50 shadow-md ring-2 ring-primary/10' : 'border-outline hover:border-outline/80',
    )}>
      <div className="flex items-center gap-2 px-3 py-2 border-b border-outline/40">
        <div className="w-6 h-6 rounded-lg bg-surface-tertiary flex items-center justify-center">
          <Zap size={12} className="text-text-primary" />
        </div>
        <span className="text-[10px] font-bold uppercase tracking-wider text-text-primary">Trigger</span>
        {d.status === 'triggered' && (
          <span className="ml-auto flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-text-secondary animate-pulse" />
            <span className="text-[9px] font-semibold text-text-secondary">Active</span>
          </span>
        )}
      </div>

      <div className="px-3 py-3">
        <div className="flex items-center gap-2">
          <Icon size={14} className="text-text-secondary shrink-0" />
          <span className="text-[12px] font-semibold text-text-primary truncate">{d.label || 'Select trigger'}</span>
        </div>
      </div>

      <Handle type="source" position={Position.Bottom} className={handleClass} />
    </div>
  );
});

// ═══════════════════════════════════════════════════════════════
// CONDITION NODE
// ═══════════════════════════════════════════════════════════════
export const ConditionNode = memo(function ConditionNode({ data, selected }: NodeProps) {
  const d = data as ConditionData;
  const condCount = d.conditions?.length || 0;

  return (
    <div className={cn(
      'bg-surface border rounded-xl shadow-sm min-w-[210px] transition-all duration-150',
      selected ? 'border-primary/50 shadow-md ring-2 ring-primary/10' : 'border-outline hover:border-outline/80',
    )}>
      <Handle type="target" position={Position.Top} className={handleClass} />

      <div className="flex items-center gap-2 px-3 py-2 border-b border-outline/40">
        <div className="w-6 h-6 rounded-lg bg-surface-tertiary flex items-center justify-center">
          <GitBranch size={12} className="text-text-secondary" />
        </div>
        <span className="text-[10px] font-bold uppercase tracking-wider text-text-secondary">Condition</span>
        {condCount > 0 && (
          <span className="ml-auto text-[9px] font-semibold text-text-tertiary bg-surface-tertiary px-1.5 py-0.5 rounded">
            {condCount} {d.operator || 'AND'}
          </span>
        )}
      </div>

      <div className="px-3 py-3">
        <div className="flex items-center gap-2">
          <GitBranch size={14} className="text-text-secondary shrink-0" />
          <span className="text-[12px] font-semibold text-text-primary truncate">{d.label || 'Set conditions'}</span>
        </div>
      </div>

      <Handle type="source" position={Position.Bottom} className={handleClass} />
    </div>
  );
});

// ═══════════════════════════════════════════════════════════════
// ACTION NODE
// ═══════════════════════════════════════════════════════════════
export const ActionNode = memo(function ActionNode({ data, selected }: NodeProps) {
  const d = data as ActionData;
  const Icon = getIcon(d.icon);
  const isN8n = d.actionType === 'trigger_n8n';

  return (
    <div className={cn(
      'bg-surface border rounded-xl shadow-sm min-w-[210px] transition-all duration-150',
      selected ? 'border-primary/50 shadow-md ring-2 ring-primary/10' : 'border-outline hover:border-outline/80',
    )}>
      <Handle type="target" position={Position.Top} className={handleClass} />

      <div className="flex items-center gap-2 px-3 py-2 border-b border-outline/40">
        <div className="w-6 h-6 rounded-lg bg-surface-tertiary flex items-center justify-center">
          <Play size={12} className="text-text-secondary" />
        </div>
        <span className="text-[10px] font-bold uppercase tracking-wider text-text-secondary">
          {isN8n ? 'n8n' : 'Action'}
        </span>
        {d.status && d.status !== 'idle' && (
          <span className={cn(
            'ml-auto text-[9px] font-semibold capitalize',
            d.status === 'completed' ? 'text-text-primary' : d.status === 'error' ? 'text-text-tertiary' : 'text-text-secondary'
          )}>
            {d.status}
          </span>
        )}
      </div>

      <div className="px-3 py-3">
        <div className="flex items-center gap-2">
          <Icon size={14} className="text-text-secondary shrink-0" />
          <span className="text-[12px] font-semibold text-text-primary truncate">{d.label || 'Select action'}</span>
        </div>
      </div>

      <Handle type="source" position={Position.Bottom} className={handleClass} />
    </div>
  );
});

// ═══════════════════════════════════════════════════════════════
// DELAY NODE
// ═══════════════════════════════════════════════════════════════
export const DelayNode = memo(function DelayNode({ data, selected }: NodeProps) {
  const d = data as DelayData;
  const delayText = d.delay_value && d.delay_unit
    ? `${d.delay_value} ${d.delay_unit}`
    : null;

  return (
    <div className={cn(
      'bg-surface border rounded-xl shadow-sm min-w-[210px] transition-all duration-150',
      selected ? 'border-primary/50 shadow-md ring-2 ring-primary/10' : 'border-outline hover:border-outline/80',
    )}>
      <Handle type="target" position={Position.Top} className={handleClass} />

      <div className="flex items-center gap-2 px-3 py-2 border-b border-outline/40">
        <div className="w-6 h-6 rounded-lg bg-surface-tertiary flex items-center justify-center">
          <Timer size={12} className="text-text-secondary" />
        </div>
        <span className="text-[10px] font-bold uppercase tracking-wider text-text-secondary">Delay</span>
        {delayText && (
          <span className="ml-auto text-[9px] font-semibold text-text-tertiary bg-surface-tertiary px-1.5 py-0.5 rounded">
            {delayText}
          </span>
        )}
      </div>

      <div className="px-3 py-3">
        <div className="flex items-center gap-2">
          <Clock size={14} className="text-text-secondary shrink-0" />
          <span className="text-[12px] font-semibold text-text-primary truncate">{d.label || 'Set delay'}</span>
        </div>
      </div>

      <Handle type="source" position={Position.Bottom} className={handleClass} />
    </div>
  );
});

// ── Node types export ──
export const nodeTypes = {
  trigger: TriggerNode,
  condition: ConditionNode,
  action: ActionNode,
  delay: DelayNode,
};
