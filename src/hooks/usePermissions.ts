import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import {
  type TeamRole,
  type PermissionsMap,
  getDefaultPermissions,
} from '../lib/permissions';

interface UsePermissionsResult {
  permissions: PermissionsMap | null;
  role: TeamRole | null;
  loading: boolean;
}

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
let cachedResult: UsePermissionsResult | null = null;
let cachedAt = 0;
let fetchPromise: Promise<UsePermissionsResult> | null = null;

async function fetchPermissions(): Promise<UsePermissionsResult> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { permissions: null, role: null, loading: false };

    const { data: membership, error } = await supabase
      .from('memberships')
      .select('role, permissions')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle();

    if (error || !membership) {
      // No membership found — grant full access (owner-level) so the app
      // is usable before teams/memberships are configured.
      return { permissions: getDefaultPermissions('owner'), role: 'owner', loading: false };
    }

    const role = membership.role as TeamRole;

    // Use custom permissions if present, otherwise derive from role
    const permissions: PermissionsMap =
      membership.permissions && typeof membership.permissions === 'object'
        ? (membership.permissions as PermissionsMap)
        : getDefaultPermissions(role);

    return { permissions, role, loading: false };
  } catch {
    return { permissions: null, role: null, loading: false };
  }
}

export function usePermissions(): UsePermissionsResult {
  const [result, setResult] = useState<UsePermissionsResult>(
    cachedResult ?? { permissions: null, role: null, loading: true }
  );

  useEffect(() => {
    // If we have a cached result that's still fresh, use it
    if (cachedResult && Date.now() - cachedAt < CACHE_TTL_MS) {
      setResult(cachedResult);
      return;
    }
    // Stale cache — refetch
    cachedResult = null;

    // If a fetch is already in progress, wait for it
    if (!fetchPromise) {
      fetchPromise = fetchPermissions();
    }

    let cancelled = false;

    fetchPromise.then((res) => {
      cachedResult = res;
      cachedAt = Date.now();
      fetchPromise = null;
      if (!cancelled) setResult(res);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return result;
}

/** Call this to invalidate the cached permissions (e.g. after role change). */
export function invalidatePermissionsCache() {
  cachedResult = null;
  cachedAt = 0;
  fetchPromise = null;
}
