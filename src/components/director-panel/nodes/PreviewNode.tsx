import React from 'react';
import { Handle, Position, useReactFlow, type NodeProps } from '@xyflow/react';
import { Eye, MoreHorizontal, ImageIcon, Film, Type } from 'lucide-react';
import { cn } from '../../../lib/utils';

// ---------------------------------------------------------------------------
// Data shape
// ---------------------------------------------------------------------------

export interface PreviewNodeData {
  previewUrl?: string;
  previewType?: 'image' | 'video' | 'text';
  previewText?: string;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Preview content renderer
// ---------------------------------------------------------------------------

function PreviewContent({ data }: { data: PreviewNodeData }) {
  const { previewUrl, previewType, previewText } = data;

  if (previewType === 'text' && previewText) {
    return (
      <div className="h-full overflow-auto p-2 text-[12px] leading-relaxed text-[#e0e0e0]">
        {previewText}
      </div>
    );
  }

  if (previewUrl && previewType === 'video') {
    return (
      <video
        src={previewUrl}
        className="h-full w-full object-contain"
        controls
        muted
        loop
      />
    );
  }

  if (previewUrl) {
    return (
      <img
        src={previewUrl}
        alt="Preview"
        className="h-full w-full object-contain"
      />
    );
  }

  // Empty placeholder
  return (
    <div className="flex flex-col items-center gap-2 text-[#555]">
      <Eye className="h-8 w-8" />
      <span className="text-[11px]">No input connected</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PreviewNode
// ---------------------------------------------------------------------------

const PreviewNodeComponent = ({ id, data, selected }: NodeProps) => {
  const nodeData = data as unknown as PreviewNodeData;
  const { updateNodeData } = useReactFlow();

  const iconMap = {
    image: ImageIcon,
    video: Film,
    text: Type,
  } as const;
  const HeaderIcon = iconMap[nodeData.previewType ?? 'image'] ?? Eye;

  return (
    <div
      className={cn(
        'relative w-[280px] rounded-xl border bg-[#2a2a2a] shadow-lg',
        selected ? 'border-[#c084fc] shadow-[0_0_12px_rgba(192,132,252,0.25)]' : 'border-[#444]',
      )}
    >
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between border-b border-[#393939] px-3 py-2">
        <div className="flex items-center gap-2">
          <HeaderIcon className="h-4 w-4 text-[#c084fc]" />
          <span className="text-[13px] font-medium text-[#e0e0e0]">Preview</span>
        </div>
        <button
          type="button"
          className="rounded p-0.5 text-[#888] transition-colors hover:bg-[#393939] hover:text-[#e0e0e0]"
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </div>

      {/* ── Preview area ────────────────────────────────────────────────── */}
      <div className="px-3 py-2">
        <div className="relative flex h-[180px] items-center justify-center overflow-hidden rounded-lg bg-[#1e1e1e] group/preview">
          <PreviewContent data={nodeData} />
          {nodeData.previewUrl && (
            <div className="absolute top-1.5 right-1.5 flex gap-1 opacity-0 group-hover/preview:opacity-100 transition-opacity">
              <button
                type="button"
                onClick={() => updateNodeData(id, { previewUrl: undefined, previewText: undefined })}
                className="px-2 py-0.5 rounded bg-black/60 text-[10px] font-medium text-white hover:bg-red-500/60 transition-colors"
              >
                Clear
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Input handle (left) ─────────────────────────────────────────── */}
      <Handle
        type="target"
        position={Position.Left}
        id="input"
        className="!h-[10px] !w-[10px] !rounded-full !border-none !bg-[#e879a0]"
      />
      <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[11px] text-[#888]">
        Input
      </span>
    </div>
  );
};

const PreviewNode = React.memo(PreviewNodeComponent);
PreviewNode.displayName = 'PreviewNode';

export default PreviewNode;
