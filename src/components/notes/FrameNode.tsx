/* Custom React Flow Node — Frame (section/group container)
   Acts like a Miro frame: titled area that groups elements visually.
   Supports background color, title editing, collapse toggle.
*/

import React, { useState, useRef, useEffect, useCallback, memo } from 'react';
import { Handle, Position, NodeResizer, type NodeProps } from '@xyflow/react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface FrameNodeData {
  content: string;
  color: string;
  fontSize: number;
  textAlign: 'left' | 'center' | 'right';
  locked: boolean;
  itemId: string;
  connectMode?: boolean;
  collapsed?: boolean;
  onContentChange?: (id: string, content: string) => void;
}

function FrameNode({ data, selected }: NodeProps & { data: FrameNodeData }) {
  const [editing, setEditing] = useState(false);
  const [collapsed, setCollapsed] = useState(data.collapsed ?? false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const enterEdit = useCallback(() => {
    if (!data.locked) setEditing(true);
  }, [data.locked]);

  const exitEdit = useCallback(() => {
    setEditing(false);
  }, []);

  const showHandles = selected || data.connectMode;
  const handleCn = cn(
    '!border-2 !border-white !rounded-full transition-all',
    showHandles
      ? '!w-3.5 !h-3.5 !bg-blue-500 !opacity-100 hover:!bg-blue-600 hover:!scale-125'
      : '!w-2.5 !h-2.5 !bg-gray-400 !opacity-0 hover:!opacity-100',
  );

  const bgColor = data.color || '#f1f5f9';
  const borderColor = selected ? '#3b82f6' : '#cbd5e1';

  return (
    <>
      <NodeResizer
        isVisible={selected && !data.locked}
        minWidth={200}
        minHeight={collapsed ? 48 : 120}
        lineClassName="!border-blue-400"
        handleClassName="!w-2.5 !h-2.5 !bg-white !border-2 !border-blue-500 !rounded-sm"
      />
      <div
        className={cn(
          'w-full rounded-xl border-2 border-dashed transition-all',
          selected && 'shadow-lg',
        )}
        style={{
          borderColor,
          backgroundColor: bgColor + '40',
          height: collapsed ? 48 : '100%',
          overflow: 'hidden',
        }}
      >
        {/* Connection handles */}
        <Handle type="target" position={Position.Top} className={handleCn} />
        <Handle type="source" position={Position.Bottom} className={handleCn} />
        <Handle type="target" position={Position.Left} className={handleCn} id="left" />
        <Handle type="source" position={Position.Right} className={handleCn} id="right" />

        {/* Frame header */}
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-t-xl"
          style={{ backgroundColor: bgColor + '80' }}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              setCollapsed(!collapsed);
            }}
            className="nodrag p-0.5 rounded hover:bg-black/10 transition-colors text-gray-600"
          >
            {collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
          </button>

          {editing ? (
            <input
              ref={inputRef}
              value={data.content}
              onChange={(e) => data.onContentChange?.(data.itemId, e.target.value)}
              onBlur={exitEdit}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === 'Escape') exitEdit();
                e.stopPropagation();
              }}
              className="nodrag nowheel flex-1 bg-transparent border-none outline-none text-gray-700 font-semibold text-[13px]"
              onPointerDown={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
            />
          ) : (
            <span
              className="flex-1 text-gray-700 font-semibold text-[13px] cursor-default select-none truncate"
              onDoubleClick={enterEdit}
            >
              {data.content || 'Frame'}
            </span>
          )}
        </div>

        {/* Frame body — transparent to allow items inside to be placed visually */}
        {!collapsed && (
          <div className="flex-1 min-h-[80px]" />
        )}
      </div>
    </>
  );
}

export default memo(FrameNode);
