/* ═══════════════════════════════════════════════════════════════
   Provider — QuickBooks Online
   Auth type: OAuth 2.0
   Uses Intuit's OAuth endpoints.
   ═══════════════════════════════════════════════════════════════ */

import { registerProvider } from '../registry';
import type { ProviderDefinition, DecryptedCredentials, TestResult, TokenResponse } from '../types';

const QB_SANDBOX = process.env.QUICKBOOKS_SANDBOX === 'true';
const QB_BASE = QB_SANDBOX
  ? 'https://sandbox-quickbooks.api.intuit.com'
  : 'https://quickbooks.api.intuit.com';

const quickbooks: ProviderDefinition = {
  slug: 'quickbooks',
  display_name: 'QuickBooks Online',
  auth_type: 'oauth',

  env_client_id: 'QUICKBOOKS_CLIENT_ID',
  env_client_secret: 'QUICKBOOKS_CLIENT_SECRET',

  oauth: {
    authorize_url: 'https://appcenter.intuit.com/connect/oauth2',
    token_url: 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer',
    scopes: ['com.intuit.quickbooks.accounting'],
    extra_authorize_params: {
      response_type: 'code',
    },
  },

  exchangeCode: async (params): Promise<TokenResponse> => {
    const basicAuth = Buffer.from(`${params.clientId}:${params.clientSecret}`).toString('base64');

    const res = await fetch('https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
        Authorization: `Basic ${basicAuth}`,
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: params.code,
        redirect_uri: params.redirectUri,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`QuickBooks token exchange failed (${res.status}): ${body}`);
    }

    const data = await res.json() as Record<string, unknown>;
    return {
      access_token: data.access_token as string,
      refresh_token: data.refresh_token as string | undefined,
      expires_in: data.expires_in as number | undefined,
      token_type: data.token_type as string | undefined,
      raw: data,
    };
  },

  refreshToken: async (params): Promise<TokenResponse> => {
    const basicAuth = Buffer.from(`${params.clientId}:${params.clientSecret}`).toString('base64');

    const res = await fetch('https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
        Authorization: `Basic ${basicAuth}`,
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: params.refreshToken,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`QuickBooks token refresh failed (${res.status}): ${body}`);
    }

    const data = await res.json() as Record<string, unknown>;
    return {
      access_token: data.access_token as string,
      refresh_token: data.refresh_token as string | undefined,
      expires_in: data.expires_in as number | undefined,
    };
  },

  testConnection: async (creds: DecryptedCredentials): Promise<TestResult> => {
    if (!creds.access_token) {
      return { success: false, error: 'No access token' };
    }

    try {
      // Get company info to verify connection
      const res = await fetch(`${QB_BASE}/v3/company/companyinfo/companyinfo`, {
        headers: {
          Authorization: `Bearer ${creds.access_token}`,
          Accept: 'application/json',
        },
      });

      // QuickBooks returns 401 for expired/invalid tokens
      if (res.status === 401) {
        return { success: false, error: 'Access token expired or invalid' };
      }

      if (!res.ok) {
        return { success: false, error: `QuickBooks API error: HTTP ${res.status}` };
      }

      const data = await res.json() as Record<string, unknown>;
      const companyInfo = (data as any)?.CompanyInfo;
      return {
        success: true,
        account_name: companyInfo?.CompanyName || 'QuickBooks Company',
        account_id: companyInfo?.Id || undefined,
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to connect to QuickBooks',
      };
    }
  },

  revokeAccess: async (creds: DecryptedCredentials): Promise<void> => {
    if (!creds.refresh_token) return;

    const clientId = process.env.QUICKBOOKS_CLIENT_ID || '';
    const clientSecret = process.env.QUICKBOOKS_CLIENT_SECRET || '';
    const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    await fetch('https://developer.api.intuit.com/v2/oauth2/tokens/revoke', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${basicAuth}`,
      },
      body: JSON.stringify({ token: creds.refresh_token }),
    }).catch(() => { /* best effort */ });
  },
};

export function registerQuickBooks(): void {
  registerProvider(quickbooks);
}
