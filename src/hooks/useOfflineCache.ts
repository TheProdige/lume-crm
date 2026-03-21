/* useOfflineCache — caches critical data in localStorage for offline access
   Stores: today's jobs, client contacts, schedule.
   Returns cached data when network fails.
*/

import { useState, useEffect, useCallback } from 'react';

const CACHE_PREFIX = 'lume_offline_';
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

export function useOfflineCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  deps: any[] = [],
): { data: T | null; loading: boolean; isOffline: boolean; refresh: () => void } {
  const cacheKey = `${CACHE_PREFIX}${key}`;
  const [data, setData] = useState<T | null>(() => {
    try {
      const raw = localStorage.getItem(cacheKey);
      if (raw) {
        const entry: CacheEntry<T> = JSON.parse(raw);
        if (Date.now() - entry.timestamp < CACHE_TTL_MS) return entry.data;
      }
    } catch { /* */ }
    return null;
  });
  const [loading, setLoading] = useState(!data);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  // Listen for online/offline
  useEffect(() => {
    const goOnline = () => setIsOffline(false);
    const goOffline = () => setIsOffline(true);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  const doFetch = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetcher();
      setData(result);
      // Save to cache
      const entry: CacheEntry<T> = { data: result, timestamp: Date.now() };
      try { localStorage.setItem(cacheKey, JSON.stringify(entry)); } catch { /* quota */ }
      setIsOffline(false);
    } catch {
      // Network failed — use cache
      setIsOffline(true);
    } finally {
      setLoading(false);
    }
  }, [cacheKey, fetcher]);

  useEffect(() => {
    void doFetch();
  }, deps);

  // Auto-refresh when coming back online
  useEffect(() => {
    if (!isOffline) {
      void doFetch();
    }
  }, [isOffline]);

  return { data, loading, isOffline, refresh: doFetch };
}

/** Clear all offline cache entries */
export function clearOfflineCache() {
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k?.startsWith(CACHE_PREFIX)) keys.push(k);
  }
  keys.forEach((k) => localStorage.removeItem(k));
}
