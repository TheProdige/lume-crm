// ── Lume CRM Integration Registry ─────────────────────────────────
// Centralized data model for all marketplace integrations.
// Scalable: add new apps by appending to INTEGRATIONS array.

export type ConnectionType = 'oauth' | 'api_key' | 'webhook' | 'manual' | 'internal' | 'coming_soon';
export type AppStatus = 'available' | 'connected' | 'coming_soon' | 'requires_setup' | 'error';
export type AppCategory =
  | 'Accounting & Payments'
  | 'Automation'
  | 'Communication'
  | 'Marketing'
  | 'Reviews'
  | 'Forms'
  | 'Maps & Dispatch'
  | 'Field Operations'
  | 'Documents & Signatures'
  | 'File Storage'
  | 'Analytics'
  | 'AI'
  | 'Developer Tools';

export interface AuthField {
  key: string;
  label: string;
  placeholder: string;
  type: 'text' | 'password' | 'url' | 'select';
  required: boolean;
  options?: string[]; // for select type
  helpText?: string;
}

export interface Integration {
  id: string;
  name: string;
  slug: string;
  category: AppCategory;
  description_short: string;
  description_long: string;
  logo_color: string;         // brand color for tile bg
  logo_text_color?: string;   // text color on tile (default white)
  logo_initials: string;      // 1-3 char shown in logo tile
  logo_url?: string;          // official logo image URL (light mode)
  logo_dark_url?: string;     // official logo image URL (dark mode, optional)
  featured: boolean;
  connection_type: ConnectionType;
  auth_fields: AuthField[];
  supported_features: string[];
  docs_url?: string;
  webhook_instructions?: string;
  oauth_provider?: string;
  official_site_url?: string;  // link to the app's main website
  official_setup_url?: string; // link to the app's setup/developer page for external auth flows
}

// ── All Integrations ──────────────────────────────────────────────

// ── SVG data URI helper (white icon text on transparent bg) ─────
const svgIcon = (text: string, fontSize = 14) =>
  `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'%3E%3Ctext x='20' y='${fontSize > 12 ? 27 : 26}' text-anchor='middle' font-family='system-ui,-apple-system,sans-serif' font-weight='700' font-size='${fontSize}' fill='white'%3E${encodeURIComponent(text)}%3C/text%3E%3C/svg%3E`;

// Slack icon (4 dots)
const slackSvg = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='white'%3E%3Cpath d='M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zm1.271 0a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zm0 1.271a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zm10.124 2.521a2.528 2.528 0 0 1 2.52-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.52V8.834zm-1.271 0a2.528 2.528 0 0 1-2.521 2.521 2.528 2.528 0 0 1-2.521-2.521V2.522A2.528 2.528 0 0 1 15.166 0a2.528 2.528 0 0 1 2.521 2.522v6.312zm-2.521 10.124a2.528 2.528 0 0 1 2.521 2.52A2.528 2.528 0 0 1 15.166 24a2.528 2.528 0 0 1-2.521-2.522v-2.52h2.521zm0-1.271a2.528 2.528 0 0 1-2.521-2.521 2.528 2.528 0 0 1 2.521-2.521h6.312A2.528 2.528 0 0 1 24 15.166a2.528 2.528 0 0 1-2.522 2.521h-6.312z'/%3E%3C/svg%3E`;

// Twilio icon (circle with dots)
const twilioSvg = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='white'%3E%3Cpath d='M12 0C5.381 0 0 5.381 0 12s5.381 12 12 12 12-5.381 12-12S18.619 0 12 0zm0 20.005c-4.419 0-7.995-3.576-7.995-7.995S7.581 4.005 12 4.005s7.995 3.576 7.995 7.995-3.576 7.995-7.995 7.995zm-1.726-6.269a2.269 2.269 0 1 1 0-4.538 2.269 2.269 0 0 1 0 4.538zm5.452 0a2.269 2.269 0 1 1 0-4.538 2.269 2.269 0 0 1 0 4.538z'/%3E%3C/svg%3E`;

// OpenAI icon
const openaiSvg = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='white'%3E%3Cpath d='M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.872zm16.597 3.855l-5.833-3.387L15.119 7.2a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.407-.667zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08L8.704 5.46a.795.795 0 0 0-.393.681zm1.097-2.365l2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z'/%3E%3C/svg%3E`;

// DocuSign icon
const docusignSvg = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%231B0B39'%3E%3Cpath d='M4.724 10.476L12 3.2l7.276 7.276L12 17.752 4.724 10.476zM12 0L2.476 9.524 12 19.048l9.524-9.524L12 0zm0 22.476l-2.476-2.476H4.8v4.8h14.4V20h-4.724L12 22.476z'/%3E%3C/svg%3E`;

// PandaDoc icon
const pandadocSvg = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'%3E%3Crect x='8' y='4' width='24' height='32' rx='3' fill='none' stroke='white' stroke-width='2.5'/%3E%3Cline x1='13' y1='13' x2='27' y2='13' stroke='white' stroke-width='2' stroke-linecap='round'/%3E%3Cline x1='13' y1='19' x2='27' y2='19' stroke='white' stroke-width='2' stroke-linecap='round'/%3E%3Cline x1='13' y1='25' x2='21' y2='25' stroke='white' stroke-width='2' stroke-linecap='round'/%3E%3C/svg%3E`;

// Klaviyo icon
const klaviyoSvg = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'%3E%3Cpolygon points='8,6 32,20 8,34' fill='white'/%3E%3C/svg%3E`;

// OneDrive icon (cloud)
const onedriveSvg = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='white'%3E%3Cpath d='M19.35 10.04A7.49 7.49 0 0 0 12 4C9.11 4 6.6 5.64 5.35 8.04A5.994 5.994 0 0 0 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z'/%3E%3C/svg%3E`;

// JotForm icon (form/clipboard)
const jotformSvg = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'%3E%3Crect x='9' y='6' width='22' height='30' rx='2' fill='none' stroke='white' stroke-width='2.5'/%3E%3Crect x='15' y='3' width='10' height='6' rx='1.5' fill='white'/%3E%3Cline x1='15' y1='16' x2='26' y2='16' stroke='white' stroke-width='2' stroke-linecap='round'/%3E%3Cline x1='15' y1='22' x2='26' y2='22' stroke='white' stroke-width='2' stroke-linecap='round'/%3E%3Cline x1='15' y1='28' x2='22' y2='28' stroke='white' stroke-width='2' stroke-linecap='round'/%3E%3C/svg%3E`;

