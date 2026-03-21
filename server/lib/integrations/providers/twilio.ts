/* ═══════════════════════════════════════════════════════════════
   Provider — Twilio
   Auth type: credentials (Account SID + Auth Token)
   Validates via GET /2010-04-01/Accounts/{SID}.json
   ═══════════════════════════════════════════════════════════════ */

import { registerProvider } from '../registry';
import type { ProviderDefinition, DecryptedCredentials, TestResult } from '../types';

const twilio: ProviderDefinition = {
  slug: 'twilio',
  display_name: 'Twilio',
  auth_type: 'credentials',

  credential_fields: [
    {
      key: 'account_sid',
      label: 'Account SID',
      type: 'text',
      required: true,
      placeholder: 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
      help_text: 'Found in Twilio Console → Account Info',
      validation_pattern: '^AC[a-f0-9]{32}$',
    },
    {
      key: 'auth_token',
      label: 'Auth Token',
      type: 'password',
      required: true,
      placeholder: 'Your Twilio auth token',
      help_text: 'Found in Twilio Console → Account Info',
    },
    {
      key: 'phone_number',
      label: 'Phone Number',
      type: 'text',
      required: false,
      placeholder: '+1234567890',
      help_text: 'Your Twilio phone number in E.164 format (optional)',
      validation_pattern: '^\\+[1-9]\\d{1,14}$',
    },
  ],

  testConnection: async (creds: DecryptedCredentials): Promise<TestResult> => {
    const sid = creds.extra?.account_sid;
    const token = creds.extra?.auth_token || creds.api_secret;
    if (!sid || !token) {
      return { success: false, error: 'Account SID and Auth Token are required' };
    }

    try {
      const basicAuth = Buffer.from(`${sid}:${token}`).toString('base64');
      const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}.json`, {
        headers: { Authorization: `Basic ${basicAuth}` },
      });

      if (res.status === 401) {
        return { success: false, error: 'Invalid Account SID or Auth Token' };
      }

      if (!res.ok) {
        return { success: false, error: `Twilio API error: HTTP ${res.status}` };
      }

      const account = await res.json() as Record<string, unknown>;
      return {
        success: true,
        account_name: (account as any).friendly_name || 'Twilio Account',
        account_id: (account as any).sid,
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to connect to Twilio',
      };
    }
  },
};

export function registerTwilio(): void {
  registerProvider(twilio);
}
