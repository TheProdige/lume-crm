/* Custom React Flow Node — Sticky Note

   Interaction model:
   - Click → select (handled by React Flow)
   - Double-click → enter edit mode
   - While editing: textarea has className "nodrag nowheel" to prevent
     React Flow from capturing pointer events for drag/zoom
   - Escape or blur → exit edit mode
   - NodeResizer shows resize handles when selected
*/

import React, { useState, useRef, useEffect, useCallback, memo } from 'react';
import { Handle, Position, NodeResizer, type NodeProps } from '@xyflow/react';
import { Lock } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface StickyNoteData {
  content: string;
  color: string;
  fontSize: number;
  textAlign: 'left' | 'center' | 'right';
  locked: boolean;
  itemId: string;
  connectMode?: boolean;
  onContentChange?: (id: string, content: string) => void;
}

function StickyNoteNode({ data, selected }: NodeProps & { data: StickyNoteData }) {
  const [editing, setEditing] = useState(false);
  const textRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing && textRef.current) {
      textRef.current.focus();
      textRef.current.selectionStart = textRef.current.value.length;
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
        minWidth={140}
        minHeight={80}
        lineClassName="!border-blue-400"
        handleClassName="!w-2.5 !h-2.5 !bg-white !border-2 !border-blue-500 !rounded-sm"
      />
      <div
        className={cn(
          'rounded-lg shadow-md transition-shadow min-w-[140px] min-h-[80px] relative',
          selected && 'shadow-lg',
          data.locked && 'opacity-90',
        )}
        style={{
          backgroundColor: data.color || '#fef08a',
          width: '100%',
          height: '100%',
        }}
        onDoubleClick={enterEdit}
      >
        {/* Connection handles */}
        <Handle type="target" position={Position.Top} className={handleClass} />
        <Handle type="source" position={Position.Bottom} className={handleClass} />
        <Handle type="target" position={Position.Left} className={handleClass} id="left" />
        <Handle type="source" position={Position.Right} className={handleClass} id="right" />

        {data.locked && (
          <div className="absolute top-1.5 right-1.5 pointer-events-none">
            <Lock size={10} className="text-gray-500" />
          </div>
        )}

        {/* Content */}
        <div className="p-3 h-full">
          {editing ? (
            <textarea
              ref={textRef}
              value={data.content}
              onChange={(e) => data.onContentChange?.(data.itemId, e.target.value)}
              onBlur={exitEdit}
              onKeyDown={(e) => {
                if (e.key === 'Escape') exitEdit();
                e.stopPropagation();
              }}
              className="nodrag nowheel w-full h-full bg-transparent border-none outline-none resize-none text-gray-800"
              style={{ fontSize: data.fontSize || 14, textAlign: data.textAlign || 'left' }}
              onPointerDown={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
            />
          ) : (
            <p
              className="text-gray-800 whitespace-pre-wrap break-words cursor-default select-none h-full"
              style={{ fontSize: data.fontSize || 14, textAlign: data.textAlign || 'left' }}
            >
              {data.content || (
                <span className="text-gray-400 italic text-[12px]">Double-click to edit...</span>
              )}
            </p>
          )}
        </div>
      </div>
    </>
  );
}

export default memo(StickyNoteNode);