// Helcim icon (card/payment)
const helcimSvg = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'%3E%3Crect x='4' y='9' width='32' height='22' rx='3' fill='none' stroke='white' stroke-width='2.5'/%3E%3Cline x1='4' y1='16' x2='36' y2='16' stroke='white' stroke-width='2.5'/%3E%3Crect x='8' y='23' width='8' height='4' rx='1' fill='white'/%3E%3C/svg%3E`;

// FastField icon (mobile phone/form)
const fastfieldSvg = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'%3E%3Crect x='11' y='4' width='18' height='32' rx='3' fill='none' stroke='white' stroke-width='2.5'/%3E%3Cline x1='11' y1='10' x2='29' y2='10' stroke='white' stroke-width='1.5'/%3E%3Cline x1='11' y1='30' x2='29' y2='30' stroke='white' stroke-width='1.5'/%3E%3Ccircle cx='20' cy='33' r='1.5' fill='white'/%3E%3Cline x1='15' y1='16' x2='25' y2='16' stroke='white' stroke-width='1.5' stroke-linecap='round'/%3E%3Cline x1='15' y1='20' x2='25' y2='20' stroke='white' stroke-width='1.5' stroke-linecap='round'/%3E%3Cline x1='15' y1='24' x2='21' y2='24' stroke='white' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E`;


// Plaid icon (grid pattern)
const plaidSvg = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'%3E%3Crect x='6' y='6' width='11' height='11' rx='2' fill='white'/%3E%3Crect x='23' y='6' width='11' height='11' rx='2' fill='white' opacity='.7'/%3E%3Crect x='6' y='23' width='11' height='11' rx='2' fill='white' opacity='.7'/%3E%3Crect x='23' y='23' width='11' height='11' rx='2' fill='white' opacity='.4'/%3E%3C/svg%3E`;

// Traccar icon (GPS satellite marker)
const traccarSvg = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'%3E%3Ccircle cx='20' cy='16' r='4' fill='white'/%3E%3Cpath d='M20 22c-5.5 0-10 2.5-10 5.5V30h20v-2.5c0-3-4.5-5.5-10-5.5z' fill='white' opacity='.7'/%3E%3Ccircle cx='20' cy='16' r='9' fill='none' stroke='white' stroke-width='1.5' stroke-dasharray='3 2' opacity='.5'/%3E%3Ccircle cx='20' cy='16' r='13' fill='none' stroke='white' stroke-width='1' stroke-dasharray='2 3' opacity='.3'/%3E%3C/svg%3E`;

// Life360 icon (circle with location pin)
const life360Svg = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'%3E%3Ccircle cx='20' cy='20' r='14' fill='none' stroke='white' stroke-width='2'/%3E%3Cpath d='M20 10a6 6 0 0 1 6 6c0 4.5-6 10-6 10s-6-5.5-6-10a6 6 0 0 1 6-6z' fill='white'/%3E%3Ccircle cx='20' cy='16' r='2.5' fill='%2366bb6a'/%3E%3C/svg%3E`;

