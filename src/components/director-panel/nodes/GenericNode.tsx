import React, { useMemo, useCallback, useRef, useState } from 'react';
import { Handle, Position, type NodeProps, useReactFlow } from '@xyflow/react';
import { MoreHorizontal, CircleAlert, Upload, Loader2 } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { cn } from '../../../lib/utils';
import { getNodeDef } from '../../../lib/director-panel/config/node-registry';
import { useFlowEditorStore } from '../../../lib/director-panel/store';
import { supabase } from '../../../lib/supabase';
import type { NodeIOPort } from '../../../types/director';

// ---------------------------------------------------------------------------
// Data shape (generic — mirrors data_json)
// ---------------------------------------------------------------------------

export interface GenericNodeData {
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const HANDLE_SPACING = 26;
const HANDLE_START_Y = 52;

/** Resolve a lucide icon name (PascalCase string) to the component. */
function resolveIcon(name?: string): React.ElementType {
  if (!name) return CircleAlert;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const icons = LucideIcons as any;
  return icons[name] ?? CircleAlert;
}

function portLabel(port: NodeIOPort): string {
  return port.required ? `${port.label}*` : port.label;
}

// ---------------------------------------------------------------------------
// GenericNode
// ---------------------------------------------------------------------------

const GenericNodeComponent = ({ data, type, id, selected }: NodeProps) => {
  const nodeType = (type ?? (data as GenericNodeData)?.type as string) || 'unknown';
  const def = useMemo(() => getNodeDef(nodeType), [nodeType]);
  const { setNodes } = useReactFlow();

  const Icon = resolveIcon(def?.icon);
  const displayName = def?.displayName ?? nodeType;
  const inputs: NodeIOPort[] = def?.inputs ?? [];
  const outputs: NodeIOPort[] = def?.outputs ?? [];

  const maxPorts = Math.max(inputs.length, outputs.length, 1);
  const bodyHeight = maxPorts * HANDLE_SPACING + 16;

  // ── Import node file upload state ──────────────────────────────────
  const isImport = nodeType === 'import';
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const uploadedUrl = (data as GenericNodeData)?.url as string | undefined;
  const previewType = (data as GenericNodeData)?.previewType as string | undefined;

  const handleFileUpload = useCallback(async (file: File) => {
    if (!file) return;
    setUploading(true);
    try {
      const path = `uploads/${crypto.randomUUID()}_${file.name}`;
      const { data: uploadData, error } = await supabase.storage
        .from('director-panel')
        .upload(path, file, { upsert: true });
      if (error) throw error;
      const { data: urlData } = supabase.storage
        .from('director-panel')
        .getPublicUrl(uploadData.path);
      const publicUrl = urlData.publicUrl;
      const fileType = file.type.startsWith('video') ? 'video' : 'image';

      // Update the node data with the uploaded URL
      setNodes((nds) =>
        nds.map((n) => {
          if (n.id !== id) return n;
          return {
            ...n,
            data: { ...n.data, url: publicUrl, previewType: fileType },
          };
        })
      );
    } catch (err) {
      console.error('File upload failed:', err);
    } finally {
      setUploading(false);
    }
  }, [id, setNodes]);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFileUpload(file);
    },
    [handleFileUpload]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const file = e.dataTransfer.files?.[0];
      if (file) handleFileUpload(file);
    },
    [handleFileUpload]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  // ── Run state from store ──
  const nodeState = useFlowEditorStore((s) => s.runState.nodeStates[id]);
  const isNodeRunning = nodeState === 'running';
  const isNodeCompleted = nodeState === 'completed';

  return (
    <div
      className={cn(
        'relative w-[260px] rounded-xl border bg-[#2a2a2a] shadow-lg transition-all duration-300',
        selected ? 'border-[#c084fc] shadow-[0_0_12px_rgba(192,132,252,0.25)]' : 'border-[#444]',
        isNodeRunning && 'border-purple-400 shadow-[0_0_20px_rgba(168,85,247,0.4)] animate-pulse',
        isNodeCompleted && !isNodeRunning && 'border-emerald-500 shadow-[0_0_12px_rgba(34,197,94,0.2)]',
      )}
    >
      {/* ── Running overlay ── */}
      {isNodeRunning && (
        <div className="absolute -top-2 -right-2 z-10 w-6 h-6 rounded-full bg-purple-500 flex items-center justify-center shadow-lg animate-bounce">
          <Loader2 className="w-3.5 h-3.5 text-white animate-spin" />
        </div>
      )}
      {/* ── Completed overlay ── */}
      {isNodeCompleted && !isNodeRunning && (
        <div className="absolute -top-2 -right-2 z-10 w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center shadow-lg">
          <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
        </div>
      )}

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className={cn(
        'flex items-center justify-between border-b border-[#393939] px-3 py-2 transition-colors',
        isNodeRunning && 'bg-purple-500/10',
        isNodeCompleted && !isNodeRunning && 'bg-emerald-500/5',
      )}>
        <div className="flex items-center gap-2">
          <Icon className={cn('h-4 w-4', isNodeRunning ? 'text-purple-400' : isNodeCompleted ? 'text-emerald-400' : 'text-[#c084fc]')} />
          <span className="text-[13px] font-medium text-[#e0e0e0]">{displayName}</span>
        </div>
        <button
          type="button"
          className="rounded p-0.5 text-[#888] transition-colors hover:bg-[#393939] hover:text-[#e0e0e0]"
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </div>

      {/* ── Status badge (coming_soon / deprecated) ─────────────────────── */}
      {def?.status === 'coming_soon' && (
        <div className="px-3 py-1.5">
          <span className="inline-block rounded bg-[#393939] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[#888]">
            Coming soon
          </span>
        </div>
      )}

      {/* ── Import node: file upload area ────────────────────────────────── */}
      {isImport && (
        <div className="px-3 py-2">
          {uploadedUrl ? (
            <div className="relative overflow-hidden rounded-lg bg-[#1e1e1e]">
              {previewType === 'video' ? (
                <video
                  src={uploadedUrl}
                  className="h-[120px] w-full object-contain"
                  controls
                  muted
                />
              ) : (
                <img
                  src={uploadedUrl}
                  alt="Uploaded file"
                  className="h-[120px] w-full object-contain"
                />
              )}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute bottom-1 right-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white hover:bg-black/80"
              >
                Replace
              </button>
            </div>
          ) : (
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onClick={() => !uploading && fileInputRef.current?.click()}
              className="flex h-[100px] cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-[#555] bg-[#1e1e1e] transition-colors hover:border-[#c084fc] hover:bg-[#222]"
            >
              {uploading ? (
                <>
                  <Loader2 className="h-6 w-6 animate-spin text-[#c084fc]" />
                  <span className="text-[11px] text-[#888]">Uploading...</span>
                </>
              ) : (
                <>
                  <Upload className="h-6 w-6 text-[#666]" />
                  <span className="text-[11px] text-[#888]">Drop file or click to upload</span>
                  <span className="text-[9px] text-[#555]">Images & Videos</span>
                </>
              )}
            </div>
          )}
          {/* Reference type selector */}
          <select
            value={(data.reference_type as string) || 'subject'}
            onChange={(e) => setNodes((nds) => nds.map((n) => n.id === id ? { ...n, data: { ...n.data, reference_type: e.target.value } } : n))}
            className="mt-1.5 w-full rounded bg-[#222] border border-[#333] px-2 py-1 text-[10px] text-[#aaa] outline-none focus:border-[#c084fc]"
            title="Reference classification"
          >
            <option value="subject">Subject reference</option>
            <option value="face">Face reference</option>
            <option value="outfit">Outfit reference</option>
            <option value="product">Product reference</option>
            <option value="environment">Environment reference</option>
            <option value="composition">Composition reference</option>
            <option value="style">Style reference</option>
            <option value="color">Color reference</option>
            <option value="motion">Motion reference</option>
          </select>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>
      )}

      {/* ── Body — reserves space for port labels ───────────────────────── */}
      <div className="relative" style={{ minHeight: bodyHeight }}>
        {/* Input port labels (left-aligned) */}
        {inputs.map((port, i) => (
          <span
            key={`lbl-in-${port.id}`}
            className="pointer-events-none absolute left-4 text-[11px] text-[#888]"
            style={{ top: 8 + i * HANDLE_SPACING }}
          >
            {portLabel(port)}
          </span>
        ))}

        {/* Output port labels (right-aligned) */}
        {outputs.map((port, i) => (
          <span
            key={`lbl-out-${port.id}`}
            className="pointer-events-none absolute right-4 text-[11px] text-[#888]"
            style={{ top: 8 + i * HANDLE_SPACING }}
          >
            {port.label}
          </span>
        ))}

        {/* Simple data display when no ports */}
        {inputs.length === 0 && outputs.length === 0 && def?.defaultData && (
          <div className="px-3 py-2">
            <span className="text-[11px] italic text-[#666]">No I/O ports</span>
          </div>
        )}
      </div>

      {/* ── Input handles (left) ────────────────────────────────────────── */}
      {inputs.map((port, i) => (
        <Handle
          key={`in-${port.id}`}
          type="target"
          position={Position.Left}
          id={port.id}
          style={{ top: HANDLE_START_Y + i * HANDLE_SPACING }}
          className="!h-[10px] !w-[10px] !rounded-full !border-none !bg-[#e879a0]"
        />
      ))}

      {/* ── Output handles (right) ──────────────────────────────────────── */}
      {outputs.map((port, i) => (
        <Handle
          key={`out-${port.id}`}
          type="source"
          position={Position.Right}
          id={port.id}
          style={{ top: HANDLE_START_Y + i * HANDLE_SPACING }}
          className="!h-[10px] !w-[10px] !rounded-full !border-none !bg-[#e879a0]"
        />
      ))}
    </div>
  );
};

const GenericNode = React.memo(GenericNodeComponent);
GenericNode.displayName = 'GenericNode';

export default GenericNode;
