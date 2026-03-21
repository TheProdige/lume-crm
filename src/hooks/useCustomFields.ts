import { useState, useEffect, useCallback } from 'react';
import {
  listColumns,
  getValuesForRecords,
  type CustomColumn,
  type EntityType,
} from '../lib/customFieldsApi';

export function useCustomFields(entity: EntityType, recordIds: string[]) {
  const [columns, setColumns] = useState<CustomColumn[]>([]);
  const [values, setValues] = useState<Record<string, Record<string, any>>>({});
  const [loading, setLoading] = useState(true);

  // Load columns once per entity
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const cols = await listColumns(entity);
        if (!cancelled) setColumns(cols.filter((c) => c.visible));
      } catch (e) {
        console.error('Failed to load custom columns:', e);
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [entity]);

  // Load values when record IDs change
  useEffect(() => {
    if (recordIds.length === 0) {
      setValues({});
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const vals = await getValuesForRecords(recordIds);
        if (!cancelled) setValues(vals);
      } catch (e) {
        console.error('Failed to load custom field values:', e);
      }
    })();
    return () => { cancelled = true; };
  }, [recordIds.join(',')]);

  // Update a single value locally (optimistic)
  const updateLocalValue = useCallback((recordId: string, columnId: string, newValue: any) => {
    setValues((prev) => ({
      ...prev,
      [recordId]: { ...(prev[recordId] || {}), [columnId]: newValue },
    }));
  }, []);

  return { columns, values, loading, updateLocalValue };
}