export const INTEGRATIONS: Integration[] = [
  // ════════════════════════════════════════════════════════════════
  // ACCOUNTING & PAYMENTS
  // ════════════════════════════════════════════════════════════════
  {
    id: 'stripe',
    name: 'Stripe',
    slug: 'stripe',
    category: 'Accounting & Payments',
    description_short: 'Accept payments, manage subscriptions, and handle invoicing.',
    description_long: 'Stripe is a full-stack payments platform. Connect your Stripe account to process credit card payments directly from Lume CRM invoices, set up recurring billing, and automatically reconcile payments. Stripe handles PCI compliance so you don\'t have to worry about security.',
    logo_color: '#635BFF',
    logo_initials: 'S',
    logo_url: 'https://cdn.simpleicons.org/stripe/white',
    featured: true,
    connection_type: 'api_key',
    auth_fields: [
      { key: 'publishable_key', label: 'Publishable Key', placeholder: 'pk_live_...', type: 'text', required: true, helpText: 'Found in Stripe Dashboard → Developers → API Keys' },
      { key: 'secret_key', label: 'Secret Key', placeholder: 'sk_live_...', type: 'password', required: true, helpText: 'Keep this secret. Never share it publicly.' },
      { key: 'webhook_secret', label: 'Webhook Signing Secret', placeholder: 'whsec_...', type: 'password', required: false, helpText: 'Required for real-time payment updates' },
    ],
    supported_features: ['Online invoice payments', 'Recurring billing', 'Payment links', 'Automatic reconciliation', 'Refund management', 'Multi-currency support'],
    docs_url: 'https://stripe.com/docs',
    official_site_url: 'https://stripe.com',
    official_setup_url: 'https://dashboard.stripe.com/apikeys',
  },
  {
    id: 'quickbooks',
    name: 'QuickBooks Online',
    slug: 'quickbooks',
    category: 'Accounting & Payments',
    description_short: 'Sync invoices, expenses, and clients with QuickBooks.',
    description_long: 'Automatically sync your Lume CRM invoices, payments, and client data with QuickBooks Online. Keep your books up to date without manual data entry. Two-way sync ensures changes in either system are reflected everywhere.',
    logo_color: '#2CA01C',
    logo_initials: 'QB',
    logo_url: 'https://cdn.simpleicons.org/quickbooks/white',
    featured: true,
    connection_type: 'oauth',
    oauth_provider: 'Intuit',
    auth_fields: [
      { key: 'client_id', label: 'Client ID', placeholder: 'Your QuickBooks app Client ID', type: 'text', required: true },
      { key: 'client_secret', label: 'Client Secret', placeholder: 'Your QuickBooks app Client Secret', type: 'password', required: true },
      { key: 'realm_id', label: 'Company ID (Realm ID)', placeholder: '123456789', type: 'text', required: true, helpText: 'Found in QuickBooks → Settings → Account and Settings' },
    ],
    supported_features: ['Two-way invoice sync', 'Client sync', 'Payment reconciliation', 'Expense categorization', 'Tax-ready reports', 'Chart of accounts mapping'],
    docs_url: 'https://developer.intuit.com/app/developer/qbo/docs/get-started',
    official_site_url: 'https://quickbooks.intuit.com',
    official_setup_url: 'https://developer.intuit.com/app/developer/dashboard',
  },
  {
    id: 'xero',
    name: 'Xero',
    slug: 'xero',
    category: 'Accounting & Payments',
    description_short: 'Cloud accounting software for small businesses.',
    description_long: 'Connect Xero to sync invoices, contacts, and payments. Automate your bookkeeping workflow and keep financial data consistent across platforms. Xero\'s powerful reporting works seamlessly with your CRM data.',
    logo_color: '#13B5EA',
    logo_initials: 'X',
    logo_url: 'https://cdn.simpleicons.org/xero/white',
    featured: false,
    connection_type: 'api_key',
    auth_fields: [
      { key: 'client_id', label: 'Client ID', placeholder: 'Your Xero app Client ID', type: 'text', required: true, helpText: 'Found in Xero Developer Portal → My Apps' },
      { key: 'client_secret', label: 'Client Secret', placeholder: 'Your Xero app Client Secret', type: 'password', required: true },
    ],
    supported_features: ['Invoice sync', 'Contact sync', 'Bank reconciliation', 'Multi-currency support', 'Financial reports'],
    official_site_url: 'https://www.xero.com',
    official_setup_url: 'https://developer.xero.com/app/manage',
  },
  {
    id: 'square',
    name: 'Square',
    slug: 'square',
    category: 'Accounting & Payments',
    description_short: 'In-person and online payment processing.',
    description_long: 'Accept payments in the field with Square terminals or online. Sync transaction data back to Lume CRM for complete financial visibility. Perfect for service businesses that need to collect payments on-site.',
    logo_color: '#000000',
    logo_initials: 'Sq',
    logo_url: 'https://cdn.simpleicons.org/square/white',
    featured: false,
    connection_type: 'api_key',
    auth_fields: [
      { key: 'access_token', label: 'Access Token', placeholder: 'EAAAl...', type: 'password', required: true, helpText: 'Found in Square Developer Dashboard → Credentials' },
      { key: 'environment', label: 'Environment', placeholder: 'Select environment', type: 'select', required: true, options: ['Production', 'Sandbox'] },
    ],
    supported_features: ['In-person payments', 'Online checkout', 'Transaction sync', 'Invoicing', 'Terminal support'],
    official_site_url: 'https://squareup.com',
    official_setup_url: 'https://developer.squareup.com/apps',
  },
  {
    id: 'helcim',
    name: 'Helcim',
    slug: 'helcim',
    category: 'Accounting & Payments',
    description_short: 'Low-cost payment processing for Canadian businesses.',
    description_long: 'Helcim offers transparent interchange-plus pricing with no monthly fees. Connect to process payments with lower fees and sync all transaction data with your CRM. Built specifically for Canadian businesses.',
    logo_color: '#00A6A0',
    logo_initials: 'He',
    logo_url: helcimSvg,
    featured: false,
    connection_type: 'api_key',
    auth_fields: [
      { key: 'api_token', label: 'API Token', placeholder: 'Your Helcim API token', type: 'password', required: true, helpText: 'Found in Helcim Dashboard → Settings → API Access' },
    ],
    supported_features: ['Low processing fees', 'Canadian-focused', 'Terminal support', 'Online payments', 'Interchange-plus pricing'],
    official_site_url: 'https://www.helcim.com',
    official_setup_url: 'https://my.helcim.com/settings/api',
  },
  {
    id: 'wise',
    name: 'Wise Business',
    slug: 'wise',
    category: 'Accounting & Payments',
    description_short: 'International payments with real exchange rates.',
    description_long: 'Send and receive international payments at the mid-market exchange rate. Perfect for businesses with overseas clients or suppliers. Wise Business accounts support 50+ currencies.',
    logo_color: '#9FE870',
    logo_text_color: '#163300',
    logo_initials: 'W',
    logo_url: 'https://cdn.simpleicons.org/wise/163300',
    featured: false,
    connection_type: 'api_key',
    auth_fields: [
      { key: 'api_token', label: 'API Token', placeholder: 'Your Wise API token', type: 'password', required: true, helpText: 'Found in Wise Business → Settings → API tokens' },
      { key: 'environment', label: 'Environment', placeholder: 'Select environment', type: 'select', required: true, options: ['Production', 'Sandbox'] },
    ],
    supported_features: ['Multi-currency accounts', 'Low transfer fees', 'Batch payments', 'API automation', '50+ currencies'],
    official_site_url: 'https://wise.com/business',
    official_setup_url: 'https://wise.com/settings/api-tokens',
  },
  {
    id: 'paypal',
    name: 'PayPal Business',
    slug: 'paypal',
    category: 'Accounting & Payments',
    description_short: 'Accept PayPal payments on invoices.',
    description_long: 'Let your clients pay invoices via PayPal. Automatically track payment status and reconcile with your CRM records. Supports PayPal balance, credit cards, and Pay Later options.',
    logo_color: '#003087',
    logo_initials: 'PP',
    logo_url: 'https://cdn.simpleicons.org/paypal/white',
    featured: false,
    connection_type: 'api_key',
    auth_fields: [
      { key: 'client_id', label: 'Client ID', placeholder: 'Your PayPal Client ID', type: 'text', required: true, helpText: 'Found in PayPal Developer Dashboard → Apps & Credentials' },
      { key: 'client_secret', label: 'Client Secret', placeholder: 'Your PayPal Client Secret', type: 'password', required: true },
      { key: 'environment', label: 'Environment', placeholder: 'Select environment', type: 'select', required: true, options: ['Production', 'Sandbox'] },
    ],
    supported_features: ['Invoice payments', 'Payment tracking', 'Buyer protection', 'Multi-currency', 'Pay Later support'],
    official_site_url: 'https://www.paypal.com/business',
    official_setup_url: 'https://developer.paypal.com/dashboard/applications',
  },
  {
    id: 'plaid',
    name: 'Plaid',
    slug: 'plaid',
    category: 'Accounting & Payments',
    description_short: 'Bank account verification and financial data.',
    description_long: 'Verify client bank accounts and enable ACH payments. Plaid connects securely to thousands of financial institutions for instant account verification and balance checks.',
    logo_color: '#000000',
    logo_initials: 'Pl',
    logo_url: plaidSvg,
    featured: false,
    connection_type: 'api_key',
    auth_fields: [
      { key: 'client_id', label: 'Client ID', placeholder: 'Your Plaid Client ID', type: 'text', required: true },
      { key: 'secret', label: 'Secret', placeholder: 'Your Plaid Secret', type: 'password', required: true },
      { key: 'environment', label: 'Environment', placeholder: 'Select environment', type: 'select', required: true, options: ['Production', 'Sandbox', 'Development'] },
    ],
    supported_features: ['Bank verification', 'ACH payments', 'Balance checks', 'Identity verification', 'Transaction data'],
    official_site_url: 'https://plaid.com',
    official_setup_url: 'https://dashboard.plaid.com/developers/keys',
  },

  // ════════════════════════════════════════════════════════════════
  // AUTOMATION
  // ════════════════════════════════════════════════════════════════
  {
    id: 'n8n',
    name: 'n8n',
    slug: 'n8n',
    category: 'Automation',
    description_short: 'Open-source workflow automation for technical teams.',
    description_long: 'n8n is a powerful open-source automation tool. Build complex workflows with code when you need it, or use the visual editor for simple automations. Self-host for full control over your data.',
    logo_color: '#EA4B71',
    logo_initials: 'n8n',
    logo_url: 'https://cdn.simpleicons.org/n8n/white',
    featured: false,
    connection_type: 'webhook',
    auth_fields: [
      { key: 'webhook_url', label: 'Webhook URL', placeholder: 'https://your-n8n.com/webhook/...', type: 'url', required: true, helpText: 'Create a Webhook trigger node in n8n and paste the URL here' },
      { key: 'api_key', label: 'API Key (optional)', placeholder: 'n8n API key for management', type: 'password', required: false, helpText: 'Found in n8n Settings → API → API Key' },
    ],
    webhook_instructions: 'Configure a webhook node in n8n and paste the trigger URL here. Events from Lume CRM will be sent to your n8n instance.',
    supported_features: ['Self-hosted option', 'Code nodes', 'Visual workflow editor', '400+ integrations', 'Webhook triggers'],
    docs_url: 'https://docs.n8n.io',
    official_site_url: 'https://n8n.io',
  },
  {
    id: 'make',
    name: 'Make',
    slug: 'make',
    category: 'Automation',
    description_short: 'Visual automation platform for complex workflows.',
    description_long: 'Make (formerly Integromat) lets you design, build, and automate complex workflows visually. Connect Lume CRM to hundreds of apps with advanced logic, error handling, and data transformation.',
    logo_color: '#6D00CC',
    logo_initials: 'M',
    logo_url: 'https://cdn.simpleicons.org/make/white',
    featured: false,
    connection_type: 'webhook',
    auth_fields: [
      { key: 'webhook_url', label: 'Webhook URL', placeholder: 'https://hook.make.com/...', type: 'url', required: true, helpText: 'Create a Webhook module in Make and paste the URL here' },
      { key: 'api_token', label: 'API Token (optional)', placeholder: 'Your Make API token', type: 'password', required: false, helpText: 'Found in Make → Profile → API' },
    ],
    supported_features: ['Visual scenario builder', 'Advanced routing', 'Error handling', 'Data transformation', 'Scheduling'],
    docs_url: 'https://www.make.com/en/help',
    official_site_url: 'https://www.make.com',
  },

  // ════════════════════════════════════════════════════════════════
  // COMMUNICATION
  // ════════════════════════════════════════════════════════════════
  {
    id: 'twilio',
    name: 'Twilio',
    slug: 'twilio',
    category: 'Communication',
    description_short: 'Send SMS, make calls, and manage communications.',
    description_long: 'Power your CRM communications with Twilio. Send appointment reminders via SMS, make VoIP calls from the app, and track all communication history. Two-way messaging keeps conversations in one place.',
    logo_color: '#F22F46',
    logo_initials: 'Tw',
    logo_url: twilioSvg,
    featured: true,
    connection_type: 'api_key',
    auth_fields: [
      { key: 'account_sid', label: 'Account SID', placeholder: 'AC...', type: 'text', required: true, helpText: 'Found in your Twilio Console dashboard' },
      { key: 'auth_token', label: 'Auth Token', placeholder: 'Your auth token', type: 'password', required: true, helpText: 'Found next to your Account SID' },
      { key: 'phone_number', label: 'Twilio Phone Number', placeholder: '+15551234567', type: 'text', required: true, helpText: 'Your Twilio phone number for sending SMS' },
      { key: 'messaging_service_sid', label: 'Messaging Service SID', placeholder: 'MG... (optional)', type: 'text', required: false, helpText: 'Optional: use a messaging service instead of a single number' },
    ],
    supported_features: ['SMS messaging', 'Voice calls', 'WhatsApp integration', 'Appointment reminders', 'Two-way messaging', 'Call tracking'],
    docs_url: 'https://www.twilio.com/docs',
    official_site_url: 'https://www.twilio.com',
    official_setup_url: 'https://console.twilio.com',
  },
  {
    id: 'slack',
    name: 'Slack',
    slug: 'slack',
    category: 'Communication',
    description_short: 'Get CRM notifications in your Slack workspace.',
    description_long: 'Receive real-time notifications in Slack when jobs are created, invoices are paid, or new leads come in. Route notifications to specific channels and keep your team informed without leaving Slack.',
    logo_color: '#4A154B',
    logo_initials: 'Sl',
    logo_url: slackSvg,
    featured: true,
    connection_type: 'api_key',
    auth_fields: [
      { key: 'webhook_url', label: 'Incoming Webhook URL', placeholder: 'https://hooks.slack.com/services/...', type: 'url', required: true, helpText: 'Create an incoming webhook in your Slack app settings → Incoming Webhooks' },
      { key: 'channel', label: 'Default Channel', placeholder: '#general', type: 'text', required: false, helpText: 'Default channel for notifications' },
    ],
    supported_features: ['Real-time notifications', 'Channel routing', 'Slash commands', 'Job updates', 'Payment alerts', 'Lead notifications'],
    docs_url: 'https://api.slack.com',
    official_site_url: 'https://slack.com',
    official_setup_url: 'https://api.slack.com/apps',
  },

  // ════════════════════════════════════════════════════════════════
  // MARKETING
  // ════════════════════════════════════════════════════════════════
  {
    id: 'mailchimp',
    name: 'Mailchimp',
    slug: 'mailchimp',
    category: 'Marketing',
    description_short: 'Email marketing campaigns and customer outreach.',
    description_long: 'Sync your CRM contacts with Mailchimp to create targeted email campaigns. Automate follow-ups, send newsletters, and track engagement. Segment audiences based on CRM data like job history and payment status.',
    logo_color: '#FFE01B',
    logo_text_color: '#241C15',
    logo_initials: 'MC',
    logo_url: 'https://cdn.simpleicons.org/mailchimp/241C15',
    featured: true,
    connection_type: 'api_key',
    auth_fields: [
      { key: 'api_key', label: 'API Key', placeholder: 'xxxxxxxx-us21', type: 'password', required: true, helpText: 'Found in Mailchimp → Account → Extras → API Keys' },
      { key: 'server_prefix', label: 'Server Prefix', placeholder: 'us21', type: 'text', required: true, helpText: 'The last part of your API key after the dash (e.g. us21)' },
      { key: 'list_id', label: 'Default Audience ID', placeholder: 'abc123def4', type: 'text', required: false, helpText: 'The audience to sync contacts to' },
    ],
    supported_features: ['Contact sync', 'Email campaigns', 'Audience segmentation', 'Automation workflows', 'Analytics', 'A/B testing'],
    docs_url: 'https://mailchimp.com/developer/',
    official_site_url: 'https://mailchimp.com',
    official_setup_url: 'https://us1.admin.mailchimp.com/account/api/',
  },
  {
    id: 'klaviyo',
    name: 'Klaviyo',
    slug: 'klaviyo',
    category: 'Marketing',
    description_short: 'Advanced email & SMS marketing automation.',
    description_long: 'Klaviyo offers powerful segmentation and automation for email and SMS marketing. Sync CRM data for highly personalized customer outreach based on behavior, job history, and engagement.',
    logo_color: '#000000',
    logo_initials: 'K',
    logo_url: klaviyoSvg,
    featured: false,
    connection_type: 'api_key',
    auth_fields: [
      { key: 'api_key', label: 'Private API Key', placeholder: 'pk_...', type: 'password', required: true, helpText: 'Found in Klaviyo → Settings → API Keys' },
    ],
    supported_features: ['Email automation', 'SMS campaigns', 'Advanced segmentation', 'A/B testing', 'Revenue tracking', 'Predictive analytics'],
    official_site_url: 'https://www.klaviyo.com',
    official_setup_url: 'https://www.klaviyo.com/settings/account/api-keys',
  },

  // ════════════════════════════════════════════════════════════════
  // REVIEWS
  // ════════════════════════════════════════════════════════════════
  {
    id: 'google-reviews',
    name: 'Google Reviews',
    slug: 'google-reviews',
    category: 'Reviews',
    description_short: 'Manage and respond to your Google Business reviews.',
    description_long: 'Monitor your Google Business Profile reviews directly from Lume CRM. Get notified of new reviews and respond quickly to maintain your reputation. Track rating trends over time.',
    logo_color: '#4285F4',
    logo_initials: 'G',
    logo_url: 'https://cdn.simpleicons.org/google/white',
    featured: false,
    connection_type: 'api_key',
    auth_fields: [
      { key: 'api_key', label: 'Google API Key', placeholder: 'AIza...', type: 'password', required: true, helpText: 'Create in Google Cloud Console with Places API enabled' },
      { key: 'place_id', label: 'Place ID', placeholder: 'ChIJ...', type: 'text', required: true, helpText: 'Your Google Business Place ID' },
    ],
    supported_features: ['Review monitoring', 'Response management', 'Rating analytics', 'Review request links', 'Notification alerts'],
    official_site_url: 'https://business.google.com',
    official_setup_url: 'https://console.cloud.google.com/apis/credentials',
  },

  // ════════════════════════════════════════════════════════════════
  // FORMS
  // ════════════════════════════════════════════════════════════════
  {
    id: 'fastfield',
    name: 'FastField Forms',
    slug: 'fastfield',
    category: 'Forms',
    description_short: 'Mobile forms, inspections, and data collection.',
    description_long: 'Create mobile-friendly forms for job site inspections, safety checklists, and data collection. Sync submissions directly to job records in Lume CRM. Works offline in the field.',
    logo_color: '#1976D2',
    logo_initials: 'FF',
    logo_url: fastfieldSvg,
    featured: false,
    connection_type: 'api_key',
    auth_fields: [
      { key: 'username', label: 'Username', placeholder: 'Your FastField username', type: 'text', required: true },
      { key: 'password', label: 'Password', placeholder: 'Your FastField password', type: 'password', required: true },
      { key: 'api_key', label: 'API Key', placeholder: 'Your FastField API key', type: 'password', required: true, helpText: 'Found in FastField Admin → API Settings' },
    ],
    supported_features: ['Mobile forms', 'Offline support', 'Photo capture', 'Digital signatures', 'PDF reports', 'GPS tagging'],
    official_site_url: 'https://www.fastfieldforms.com',
  },
  {
    id: 'jotform',
    name: 'Jotform',
    slug: 'jotform',
    category: 'Forms',
    description_short: 'Online form builder for lead capture and bookings.',
    description_long: 'Create beautiful forms for lead capture, service requests, and client intake. Submissions automatically create leads or jobs in your CRM. Drag-and-drop builder with 10,000+ templates.',
    logo_color: '#0A1551',
    logo_initials: 'JF',
    logo_url: jotformSvg,
    featured: false,
    connection_type: 'api_key',
    auth_fields: [
      { key: 'api_key', label: 'API Key', placeholder: 'Your Jotform API key', type: 'password', required: true, helpText: 'Found in Jotform → Settings → API' },
    ],
    supported_features: ['Drag-and-drop builder', 'Payment forms', 'Conditional logic', 'File uploads', 'Integrations', '10,000+ templates'],
    official_site_url: 'https://www.jotform.com',
    official_setup_url: 'https://www.jotform.com/myaccount/api',
  },

  // ════════════════════════════════════════════════════════════════
  // MAPS & DISPATCH
  // ════════════════════════════════════════════════════════════════
  {
    id: 'google-maps',
    name: 'Google Maps',
    slug: 'google-maps',
    category: 'Maps & Dispatch',
    description_short: 'Job location display, directions, and route planning.',
    description_long: 'Display job locations on interactive maps, calculate drive times, and plan optimal routes for your field teams. Address autocomplete speeds up job creation. Deep integration with scheduling.',
    logo_color: '#34A853',
    logo_initials: 'GM',
    logo_url: 'https://cdn.simpleicons.org/googlemaps/white',
    featured: true,
    connection_type: 'api_key',
    auth_fields: [
      { key: 'api_key', label: 'Google Maps API Key', placeholder: 'AIza...', type: 'password', required: true, helpText: 'Create in Google Cloud Console → APIs & Services → Credentials' },
      { key: 'map_id', label: 'Map ID (optional)', placeholder: 'Your custom Map ID', type: 'text', required: false, helpText: 'For custom styled maps' },
    ],
    supported_features: ['Interactive map views', 'Directions & ETA', 'Address autocomplete', 'Route optimization', 'Street View', 'Geocoding'],
    docs_url: 'https://developers.google.com/maps',
    official_site_url: 'https://maps.google.com',
    official_setup_url: 'https://console.cloud.google.com/apis/credentials',
  },
  {
    id: 'mapbox',
    name: 'Mapbox',
    slug: 'mapbox',
    category: 'Maps & Dispatch',
    description_short: 'Custom maps and location services.',
    description_long: 'Use Mapbox for beautiful custom maps, geocoding, and advanced routing. Ideal for businesses that need branded map experiences or offline map support.',
    logo_color: '#000000',
    logo_initials: 'Mx',
    logo_url: 'https://cdn.simpleicons.org/mapbox/white',
    featured: false,
    connection_type: 'api_key',
    auth_fields: [
      { key: 'access_token', label: 'Access Token', placeholder: 'pk.eyJ1...', type: 'password', required: true, helpText: 'Found in Mapbox Account → Access Tokens' },
    ],
    supported_features: ['Custom map styles', 'Geocoding', 'Routing API', 'Isochrone analysis', 'Turn-by-turn navigation', 'Offline maps'],
    docs_url: 'https://docs.mapbox.com',
    official_site_url: 'https://www.mapbox.com',
    official_setup_url: 'https://account.mapbox.com/access-tokens/',
  },
  {
    id: 'traccar',
    name: 'Traccar',
    slug: 'traccar',
    category: 'Field Operations',
    description_short: 'Open-source GPS tracking platform.',
    description_long: 'Connect your Traccar server to track technician vehicles and devices in real-time. View live positions on the dispatch map, set up geofences around job sites, and automatically verify proof of presence when technicians arrive.',
    logo_color: '#3daf57',
    logo_initials: 'Tc',
    logo_url: traccarSvg,
    featured: false,
    connection_type: 'api_key',
    auth_fields: [
      { key: 'server_url', label: 'Traccar Server URL', placeholder: 'https://your-traccar-server.com', type: 'url', required: true, helpText: 'The base URL of your self-hosted Traccar instance' },
      { key: 'username', label: 'Username', placeholder: 'admin@example.com', type: 'text', required: true },
      { key: 'password', label: 'Password', placeholder: 'Your Traccar password', type: 'password', required: true },
      { key: 'api_token', label: 'API Token', placeholder: 'Optional API token', type: 'password', required: false, helpText: 'Use instead of username/password if your server supports token auth' },
    ],
    supported_features: ['Live GPS tracking', 'Device management', 'Geofencing', 'Speed alerts', 'Trip history', 'Proof of presence'],
    docs_url: 'https://www.traccar.org/documentation/',
    official_site_url: 'https://www.traccar.org',
    official_setup_url: 'https://www.traccar.org/download/',
  },
  {
    id: 'life360',
    name: 'Life360',
    slug: 'life360',
    category: 'Field Operations',
    description_short: 'Team location sharing via mobile app.',
    description_long: 'Use Life360 to track your field technicians via the mobile app. Technicians install Life360, join your team circle, and share their live location. Once set up, Lume CRM can display team positions on the dispatch map.',
    logo_color: '#333333',
    logo_initials: 'L3',
    logo_url: life360Svg,
    featured: false,
    connection_type: 'manual',
    auth_fields: [],
    supported_features: ['Live location sharing', 'Team circles', 'Arrival notifications', 'Location history', 'Mobile app tracking'],
    docs_url: 'https://www.life360.com/how-it-works/',
    official_site_url: 'https://www.life360.com',
    official_setup_url: 'https://www.life360.com/download/',
  },

  // ════════════════════════════════════════════════════════════════
  // DOCUMENTS & SIGNATURES
  // ════════════════════════════════════════════════════════════════
  {
    id: 'docusign',
    name: 'DocuSign',
    slug: 'docusign',
    category: 'Documents & Signatures',
    description_short: 'Electronic signatures for quotes and contracts.',
    description_long: 'Send quotes and contracts for electronic signature directly from Lume CRM. Track signing status in real-time and get notified when documents are completed. Legally binding in 180+ countries.',
    logo_color: '#FFCE00',
    logo_text_color: '#1B0B39',
    logo_initials: 'DS',
    logo_url: docusignSvg,
    featured: true,
    connection_type: 'api_key',
    auth_fields: [
      { key: 'integration_key', label: 'Integration Key', placeholder: 'Your DocuSign integration key', type: 'text', required: true },
      { key: 'secret_key', label: 'Secret Key', placeholder: 'Your secret key', type: 'password', required: true },
      { key: 'account_id', label: 'Account ID', placeholder: 'Your DocuSign account ID', type: 'text', required: true },
      { key: 'environment', label: 'Environment', placeholder: 'Select environment', type: 'select', required: true, options: ['Production', 'Sandbox'] },
    ],
    supported_features: ['E-signatures', 'Quote signing', 'Contract management', 'Signing reminders', 'Audit trail', 'Templates'],
    docs_url: 'https://developers.docusign.com',
    official_site_url: 'https://www.docusign.com',
    official_setup_url: 'https://admindemo.docusign.com/apps-and-keys',
  },
  {
    id: 'pandadoc',
    name: 'PandaDoc',
    slug: 'pandadoc',
    category: 'Documents & Signatures',
    description_short: 'Document automation and e-signatures.',
    description_long: 'Create professional proposals, quotes, and contracts with PandaDoc templates. Send for signature and track document analytics. Collect payments directly within signed documents.',
    logo_color: '#4FBE5D',
    logo_initials: 'PD',
    logo_url: pandadocSvg,
    featured: false,
    connection_type: 'api_key',
    auth_fields: [
      { key: 'api_key', label: 'API Key', placeholder: 'Your PandaDoc API key', type: 'password', required: true, helpText: 'Found in PandaDoc → Settings → API → API Key' },
    ],
    supported_features: ['Document templates', 'E-signatures', 'Content library', 'Payment collection', 'Analytics', 'CRM integration'],
    official_site_url: 'https://www.pandadoc.com',
    official_setup_url: 'https://app.pandadoc.com/a/#/settings/api-key',
  },

  // ════════════════════════════════════════════════════════════════
  // FILE STORAGE
  // ════════════════════════════════════════════════════════════════
  {
    id: 'google-drive',
    name: 'Google Drive',
    slug: 'google-drive',
    category: 'File Storage',
    description_short: 'Store and sync job documents in Google Drive.',
    description_long: 'Automatically organize job photos, documents, and attachments in Google Drive folders. Access files from anywhere and share with your team. Integrates with Google Workspace.',
    logo_color: '#4285F4',
    logo_initials: 'GD',
    logo_url: 'https://cdn.simpleicons.org/googledrive/white',
    featured: false,
    connection_type: 'api_key',
    auth_fields: [
      { key: 'service_account_json', label: 'Service Account JSON Key', placeholder: '{"type":"service_account",...}', type: 'password', required: true, helpText: 'Download from Google Cloud Console → IAM → Service Accounts' },
      { key: 'folder_id', label: 'Root Folder ID (optional)', placeholder: 'Google Drive folder ID', type: 'text', required: false, helpText: 'The folder where CRM files will be stored' },
    ],
    supported_features: ['Auto folder creation', 'File sync', 'Photo uploads', 'Shared drives', 'Document preview', 'Google Workspace'],
    official_site_url: 'https://drive.google.com',
    official_setup_url: 'https://console.cloud.google.com/apis/credentials',
  },
  {
    id: 'dropbox',
    name: 'Dropbox',
    slug: 'dropbox',
    category: 'File Storage',
    description_short: 'Cloud file storage and sharing.',
    description_long: 'Connect Dropbox to automatically back up job photos and documents. Share files with clients and team members seamlessly. Version history keeps track of all changes.',
    logo_color: '#0061FF',
    logo_initials: 'DB',
    logo_url: 'https://cdn.simpleicons.org/dropbox/white',
    featured: false,
    connection_type: 'api_key',
    auth_fields: [
      { key: 'access_token', label: 'Access Token', placeholder: 'sl.B...', type: 'password', required: true, helpText: 'Generate a long-lived access token in Dropbox App Console' },
    ],
    supported_features: ['File sync', 'Shared folders', 'File requests', 'Version history', 'Mobile access'],
    official_site_url: 'https://www.dropbox.com',
    official_setup_url: 'https://www.dropbox.com/developers/apps',
  },
  {
    id: 'onedrive',
    name: 'OneDrive',
    slug: 'onedrive',
    category: 'File Storage',
    description_short: 'Microsoft cloud storage integration.',
    description_long: 'Store CRM files in OneDrive for Business. Ideal for teams already using Microsoft 365 for collaboration and document management.',
    logo_color: '#0078D4',
    logo_initials: 'OD',
    logo_url: onedriveSvg,
    featured: false,
    connection_type: 'api_key',
    auth_fields: [
      { key: 'client_id', label: 'Application (Client) ID', placeholder: 'Your Azure App Client ID', type: 'text', required: true, helpText: 'Found in Azure Portal → App registrations' },
      { key: 'client_secret', label: 'Client Secret', placeholder: 'Your Azure App Client Secret', type: 'password', required: true },
      { key: 'tenant_id', label: 'Tenant ID', placeholder: 'Your Azure AD Tenant ID', type: 'text', required: true },
    ],
    supported_features: ['Microsoft 365 integration', 'File sync', 'Co-authoring', 'Sharing', 'Mobile access'],
    official_site_url: 'https://onedrive.live.com',
    official_setup_url: 'https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps',
  },

  // ════════════════════════════════════════════════════════════════
  // ANALYTICS
  // ════════════════════════════════════════════════════════════════
  {
    id: 'google-analytics',
    name: 'Google Analytics',
    slug: 'google-analytics',
    category: 'Analytics',
    description_short: 'Track website and marketing performance.',
    description_long: 'Connect Google Analytics to track how clients find your business. Measure the effectiveness of your marketing campaigns and optimize your online presence with data-driven insights.',
    logo_color: '#F9AB00',
    logo_text_color: '#1A1A1A',
    logo_initials: 'GA',
    logo_url: 'https://cdn.simpleicons.org/googleanalytics/1A1A1A',
    featured: false,
    connection_type: 'api_key',
    auth_fields: [
      { key: 'measurement_id', label: 'Measurement ID', placeholder: 'G-XXXXXXXXXX', type: 'text', required: true, helpText: 'Found in GA4 → Admin → Data Streams' },
      { key: 'api_secret', label: 'API Secret', placeholder: 'Your Measurement Protocol API secret', type: 'password', required: true, helpText: 'Found in GA4 → Admin → Data Streams → Measurement Protocol' },
    ],
    supported_features: ['Website traffic', 'Conversion tracking', 'Campaign attribution', 'Audience insights', 'Real-time data'],
    official_site_url: 'https://analytics.google.com',
    official_setup_url: 'https://analytics.google.com/analytics/web/',
  },

  // ════════════════════════════════════════════════════════════════
  // AI
  // ════════════════════════════════════════════════════════════════
  {
    id: 'openai',
    name: 'OpenAI',
    slug: 'openai',
    category: 'AI',
    description_short: 'AI-powered automation, content generation, and insights.',
    description_long: 'Leverage GPT models to generate job descriptions, draft client emails, summarize notes, and automate repetitive text-based tasks. Smart suggestions help your team work faster and communicate better.',
    logo_color: '#000000',
    logo_initials: 'AI',
    logo_url: openaiSvg,
    featured: true,
    connection_type: 'api_key',
    auth_fields: [
      { key: 'api_key', label: 'OpenAI API Key', placeholder: 'sk-...', type: 'password', required: true, helpText: 'Found at platform.openai.com → API Keys' },
      { key: 'model', label: 'Default Model', placeholder: 'Select model', type: 'select', required: false, options: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'] },
      { key: 'org_id', label: 'Organization ID (optional)', placeholder: 'org-...', type: 'text', required: false, helpText: 'Only needed if you belong to multiple organizations' },
    ],
    supported_features: ['Content generation', 'Email drafting', 'Note summarization', 'Smart suggestions', 'Chatbot integration', 'Translation'],
    docs_url: 'https://platform.openai.com/docs',
    official_site_url: 'https://openai.com',
    official_setup_url: 'https://platform.openai.com/api-keys',
  },
  {
    id: 'gemini',
    name: 'Gemini',
    slug: 'gemini',
    category: 'AI',
    description_short: 'Google\'s multimodal AI for advanced analysis.',
    description_long: 'Use Gemini for image analysis of job site photos, document understanding, and multilingual communication. Gemini\'s multimodal capabilities handle text, images, and code.',
    logo_color: '#4285F4',
    logo_initials: 'Ge',
    logo_url: 'https://cdn.simpleicons.org/googlegemini/white',
    featured: false,
    connection_type: 'api_key',
    auth_fields: [
      { key: 'api_key', label: 'API Key', placeholder: 'AIza...', type: 'password', required: true, helpText: 'Found in Google AI Studio → API Keys' },
    ],
    supported_features: ['Image analysis', 'Document understanding', 'Multilingual support', 'Code generation', 'Data analysis'],
    official_site_url: 'https://ai.google.dev',
    official_setup_url: 'https://aistudio.google.com/app/apikey',
  },
  {
    id: 'claude',
    name: 'Claude AI',
    slug: 'claude',
    category: 'AI',
    description_short: 'Anthropic\'s AI assistant for complex reasoning.',
    description_long: 'Claude excels at nuanced text analysis, long document processing, and careful reasoning. Use it for contract review, detailed estimates, and thoughtful client communication.',
    logo_color: '#D97757',
    logo_initials: 'C',
    logo_url: 'https://cdn.simpleicons.org/anthropic/white',
    featured: false,
    connection_type: 'api_key',
    auth_fields: [
      { key: 'api_key', label: 'API Key', placeholder: 'sk-ant-...', type: 'password', required: true, helpText: 'Found in Anthropic Console → API Keys' },
    ],
    supported_features: ['Long document analysis', 'Careful reasoning', 'Code generation', 'Content writing', 'Data extraction', 'Safety-focused'],
    official_site_url: 'https://www.anthropic.com',
    official_setup_url: 'https://console.anthropic.com/settings/keys',
  },
  {
    id: 'elevenlabs',
    name: 'ElevenLabs',
    slug: 'elevenlabs',
    category: 'AI',
    description_short: 'AI voice generation for phone and messaging.',
    description_long: 'Generate natural-sounding voice messages and phone greetings. Create professional voicemail greetings and automated phone responses. Clone your voice for consistent branding.',
    logo_color: '#000000',
    logo_initials: 'EL',
    logo_url: 'https://cdn.simpleicons.org/elevenlabs/white',
    featured: false,
    connection_type: 'api_key',
    auth_fields: [
      { key: 'api_key', label: 'API Key', placeholder: 'Your ElevenLabs API key', type: 'password', required: true, helpText: 'Found in ElevenLabs → Profile → API Keys' },
    ],
    supported_features: ['Voice synthesis', 'Custom voice cloning', 'Phone greetings', 'Voice messages', 'Multi-language', '29+ languages'],
    official_site_url: 'https://elevenlabs.io',
    official_setup_url: 'https://elevenlabs.io/app/settings/api-keys',
  },

  // ════════════════════════════════════════════════════════════════
  // DEVELOPER TOOLS
  // ════════════════════════════════════════════════════════════════
  {
    id: 'github',
    name: 'GitHub',
    slug: 'github',
    category: 'Developer Tools',
    description_short: 'Source control and developer collaboration.',
    description_long: 'Connect GitHub for issue tracking integration, automated deployments, and developer workflow management. Link commits and PRs to CRM records for full traceability.',
    logo_color: '#24292E',
    logo_initials: 'GH',
    logo_url: 'https://cdn.simpleicons.org/github/white',
    featured: false,
    connection_type: 'api_key',
    auth_fields: [
      { key: 'personal_access_token', label: 'Personal Access Token', placeholder: 'ghp_...', type: 'password', required: true, helpText: 'Create a fine-grained PAT in GitHub → Settings → Developer Settings → Personal access tokens' },
    ],
    supported_features: ['Issue sync', 'Webhook events', 'Deployment status', 'PR notifications', 'Code references'],
    docs_url: 'https://docs.github.com',
    official_site_url: 'https://github.com',
    official_setup_url: 'https://github.com/settings/tokens',
  },
  {
    id: 'vercel',
    name: 'Vercel',
    slug: 'vercel',
    category: 'Developer Tools',
    description_short: 'Deploy and host your frontend applications.',
    description_long: 'Monitor your Vercel deployments and connect deployment status to your CRM workflow. Perfect for teams building client-facing portals and booking pages.',
    logo_color: '#000000',
    logo_initials: 'V',
    logo_url: 'https://cdn.simpleicons.org/vercel/white',
    featured: false,
    connection_type: 'api_key',
    auth_fields: [
      { key: 'api_token', label: 'API Token', placeholder: 'Your Vercel API token', type: 'password', required: true, helpText: 'Found in Vercel → Settings → Tokens' },
    ],
    supported_features: ['Deployment monitoring', 'Preview links', 'Build status', 'Environment management'],
    docs_url: 'https://vercel.com/docs',
    official_site_url: 'https://vercel.com',
    official_setup_url: 'https://vercel.com/account/tokens',
  },
  {
    id: 'supabase',
    name: 'Supabase',
    slug: 'supabase',
    category: 'Developer Tools',
    description_short: 'Open-source backend powering Lume CRM.',
    description_long: 'Supabase powers Lume CRM\'s backend infrastructure including the database, authentication, real-time subscriptions, and file storage. This integration is pre-configured and always active.',
    logo_color: '#3ECF8E',
    logo_text_color: '#1A1A1A',
    logo_initials: 'SB',
    logo_url: 'https://cdn.simpleicons.org/supabase/1A1A1A',
    featured: true,
    connection_type: 'internal',
    auth_fields: [
      { key: 'project_url', label: 'Project URL', placeholder: 'https://xxx.supabase.co', type: 'url', required: true, helpText: 'Your Supabase project URL' },
      { key: 'anon_key', label: 'Anon/Public Key', placeholder: 'eyJ...', type: 'password', required: true, helpText: 'Found in Settings → API → Project API keys' },
      { key: 'service_role_key', label: 'Service Role Key (optional)', placeholder: 'eyJ...', type: 'password', required: false, helpText: 'Only for server-side operations. Keep secret.' },
    ],
    supported_features: ['PostgreSQL database', 'Real-time subscriptions', 'Row-level security', 'Auth', 'Edge functions', 'File storage'],
    docs_url: 'https://supabase.com/docs',
  },
];

// ── Categories (ordered) ──────────────────────────────────────────
export const CATEGORIES: AppCategory[] = [
  'Accounting & Payments',
  'Automation',
  'Communication',
  'Marketing',
  'Reviews',
  'Forms',
  'Maps & Dispatch',
  'Field Operations',
  'Documents & Signatures',
  'File Storage',
  'Analytics',
  'AI',
  'Developer Tools',
];

// ── Helpers ───────────────────────────────────────────────────────
export function getIntegration(id: string): Integration | undefined {
  return INTEGRATIONS.find((i) => i.id === id);
}

export function getIntegrationsByCategory(category: AppCategory): Integration[] {
  return INTEGRATIONS.filter((i) => i.category === category);
}

export function getFeaturedIntegrations(): Integration[] {
  return INTEGRATIONS.filter((i) => i.featured);
}

export function searchIntegrations(query: string): Integration[] {
  const q = query.toLowerCase();
  return INTEGRATIONS.filter(
    (i) =>
      i.name.toLowerCase().includes(q) ||
      i.description_short.toLowerCase().includes(q) ||
      i.category.toLowerCase().includes(q) ||
      i.slug.toLowerCase().includes(q)
  );
}
