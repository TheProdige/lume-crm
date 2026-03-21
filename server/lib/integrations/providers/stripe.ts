/* ═══════════════════════════════════════════════════════════════
   Provider — Stripe
   Auth type: API key (secret key)
   Validates via GET /v1/account
   ═══════════════════════════════════════════════════════════════ */

import { registerProvider } from '../registry';
import type { ProviderDefinition, DecryptedCredentials, TestResult } from '../types';

const stripe: ProviderDefinition = {
  slug: 'stripe',
  display_name: 'Stripe',
  auth_type: 'api_key',

  credential_fields: [
    {
      key: 'secret_key',
      label: 'Secret Key',
      type: 'password',
      required: true,
      placeholder: 'sk_live_... or sk_test_...',
      help_text: 'Found in Stripe Dashboard → Developers → API keys',
      validation_pattern: '^sk_(live|test)_[A-Za-z0-9]+$',
    },
  ],

  testConnection: async (creds: DecryptedCredentials): Promise<TestResult> => {
    const key = creds.api_key || creds.extra?.secret_key;
    if (!key) {
      return { success: false, error: 'No API key provided' };
    }

    try {
      const res = await fetch('https://api.stripe.com/v1/account', {
        headers: { Authorization: `Bearer ${key}` },
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const msg = (body as any)?.error?.message || `HTTP ${res.status}`;
        return { success: false, error: `Stripe API error: ${msg}` };
      }

      const account = await res.json();
      return {
        success: true,
        account_name: (account as any).settings?.dashboard?.display_name
          || (account as any).business_profile?.name
          || (account as any).email
          || 'Stripe Account',
        account_id: (account as any).id,
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to connect to Stripe',
      };
    }
  },
};

export function registerStripe(): void {
  registerProvider(stripe);
}
