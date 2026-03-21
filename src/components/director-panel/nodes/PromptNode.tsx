import React, { useCallback, useState } from 'react';
import { Handle, Position, type NodeProps, useReactFlow } from '@xyflow/react';
import { Type, MoreHorizontal, Plus, X, Copy, Trash2, Loader2 } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { useFlowEditorStore } from '../../../lib/director-panel/store';

export interface PromptNodeData {
  text: string;
  negative_prompt: string;
  variables: string[];
  [key: string]: unknown;
}

const PromptNodeComponent = ({ data, selected, id }: NodeProps) => {
  const nodeData = data as unknown as PromptNodeData;
  const { updateNodeData } = useReactFlow();
  const [showMenu, setShowMenu] = useState(false);
  const [showNeg, setShowNeg] = useState(!!nodeData.negative_prompt);

  const nodeState = useFlowEditorStore((s) => s.runState.nodeStates[id]);
  const isNodeRunning = nodeState === 'running';
  const isNodeCompleted = nodeState === 'completed';

  const handleTextChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      updateNodeData(id, { text: e.target.value });
    },
    [id, updateNodeData],
  );

  const handleNegChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      updateNodeData(id, { negative_prompt: e.target.value });
    },
    [id, updateNodeData],
  );

  const handleAddVariable = useCallback(() => {
    const next = [...(nodeData.variables ?? []), `var_${(nodeData.variables?.length ?? 0) + 1}`];
    updateNodeData(id, { variables: next });
  }, [id, nodeData.variables, updateNodeData]);

  const handleRemoveVariable = useCallback((varName: string) => {
    const next = (nodeData.variables ?? []).filter((v: string) => v !== varName);
    updateNodeData(id, { variables: next });
  }, [id, nodeData.variables, updateNodeData]);

  const handleClearPrompt = useCallback(() => {
    updateNodeData(id, { text: '', negative_prompt: '' });
    setShowMenu(false);
  }, [id, updateNodeData]);

  const handleCopyPrompt = useCallback(() => {
    navigator.clipboard.writeText(nodeData.text || '');
    setShowMenu(false);
  }, [nodeData.text]);

  return (
    <div
      className={cn(
        'w-[300px] rounded-xl border bg-[#2a2a2a] shadow-lg transition-all duration-300',
        selected ? 'border-[#c084fc] shadow-[0_0_12px_rgba(192,132,252,0.25)]' : 'border-[#444]',
        isNodeRunning && 'border-purple-400 shadow-[0_0_20px_rgba(168,85,247,0.4)] animate-pulse',
        isNodeCompleted && !isNodeRunning && 'border-emerald-500 shadow-[0_0_12px_rgba(34,197,94,0.2)]',
      )}
    >
      {isNodeRunning && (
        <div className="absolute -top-2 -right-2 z-10 w-6 h-6 rounded-full bg-purple-500 flex items-center justify-center shadow-lg animate-bounce">
          <Loader2 className="w-3.5 h-3.5 text-white animate-spin" />
        </div>
      )}
      {isNodeCompleted && !isNodeRunning && (
        <div className="absolute -top-2 -right-2 z-10 w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center shadow-lg">
          <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
        </div>
      )}

      <div className={cn(
        'flex items-center justify-between border-b border-[#393939] px-3 py-2 transition-colors',
        isNodeRunning && 'bg-purple-500/10',
        isNodeCompleted && !isNodeRunning && 'bg-emerald-500/5',
      )}>
        <div className="flex items-center gap-2">
          <Type className={cn('h-4 w-4', isNodeRunning ? 'text-purple-400' : isNodeCompleted ? 'text-emerald-400' : 'text-[#c084fc]')} />
          <span className="text-[13px] font-medium text-[#e0e0e0]">Prompt</span>
        </div>
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowMenu(!showMenu)}
            className="rounded p-0.5 text-[#888] transition-colors hover:bg-[#393939] hover:text-[#e0e0e0]"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
          {showMenu && (
            <div className="absolute right-0 top-full mt-1 w-[140px] rounded-lg bg-[#333] border border-[#444] shadow-xl z-50 py-1">
              <button onClick={handleCopyPrompt} className="flex items-center gap-2 w-full px-3 py-1.5 text-[11px] text-[#ccc] hover:bg-[#444] transition-colors">
                <Copy className="w-3 h-3" /> Copy prompt
              </button>
              <button onClick={handleClearPrompt} className="flex items-center gap-2 w-full px-3 py-1.5 text-[11px] text-red-400 hover:bg-[#444] transition-colors">
                <Trash2 className="w-3 h-3" /> Clear all
              </button>
              <button onClick={() => { setShowNeg(!showNeg); setShowMenu(false); }} className="flex items-center gap-2 w-full px-3 py-1.5 text-[11px] text-[#ccc] hover:bg-[#444] transition-colors">
                <X className="w-3 h-3" /> {showNeg ? 'Hide' : 'Show'} negative
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="px-3 py-2 space-y-2">
        <textarea
          value={nodeData.text ?? ''}
          onChange={handleTextChange}
          placeholder="Enter your prompt…"
          rows={4}
          className="nodrag nowheel w-full resize-none rounded-md bg-[#1e1e1e] px-2.5 py-2 text-[13px] leading-relaxed text-[#e0e0e0] placeholder-[#666] outline-none focus:ring-1 focus:ring-[#c084fc]/40"
        />
        {showNeg && (
          <textarea
            value={nodeData.negative_prompt ?? ''}
            onChange={handleNegChange}
            placeholder="Negative prompt — what to avoid…"
            rows={2}
            className="nodrag nowheel w-full resize-none rounded-md bg-[#1e1e1e] px-2.5 py-1.5 text-[12px] leading-relaxed text-[#e0e0e0] placeholder-[#555] outline-none focus:ring-1 focus:ring-red-400/30 border border-[#333]"
          />
        )}
      </div>

      <div className="border-t border-[#393939] px-3 py-2">
        <button
          type="button"
          onClick={handleAddVariable}
          className="flex items-center gap-1 text-[12px] text-[#c084fc] transition-colors hover:text-[#d4a5ff]"
        >
          <Plus className="h-3 w-3" />
          Add variable
        </button>

        {nodeData.variables?.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {nodeData.variables.map((v: string) => (
              <span
                key={v}
                className="group flex items-center gap-1 rounded bg-[#393939] px-1.5 py-0.5 text-[11px] text-[#aaa]"
              >
                {`{${v}}`}
                <button
                  type="button"
                  onClick={() => handleRemoveVariable(v)}
                  className="opacity-0 group-hover:opacity-100 text-[#666] hover:text-red-400 transition-all"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      <Handle
        type="source"
        position={Position.Right}
        id="prompt"
        className="!h-[10px] !w-[10px] !rounded-full !border-none !bg-[#e879a0]"
      />
      <Handle
        type="source"
        position={Position.Right}
        id="negative_prompt"
        style={{ top: '75%' }}
        className="!h-[10px] !w-[10px] !rounded-full !border-none !bg-[#f87171]"
      />
      <span className="pointer-events-none absolute right-4 top-[42%] -translate-y-1/2 text-[11px] text-[#888]">
        Prompt
      </span>
      <span className="pointer-events-none absolute right-4 top-[75%] -translate-y-1/2 text-[10px] text-[#666]">
        Neg
      </span>
    </div>
  );
};

const PromptNode = React.memo(PromptNodeComponent);
PromptNode.displayName = 'PromptNode';

export default PromptNode;
