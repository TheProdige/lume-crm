/* Live Cursors — shows other users' cursor positions in real-time
   Uses Supabase Realtime Presence for broadcasting cursor state.
*/

import React, { memo } from 'react';
import { MousePointer2 } from 'lucide-react';

export interface CursorState {
  userId: string;
  userName: string;
  color: string;
  x: number;
  y: number;
  lastSeen: number;
}

const CURSOR_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4',
  '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6', '#f43f5e',
];

export function getUserColor(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = ((hash << 5) - hash + userId.charCodeAt(i)) | 0;
  }
  return CURSOR_COLORS[Math.abs(hash) % CURSOR_COLORS.length];
}

interface LiveCursorsProps {
  cursors: CursorState[];
  viewport: { x: number; y: number; zoom: number };
}

function LiveCursors({ cursors, viewport }: LiveCursorsProps) {
  if (cursors.length === 0) return null;

  return (
    <div className="absolute inset-0 pointer-events-none z-[48] overflow-hidden">
      {cursors.map((cursor) => {
        // Convert flow coordinates to screen coordinates
        const screenX = cursor.x * viewport.zoom + viewport.x;
        const screenY = cursor.y * viewport.zoom + viewport.y;

        // Don't render if off-screen
        if (screenX < -50 || screenY < -50 || screenX > window.innerWidth + 50 || screenY > window.innerHeight + 50) {
          return null;
        }

        return (
          <div
            key={cursor.userId}
            className="absolute transition-all duration-100 ease-out"
            style={{
              left: screenX,
              top: screenY,
              transform: 'translate(-2px, -2px)',
            }}
          >
            {/* Cursor icon */}
            <MousePointer2
              size={18}
              className="drop-shadow-md"
              style={{ color: cursor.color, fill: cursor.color }}
            />
            {/* Name label */}
            <div
              className="absolute left-4 top-3 px-2 py-0.5 rounded-full text-[10px] font-medium text-white whitespace-nowrap shadow-md"
              style={{ backgroundColor: cursor.color }}
            >
              {cursor.userName}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default memo(LiveCursors);
