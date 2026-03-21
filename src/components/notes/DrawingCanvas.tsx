/* Drawing Canvas — SVG overlay for free drawing on the canvas
   Supports pen, highlighter, and eraser tools.
   Drawings are stored as SVG paths in note_items.
*/

import React, { useState, useRef, useCallback, useEffect, memo } from 'react';

export type DrawTool = 'pen' | 'highlighter' | 'eraser';

interface DrawingCanvasProps {
  active: boolean;
  tool: DrawTool;
  color: string;
  strokeWidth: number;
  viewport: { x: number; y: number; zoom: number };
  existingPaths: DrawPath[];
  onPathComplete: (path: DrawPath) => void;
  onPathErase: (pathId: string) => void;
}

export interface DrawPath {
  id: string;
  d: string;
  color: string;
  strokeWidth: number;
  opacity: number;
  tool: DrawTool;
}

function simplifyPoints(points: { x: number; y: number }[]): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y} L ${points[0].x} ${points[0].y}`;

  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    if (i < points.length - 1) {
      const midX = (points[i].x + points[i + 1].x) / 2;
      const midY = (points[i].y + points[i + 1].y) / 2;
      d += ` Q ${points[i].x} ${points[i].y} ${midX} ${midY}`;
    } else {
      d += ` L ${points[i].x} ${points[i].y}`;
    }
  }
  return d;
}

function DrawingCanvas({
  active, tool, color, strokeWidth, viewport,
  existingPaths, onPathComplete, onPathErase,
}: DrawingCanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [drawing, setDrawing] = useState(false);
  const [currentPoints, setCurrentPoints] = useState<{ x: number; y: number }[]>([]);
  const pointsRef = useRef<{ x: number; y: number }[]>([]);

  const screenToCanvas = useCallback((clientX: number, clientY: number) => {
    return {
      x: (clientX - viewport.x) / viewport.zoom,
      y: (clientY - viewport.y) / viewport.zoom,
    };
  }, [viewport]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (!active) return;
    e.preventDefault();
    e.stopPropagation();

    if (tool === 'eraser') {
      // Check if clicking on an existing path
      const target = e.target as SVGElement;
      const pathId = target.getAttribute('data-path-id');
      if (pathId) {
        onPathErase(pathId);
      }
      return;
    }

    setDrawing(true);
    const pt = screenToCanvas(e.clientX, e.clientY);
    pointsRef.current = [pt];
    setCurrentPoints([pt]);
    (e.target as Element).setPointerCapture(e.pointerId);
  }, [active, tool, screenToCanvas, onPathErase]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!drawing || !active) return;
    e.preventDefault();

    const pt = screenToCanvas(e.clientX, e.clientY);
    // Throttle: only add point if moved enough
    const last = pointsRef.current[pointsRef.current.length - 1];
    const dist = Math.sqrt((pt.x - last.x) ** 2 + (pt.y - last.y) ** 2);
    if (dist < 2) return;

    pointsRef.current.push(pt);
    setCurrentPoints([...pointsRef.current]);
  }, [drawing, active, screenToCanvas]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (!drawing) return;
    e.preventDefault();
    setDrawing(false);

    if (pointsRef.current.length < 2) {
      setCurrentPoints([]);
      return;
    }

    const pathD = simplifyPoints(pointsRef.current);
    const newPath: DrawPath = {
      id: crypto.randomUUID(),
      d: pathD,
      color: tool === 'highlighter' ? color : color,
      strokeWidth: tool === 'highlighter' ? strokeWidth * 3 : strokeWidth,
      opacity: tool === 'highlighter' ? 0.4 : 1,
      tool,
    };
    onPathComplete(newPath);
    setCurrentPoints([]);
    pointsRef.current = [];
  }, [drawing, color, strokeWidth, tool, onPathComplete]);

  if (!active && existingPaths.length === 0) return null;

  const currentD = simplifyPoints(currentPoints);

  return (
    <svg
      ref={svgRef}
      className="absolute inset-0 w-full h-full"
      style={{
        zIndex: active ? 45 : 5,
        pointerEvents: active ? 'all' : 'none',
        cursor: active
          ? tool === 'eraser' ? 'crosshair' : 'crosshair'
          : 'default',
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      <g transform={`translate(${viewport.x}, ${viewport.y}) scale(${viewport.zoom})`}>
        {/* Existing paths */}
        {existingPaths.map((p) => (
          <path
            key={p.id}
            data-path-id={p.id}
            d={p.d}
            fill="none"
            stroke={p.color}
            strokeWidth={p.strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={p.opacity}
            style={{
              pointerEvents: active && tool === 'eraser' ? 'stroke' : 'none',
              cursor: active && tool === 'eraser' ? 'pointer' : 'default',
            }}
          />
        ))}
        {/* Current drawing */}
        {drawing && currentD && (
          <path
            d={currentD}
            fill="none"
            stroke={color}
            strokeWidth={tool === 'highlighter' ? strokeWidth * 3 : strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={tool === 'highlighter' ? 0.4 : 1}
          />
        )}
      </g>
    </svg>
  );
}

export default memo(DrawingCanvas);
