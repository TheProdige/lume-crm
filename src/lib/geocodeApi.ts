import { supabase } from './supabase';

async function getAuthToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token || null;
}

export async function geocodeJob(jobId: string): Promise<void> {
  const token = await getAuthToken();
  if (!token) return;

  try {
    const res = await fetch('/api/geocode-job', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ jobId }),
    });
    if (!res.ok) {
      console.warn(`[geocode] failed for job ${jobId}: ${res.status}`);
    }
  } catch (err) {
    console.warn(`[geocode] network error for job ${jobId}`, err);
  }
}

export interface BatchGeocodeResult {
  ok: boolean;
  processed: number;
  succeeded: number;
  failed: number;
}

export async function geocodeBatch(): Promise<BatchGeocodeResult> {
  const token = await getAuthToken();
  if (!token) throw new Error('Not authenticated');

  const res = await fetch('/api/geocode-batch', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as any)?.error || `Batch geocode failed (${res.status})`);
  }

  return res.json() as Promise<BatchGeocodeResult>;
}
