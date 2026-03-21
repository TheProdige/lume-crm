/* ═══════════════════════════════════════════════════════════════
   Types — Advanced Notes System
   ═══════════════════════════════════════════════════════════════ */

export type NoteColor = 'red' | 'orange' | 'yellow' | 'green' | 'blue' | 'purple' | 'pink' | 'gray';

export type NoteEntityType = 'client' | 'job' | 'lead' | 'invoice' | 'payment' | 'team_member';

export interface Note {
  id: string;
  org_id: string;
  created_by: string;
  content: string;
  pinned: boolean;
  color: NoteColor | null;
  entity_type: NoteEntityType | null;
  entity_id: string | null;
  reminder_at: string | null;
  created_at: string;
  updated_at: string;
  // joined
  files?: NoteFile[];
  tags?: NoteTag[];
  checklist?: NoteChecklistItem[];
  creator_email?: string;
  creator_name?: string;
}

export interface NoteFile {
  id: string;
  note_id: string;
  file_url: string;
  file_name: string;
  file_type: string;
  file_size: number;
  created_at: string;
}

export interface NoteTag {
  id: string;
  note_id: string;
  tag: string;
  created_at: string;
}

export interface NoteHistoryEntry {
  id: string;
  note_id: string;
  old_content: string;
  new_content: string;
  edited_by: string;
  edited_at: string;
  // resolved
  editor_email?: string;
}

export interface NoteChecklistItem {
  id: string;
  note_id: string;
  text: string;
  is_checked: boolean;
  position: number;
  created_at: string;
}

export const NOTE_COLORS: { name: string; nameFr: string; value: NoteColor; hex: string; bg: string; border: string }[] = [
  { name: 'Red',    nameFr: 'Rouge',  value: 'red',    hex: '#fca5a5', bg: 'bg-red-50 dark:bg-red-950/30',       border: 'border-red-200 dark:border-red-800' },
  { name: 'Orange', nameFr: 'Orange', value: 'orange', hex: '#fdba74', bg: 'bg-orange-50 dark:bg-orange-950/30', border: 'border-orange-200 dark:border-orange-800' },
  { name: 'Yellow', nameFr: 'Jaune',  value: 'yellow', hex: '#fef08a', bg: 'bg-yellow-50 dark:bg-yellow-950/30', border: 'border-yellow-200 dark:border-yellow-800' },
  { name: 'Green',  nameFr: 'Vert',   value: 'green',  hex: '#86efac', bg: 'bg-green-50 dark:bg-green-950/30',   border: 'border-green-200 dark:border-green-800' },
  { name: 'Blue',   nameFr: 'Bleu',   value: 'blue',   hex: '#93c5fd', bg: 'bg-blue-50 dark:bg-blue-950/30',     border: 'border-blue-200 dark:border-blue-800' },
  { name: 'Purple', nameFr: 'Violet', value: 'purple', hex: '#c4b5fd', bg: 'bg-purple-50 dark:bg-purple-950/30', border: 'border-purple-200 dark:border-purple-800' },
  { name: 'Pink',   nameFr: 'Rose',   value: 'pink',   hex: '#f9a8d4', bg: 'bg-pink-50 dark:bg-pink-950/30',     border: 'border-pink-200 dark:border-pink-800' },
  { name: 'Gray',   nameFr: 'Gris',   value: 'gray',   hex: '#d1d5db', bg: 'bg-gray-50 dark:bg-gray-950/30',     border: 'border-gray-200 dark:border-gray-800' },
];

export const ENTITY_TYPE_META: Record<NoteEntityType, { label: string; labelFr: string; color: string }> = {
  client:      { label: 'Client',      labelFr: 'Client',     color: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' },
  job:         { label: 'Job',         labelFr: 'Travail',    color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
  lead:        { label: 'Lead',        labelFr: 'Lead',       color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' },
  invoice:     { label: 'Invoice',     labelFr: 'Facture',    color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300' },
  payment:     { label: 'Payment',     labelFr: 'Paiement',   color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' },
  team_member: { label: 'Team Member', labelFr: 'Membre',     color: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300' },
};
