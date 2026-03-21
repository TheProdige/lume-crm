/* Custom React Flow Node — Text Block

   Same interaction model as StickyNoteNode:
   Double-click to edit, nodrag/nowheel isolation while editing.
   NodeResizer for resize handles when selected.
*/

import React, { useState, useRef, useEffect, useCallback, memo } from 'react';
import { Handle, Position, NodeResizer, type NodeProps } from '@xyflow/react';
import { cn } from '../../lib/utils';

export interface TextNodeData {
  content: string;
  fontSize: number;
  textAlign: 'left' | 'center' | 'right';
  color: string;
  locked: boolean;
  itemId: string;
  connectMode?: boolean;
  onContentChange?: (id: string, content: string) => void;
}

function TextNode({ data, selected }: NodeProps & { data: TextNodeData }) {
  const [editing, setEditing] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing && ref.current) {
      ref.current.focus();
      ref.current.selectionStart = ref.current.value.length;
    }
  }, [editing]);

  const enterEdit = useCallback(() => {
    if (!data.locked) setEditing(true);
  }, [data.locked]);

  const exitEdit = useCallback(() => {
    setEditing(false);
  }, []);

  const showHandles = selected || data.connectMode;
  const handleClass = cn(
    '!border-2 !border-white !rounded-full transition-all',
    showHandles
      ? '!w-3.5 !h-3.5 !bg-blue-500 !opacity-100 hover:!bg-blue-600 hover:!scale-125'
      : '!w-2.5 !h-2.5 !bg-gray-400 !opacity-0 hover:!opacity-100',
  );

  return (
    <>
      <NodeResizer
        isVisible={selected && !data.locked}
        minWidth={120}
        minHeight={32}
        lineClassName="!border-blue-400"
        handleClassName="!w-2.5 !h-2.5 !bg-white !border-2 !border-blue-500 !rounded-sm"
      />
      <div
        className={cn(
          'min-w-[120px] min-h-[32px] relative',
          selected && 'rounded-md',
        )}
        style={{ width: '100%', height: '100%' }}
        onDoubleClick={enterEdit}
      >
        <Handle type="target" position={Position.Top} className={handleClass} />
        <Handle type="source" position={Position.Bottom} className={handleClass} />
        <Handle type="target" position={Position.Left} className={handleClass} id="left" />
        <Handle type="source" position={Position.Right} className={handleClass} id="right" />

        {editing ? (
          <textarea
            ref={ref}
            value={data.content}
            onChange={(e) => data.onContentChange?.(data.itemId, e.target.value)}
            onBlur={exitEdit}
            onKeyDown={(e) => {
              if (e.key === 'Escape') exitEdit();
              e.stopPropagation();
            }}
            className="nodrag nowheel w-full h-full bg-transparent border border-blue-300 rounded-md outline-none resize-none px-2 py-1 text-text-primary"
            style={{ fontSize: data.fontSize || 14, textAlign: data.textAlign || 'left' }}
            onPointerDown={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          />
        ) : (
          <p
            className="text-text-primary whitespace-pre-wrap break-words px-2 py-1 cursor-default select-none h-full"
            style={{ fontSize: data.fontSize || 14, textAlign: data.textAlign || 'left' }}
          >
            {data.content || <span className="text-text-tertiary italic text-[12px]">Double-click to type...</span>}
          </p>
        )}
      </div>
    </>
  );
}

export default memo(TextNode);
