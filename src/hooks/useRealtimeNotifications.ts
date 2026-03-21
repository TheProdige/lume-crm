import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { RealtimePostgresInsertPayload, RealtimePostgresUpdatePayload } from '@supabase/supabase-js';

interface Notification {
  id: string;
  is_read: boolean;
  [key: string]: unknown;
}

export function useRealtimeNotifications(enabled: boolean) {
  const [unreadCount, setUnreadCount] = useState(0);

  const resetCount = useCallback(() => {
    setUnreadCount(0);
  }, []);

  useEffect(() => {
    if (!enabled) return;

    // Initial count fetch
    const fetchCount = async () => {
      const { count } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('is_read', false);
      setUnreadCount(count || 0);
    };
    fetchCount();

    // Subscribe to realtime changes on the notifications table
    const channel = supabase
      .channel('notifications-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications' },
        (payload: RealtimePostgresInsertPayload<Notification>) => {
          // New notification inserted — if it's unread, increment
          if (!payload.new.is_read) {
            setUnreadCount((prev) => prev + 1);
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'notifications' },
        (payload: RealtimePostgresUpdatePayload<Notification>) => {
          // If is_read changed from false to true, decrement
          if (payload.old && !payload.old.is_read && payload.new.is_read) {
            setUnreadCount((prev) => Math.max(0, prev - 1));
          }
          // If is_read changed from true to false (unlikely but handle), increment
          if (payload.old && payload.old.is_read && !payload.new.is_read) {
            setUnreadCount((prev) => prev + 1);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [enabled]);

  return { unreadCount, resetCount };
}
