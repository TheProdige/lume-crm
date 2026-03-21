/* ═══════════════════════════════════════════════════════════════
   Integration Provider Types
   ═══════════════════════════════════════════════════════════════ */

export type AuthType = 'oauth' | 'api_key' | 'credentials' | 'manual' | 'internal';

export type ConnectionStatus =
  | 'not_connected'
  | 'setup_required'
  | 'pending_authorization'
  | 'connected'
  | 'token_expired'
  | 'reconnect_required'
  | 'error'
  | 'disabled';

export interface CredentialField {
  key: string;
  label: string;
  type: 'text' | 'password' | 'url';
  required: boolean;
  placeholder?: string;
  help_text?: string;
  validation_pattern?: string;
}

export interface OAuthConfig {
  authorize_url: string;
  token_url: string;
  scopes: string[];
  /** Use PKCE (Proof Key for Code Exchange) */
  use_pkce?: boolean;
  /** Extra params to send during authorization */
  extra_authorize_params?: Record<string, string>;
}

export interface ProviderDefinition {
  /** Unique slug matching app_id in DB, e.g. 'stripe' */
  slug: string;
  display_name: string;
  auth_type: AuthType;

  /** For OAuth providers */
  oauth?: OAuthConfig;

  /** For API key / credential providers */
  credential_fields?: CredentialField[];

  /** Environment variable names for client ID/secret (OAuth providers) */
  env_client_id?: string;
  env_client_secret?: string;

  /**
   * Build the authorize URL for OAuth.
   * Default implementation uses oauth config. Override for custom logic.
   */
  buildAuthorizeUrl?: (params: {
    clientId: string;
    redirectUri: string;
    state: string;
    codeVerifier?: string;
    scopes: string[];
  }) => string;

  /**
   * Exchange authorization code for tokens.
   * Must be implemented for OAuth providers.
   */
  exchangeCode?: (params: {
    code: string;
    redirectUri: string;
    clientId: string;
    clientSecret: string;
    codeVerifier?: string;
  }) => Promise<TokenResponse>;

  /**
   * Refresh an expired access token.
   */
  refreshToken?: (params: {
    refreshToken: string;
    clientId: string;
    clientSecret: string;
  }) => Promise<TokenResponse>;

  /**
   * Test the connection to verify it's working.
   * Should make a real API call to the provider.
   */
  testConnection: (credentials: DecryptedCredentials) => Promise<TestResult>;

  /**
   * Revoke access (disconnect) at the provider side.
   * Optional — not all providers support programmatic revocation.
   */
  revokeAccess?: (credentials: DecryptedCredentials) => Promise<void>;
}

export interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
  scope?: string;
  /** Provider-specific account info */
  account_name?: string;
  account_id?: string;
  raw?: Record<string, unknown>;
}

export interface TestResult {
  success: boolean;
  account_name?: string;
  account_id?: string;
  message?: string;
  error?: string;
}

export interface DecryptedCredentials {
  access_token?: string;
  refresh_token?: string;
  api_key?: string;
  api_secret?: string;
  /** Additional credentials stored as key-value */
  extra?: Record<string, string>;
}

export interface ConnectionRecord {
  id: string;
  org_id: string;
  app_id: string;
  status: ConnectionStatus;
  auth_type: AuthType | null;
  connected_account_name: string | null;
  connected_account_id: string | null;
  scopes_granted: string[] | null;
  encrypted_access_token: string | null;
  encrypted_refresh_token: string | null;
  token_expires_at: string | null;
  encrypted_credentials: Record<string, unknown>;
  last_tested: string | null;
  last_test_result: string | null;
  last_error: string | null;
  error_message: string | null;
  connected_at: string | null;
  disconnected_at: string | null;
  connected_by: string | null;
  created_at: string;
  updated_at: string;
}

/** Safe connection info returned to frontend (no secrets) */
export interface ConnectionInfo {
  id: string;
  app_id: string;
  status: ConnectionStatus;
  auth_type: AuthType | null;
  connected_account_name: string | null;
  connected_account_id: string | null;
  scopes_granted: string[] | null;
  last_tested: string | null;
  last_test_result: string | null;
  last_error: string | null;
  connected_at: string | null;
  disconnected_at: string | null;
}
