/* Canvas Context Menu — right-click menu for the canvas and nodes */

import React, { useEffect, useRef } from 'react';
import {
  Copy, Trash2, Lock, Unlock, Layers, ArrowUp, ArrowDown,
  StickyNote, Type, CheckSquare, Square, Image, Link2, Frame,
  Scissors, ClipboardPaste, MoveRight,
} from 'lucide-react';
import { cn } from '../../lib/utils';

export interface ContextMenuAction {
  id: string;
  label: string;
  icon: React.ElementType;
  shortcut?: string;
  danger?: boolean;
  dividerBefore?: boolean;
  disabled?: boolean;
}

interface CanvasContextMenuProps {
  x: number;
  y: number;
  isNodeMenu: boolean;
  isLocked: boolean;
  language: string;
  onAction: (actionId: string) => void;
  onClose: () => void;
}

export default function CanvasContextMenu({
  x, y, isNodeMenu, isLocked, language, onAction, onClose,
}: CanvasContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const fr = language === 'fr';

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as HTMLElement)) {
        onClose();
      }
    };
    const keyHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', keyHandler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', keyHandler);
    };
  }, [onClose]);

  // Adjust position to stay within viewport
  const adjustedX = Math.min(x, window.innerWidth - 220);
  const adjustedY = Math.min(y, window.innerHeight - 400);

  const nodeActions: ContextMenuAction[] = [
    { id: 'duplicate', label: fr ? 'Dupliquer' : 'Duplicate', icon: Copy, shortcut: 'Ctrl+D' },
    { id: 'cut', label: fr ? 'Couper' : 'Cut', icon: Scissors, shortcut: 'Ctrl+X' },
    { id: 'copy', label: fr ? 'Copier' : 'Copy', icon: Copy, shortcut: 'Ctrl+C' },
    { id: 'lock', label: isLocked ? (fr ? 'Deverrouiller' : 'Unlock') : (fr ? 'Verrouiller' : 'Lock'), icon: isLocked ? Unlock : Lock, dividerBefore: true },
    { id: 'bring-front', label: fr ? 'Premier plan' : 'Bring to front', icon: ArrowUp, dividerBefore: true },
    { id: 'send-back', label: fr ? 'Arriere-plan' : 'Send to back', icon: ArrowDown },
    { id: 'connect', label: fr ? 'Connecter' : 'Connect', icon: MoveRight, dividerBefore: true },
    { id: 'delete', label: fr ? 'Supprimer' : 'Delete', icon: Trash2, shortcut: 'Del', danger: true, dividerBefore: true },
  ];

  const canvasActions: ContextMenuAction[] = [
    { id: 'paste', label: fr ? 'Coller' : 'Paste', icon: ClipboardPaste, shortcut: 'Ctrl+V' },
    { id: 'add-sticky', label: fr ? 'Post-it' : 'Sticky note', icon: StickyNote, dividerBefore: true },
    { id: 'add-text', label: fr ? 'Texte' : 'Text', icon: Type },
    { id: 'add-checklist', label: 'Checklist', icon: CheckSquare },
    { id: 'add-shape', label: fr ? 'Forme' : 'Shape', icon: Square },
    { id: 'add-frame', label: 'Frame', icon: Frame },
    { id: 'add-image', label: 'Image', icon: Image },
    { id: 'add-link', label: fr ? 'Lien' : 'Link', icon: Link2 },
    { id: 'select-all', label: fr ? 'Tout selectionner' : 'Select all', icon: Layers, shortcut: 'Ctrl+A', dividerBefore: true },
  ];

  const actions = isNodeMenu ? nodeActions : canvasActions;

  return (
    <div
      ref={menuRef}
      className="fixed z-[100] bg-surface border border-outline rounded-xl shadow-xl py-1 min-w-[200px] animate-in fade-in zoom-in-95 duration-100"
      style={{ left: adjustedX, top: adjustedY }}
    >
      {actions.map((action) => (
        <React.Fragment key={action.id}>
          {action.dividerBefore && <div className="h-px bg-outline my-1 mx-2" />}
          <button
            onClick={() => {
              onAction(action.id);
              onClose();
            }}
            disabled={action.disabled}
            className={cn(
              'w-full flex items-center gap-3 px-3 py-1.5 text-[13px] transition-colors',
              action.danger
                ? 'text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20'
                : 'text-text-primary hover:bg-surface-secondary',
              action.disabled && 'opacity-40 cursor-not-allowed',
            )}
          >
            <action.icon size={14} className={action.danger ? 'text-red-400' : 'text-text-tertiary'} />
            <span className="flex-1 text-left">{action.label}</span>
            {action.shortcut && (
              <span className="text-[11px] text-text-tertiary">{action.shortcut}</span>
            )}
          </button>
        </React.Fragment>
      ))}
    </div>
  );
}
