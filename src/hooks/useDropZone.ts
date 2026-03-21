/* useDropZone — reusable drag-and-drop file upload hook */

import { useState, useCallback, useRef, type DragEvent } from 'react';

interface UseDropZoneOptions {
  accept?: string[];
  maxSizeMB?: number;
  onDrop: (files: File[]) => void;
}

export function useDropZone({ accept, maxSizeMB = 10, onDrop }: UseDropZoneOptions) {
  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = useRef(0);

  const isAccepted = useCallback((file: File) => {
    if (!accept || accept.length === 0) return true;
    return accept.some((pattern) => {
      if (pattern.endsWith('/*')) return file.type.startsWith(pattern.replace('/*', '/'));
      return file.type === pattern;
    });
  }, [accept]);

  const handleDragEnter = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    if (e.dataTransfer.items.length > 0) setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current <= 0) { dragCounter.current = 0; setIsDragging(false); }
  }, []);

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounter.current = 0;

    const files: File[] = Array.from(e.dataTransfer.files);
    const maxBytes = maxSizeMB * 1024 * 1024;
    const valid = files.filter((f: File) => isAccepted(f) && f.size <= maxBytes);
    if (valid.length > 0) onDrop(valid);
  }, [isAccepted, maxSizeMB, onDrop]);

  return {
    isDragging,
    dropHandlers: {
      onDragEnter: handleDragEnter,
      onDragLeave: handleDragLeave,
      onDragOver: handleDragOver,
      onDrop: handleDrop,
    },
  };
}
