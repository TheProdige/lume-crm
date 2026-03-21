/* Custom React Flow Node — Shape (rectangle, ellipse, diamond, triangle, cloud)
   Supports inline text editing via double-click.
   NodeResizer for resize handles when selected.
*/

import React, { useState, useRef, useEffect, useCallback, memo } from 'react';
import { Handle, Position, NodeResizer, type NodeProps } from '@xyflow/react';
import { cn } from '../../lib/utils';
import type { ShapeType } from '../../types/noteBoard';

export interface ShapeNodeData {
  content: string;
  color: string;
  shapeType: ShapeType;
  borderStyle: string;
  fontSize: number;
  textAlign: 'left' | 'center' | 'right';
  locked: boolean;
  itemId: string;
  connectMode?: boolean;
  onContentChange?: (id: string, content: string) => void;
}

function ShapeNode({ data, selected }: NodeProps & { data: ShapeNodeData }) {
  const [editing, setEditing] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const shape = data.shapeType || 'rectangle';

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.selectionStart = inputRef.current.value.length;
    }
  }, [editing]);

  const enterEdit = useCallback(() => {
    if (!data.locked) setEditing(true);
  }, [data.locked]);

  const exitEdit = useCallback(() => {
    setEditing(false);
  }, []);

  const borderMap: Record<string, string> = {
    none: 'border-transparent',
    solid: 'border-gray-500',
    dashed: 'border-dashed border-gray-500',
    dotted: 'border-dotted border-gray-500',
  };

  const showHandles = selected || data.connectMode;
  const handleCn = cn(
    '!border-2 !border-white !rounded-full transition-all',
    showHandles
      ? '!w-3.5 !h-3.5 !bg-blue-500 !opacity-100 hover:!bg-blue-600 hover:!scale-125'
      : '!w-2.5 !h-2.5 !bg-gray-400 !opacity-0 hover:!opacity-100',
  );

  const textContent = editing ? (
    <textarea
      ref={inputRef}
      value={data.content}
      onChange={(e) => data.onContentChange?.(data.itemId, e.target.value)}
      onBlur={exitEdit}
      onKeyDown={(e) => {
        if (e.key === 'Escape') exitEdit();
        e.stopPropagation();
      }}
      className="nodrag nowheel bg-transparent border-none outline-none resize-none text-gray-800 text-center w-full h-full"
      style={{ fontSize: data.fontSize || 13 }}
      onPointerDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    />
  ) : (
    <span
      className="text-gray-800 text-center px-3 py-2 cursor-default select-none"
      style={{ fontSize: data.fontSize || 13, textAlign: data.textAlign || 'center' }}
    >
      {data.content || <span className="text-gray-400 italic text-[11px]">Double-click...</span>}
    </span>
  );

  // ── Triangle (CSS clip-path) ──
  if (shape === 'triangle') {
    return (
      <>
        <NodeResizer
          isVisible={selected && !data.locked}
          minWidth={80}
          minHeight={80}
          lineClassName="!border-blue-400"
          handleClassName="!w-2.5 !h-2.5 !bg-white !border-2 !border-blue-500 !rounded-sm"
        />
        <div className="relative w-full h-full" onDoubleClick={enterEdit}>
          <Handle type="target" position={Position.Top} className={handleCn} />
          <Handle type="source" position={Position.Bottom} className={handleCn} />
          <div
            className={cn('w-full h-full', selected && 'drop-shadow-[0_0_3px_rgba(59,130,246,0.5)]')}
            style={{
              backgroundColor: data.color || '#e2e8f0',
              clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)',
            }}
          />
          <div className="absolute inset-0 flex items-center justify-center pt-[30%] px-2">
            {textContent}
          </div>
        </div>
      </>
    );
  }

  // ── Diamond (rotated square) ──
  if (shape === 'diamond') {
    return (
      <>
        <NodeResizer
          isVisible={selected && !data.locked}
          minWidth={80}
          minHeight={80}
          lineClassName="!border-blue-400"
          handleClassName="!w-2.5 !h-2.5 !bg-white !border-2 !border-blue-500 !rounded-sm"
        />
        <div className="relative w-full h-full" onDoubleClick={enterEdit}>
          <Handle type="target" position={Position.Top} className={handleCn} />
          <Handle type="source" position={Position.Bottom} className={handleCn} />
          <Handle type="target" position={Position.Left} className={handleCn} id="left" />
          <Handle type="source" position={Position.Right} className={handleCn} id="right" />
          <div
            className={cn(
              'w-full h-full border-2 rotate-45 flex items-center justify-center transition-shadow',
              borderMap[data.borderStyle || 'solid'],
            )}
            style={{ backgroundColor: data.color || '#e2e8f0' }}
          >
            <div className="-rotate-45 px-2 flex items-center justify-center">
              {textContent}
            </div>
          </div>
        </div>
      </>
    );
  }

  // ── Cloud ──
  const shapeClasses: Record<string, string> = {
    rectangle: 'rounded-lg',
    ellipse: 'rounded-full',
    cloud: 'rounded-[40%]',
    arrow_right: 'rounded-lg',
  };

  return (
    <>
      <NodeResizer
        isVisible={selected && !data.locked}
        minWidth={80}
        minHeight={60}
        lineClassName="!border-blue-400"
        handleClassName="!w-2.5 !h-2.5 !bg-white !border-2 !border-blue-500 !rounded-sm"
      />
      <div
        className={cn(
          'w-full h-full border-2 flex items-center justify-center transition-shadow',
          shapeClasses[shape] || 'rounded-lg',
          borderMap[data.borderStyle || 'solid'],
        )}
        style={{ backgroundColor: data.color || '#e2e8f0' }}
        onDoubleClick={enterEdit}
      >
        <Handle type="target" position={Position.Top} className={handleCn} />
        <Handle type="source" position={Position.Bottom} className={handleCn} />
        <Handle type="target" position={Position.Left} className={handleCn} id="left" />
        <Handle type="source" position={Position.Right} className={handleCn} id="right" />
        {textContent}
      </div>
    </>
  );
}

export default memo(ShapeNode);
