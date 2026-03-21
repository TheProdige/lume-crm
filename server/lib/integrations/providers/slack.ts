/* ═══════════════════════════════════════════════════════════════
   Provider — Slack (Webhook-based)
   Auth type: api_key (Incoming Webhook URL)
   Validates by sending a test message to the webhook.
   ═══════════════════════════════════════════════════════════════ */

import { registerProvider } from '../registry';
import type { ProviderDefinition, DecryptedCredentials, TestResult } from '../types';

const slack: ProviderDefinition = {
  slug: 'slack',
  display_name: 'Slack',
  auth_type: 'api_key',

  credential_fields: [
    {
      key: 'webhook_url',
      label: 'Incoming Webhook URL',
      type: 'url',
      required: true,
      placeholder: 'https://hooks.slack.com/services/...',
      help_text: 'Create an Incoming Webhook in Slack App Settings',
    },
    {
      key: 'channel',
      label: 'Default Channel',
      type: 'text',
      required: false,
      placeholder: '#general',
    },
  ],

  testConnection: async (creds: DecryptedCredentials): Promise<TestResult> => {
    const webhookUrl = creds.extra?.webhook_url;
    if (!webhookUrl) {
      return { success: false, error: 'No webhook URL provided' };
    }

    try {
      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: '✅ Lume CRM connected successfully!' }),
      });

      if (!res.ok) {
        const body = await res.text();
        return { success: false, error: `Slack webhook error: ${body || res.status}` };
      }

      return {
        success: true,
        account_name: creds.extra?.channel || 'Slack Workspace',
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to connect to Slack',
      };
    }
  },
};

export function registerSlack(): void {
  registerProvider(slack);
}
