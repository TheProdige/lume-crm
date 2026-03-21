import type { SupabaseClient } from '@supabase/supabase-js';

interface TwilioConfig {
  client: any;
  phoneNumber: string;
}

/**
 * Insert a notification row into the notifications table.
 */
export async function createNotification(
  supabase: SupabaseClient,
  orgId: string,
  title: string,
  body: string,
  referenceId?: string | null,
  type: string = 'automation',
) {
  const { error } = await supabase.from('notifications').insert({
    org_id: orgId,
    type,
    title,
    body,
    reference_id: referenceId ?? null,
  });
  if (error) {
    console.error('[notifications] insert failed:', error.message);
  }
}

/**
 * Send an SMS via Twilio if configured. Silently swallows errors.
 */
export async function sendSmsIfConfigured(
  twilio: TwilioConfig | null,
  to: string | null | undefined,
  body: string,
) {
  if (!twilio || !to) return;
  try {
    await twilio.client.messages.create({
      body,
      from: twilio.phoneNumber,
      to,
    });
  } catch (err: any) {
    console.error('[sms] send failed:', err.message);
  }
}

/**
 * Apply {variable} substitution on a template string.
 * Also supports legacy [variable] syntax for backward compat.
 */
export function applyTemplate(
  template: string,
  vars: Record<string, string | null | undefined>,
): string {
  return template
    .replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? '')
    .replace(/\[(\w+)\]/g, (_, key) => vars[key] ?? '');
}
