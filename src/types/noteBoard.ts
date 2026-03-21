/* ═══════════════════════════════════════════════════════════════
   Types — Note Boards (Infinite Canvas)
   ═══════════════════════════════════════════════════════════════ */

export type BoardType = 'freeform' | 'meeting' | 'brainstorm' | 'project_plan' | 'retrospective' | 'kanban';

export type NoteItemType =
  | 'sticky_note' | 'text' | 'checklist' | 'image' | 'file'
  | 'link' | 'shape' | 'diagram_block' | 'frame' | 'section_header';

export type ShapeType = 'rectangle' | 'ellipse' | 'diamond' | 'triangle' | 'arrow_right' | 'cloud';
export type TextAlign = 'left' | 'center' | 'right';
export type BorderStyle = 'none' | 'solid' | 'dashed' | 'dotted';
export type LineType = 'bezier' | 'straight' | 'step' | 'smoothstep';
export type EntityType = 'lead' | 'client' | 'job' | 'invoice' | 'payment' | 'team_member';

export interface NoteBoard {
  id: string;
  org_id: string;
  created_by: string;
  title: string;
  description: string | null;
  board_type: BoardType;
  thumbnail_url: string | null;
  is_template: boolean;
  tags: string[];
  viewport_x: number;
  viewport_y: number;
  viewport_zoom: number;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
  archived_by: string | null;
  // joined
  item_count?: number;
  creator_name?: string;
}

export interface ChecklistItem {
  id: string;
  text: string;
  checked: boolean;
}

export interface NoteItem {
  id: string;
  board_id: string;
  created_by: string;
  item_type: NoteItemType;
  pos_x: number;
  pos_y: number;
  width: number;
  height: number;
  rotation: number;
  z_index: number;
  content: string;
  rich_content: { checklist?: ChecklistItem[] } | null;
  color: string;
  font_size: number;
  text_align: TextAlign;
  shape_type: ShapeType | null;
  border_style: BorderStyle;
  file_url: string | null;
  file_name: string | null;
  file_type: string | null;
  file_size: number | null;
  link_url: string | null;
  link_title: string | null;
  link_preview: string | null;
  locked: boolean;
  created_at: string;
  updated_at: string;
  // joined
  entity_links?: NoteEntityLink[];
}

export interface NoteConnection {
  id: string;
  board_id: string;
  source_id: string;
  target_id: string;
  label: string | null;
  line_type: LineType;
  color: string;
  stroke_width: number;
  animated: boolean;
  arrow_start: boolean;
  arrow_end: boolean;
  created_at: string;
}

export interface NoteEntityLink {
  id: string;
  item_id: string;
  entity_type: EntityType;
  entity_id: string;
  created_at: string;
  // resolved
  entity_label?: string;
}

// Color presets for sticky notes
export const STICKY_COLORS = [
  { name: 'Yellow', value: '#fef08a' },
  { name: 'Blue', value: '#93c5fd' },
  { name: 'Green', value: '#86efac' },
  { name: 'Pink', value: '#f9a8d4' },
  { name: 'Purple', value: '#c4b5fd' },
  { name: 'Orange', value: '#fdba74' },
  { name: 'Red', value: '#fca5a5' },
  { name: 'Teal', value: '#5eead4' },
  { name: 'White', value: '#ffffff' },
  { name: 'Gray', value: '#d1d5db' },
] as const;

export const BOARD_TYPE_META: Record<BoardType, { label: string; labelFr: string; icon: string; description: string }> = {
  freeform:       { label: 'Freeform',       labelFr: 'Libre',           icon: 'Layout',        description: 'Blank canvas — anything goes' },
  meeting:        { label: 'Meeting Notes',  labelFr: 'Notes de réunion', icon: 'Users',         description: 'Structured meeting board' },
  brainstorm:     { label: 'Brainstorm',     labelFr: 'Brainstorm',      icon: 'Lightbulb',     description: 'Ideas & clustering' },
  project_plan:   { label: 'Project Plan',   labelFr: 'Plan de projet',  icon: 'FolderKanban',  description: 'Visual project planning' },
  retrospective:  { label: 'Retrospective',  labelFr: 'Rétrospective',   icon: 'RotateCcw',     description: 'What went well / improve / action' },
  kanban:         { label: 'Kanban',         labelFr: 'Kanban',          icon: 'Kanban',        description: 'Columns-based task board' },
};
