/* ═══════════════════════════════════════════════════════════════
   Provider Registration — Barrel
   Import this once at server startup to register all providers.
   ═══════════════════════════════════════════════════════════════ */

import { registerStripe } from './stripe';
import { registerQuickBooks } from './quickbooks';
import { registerSlack } from './slack';
import { registerTwilio } from './twilio';
import { registerGenericProviders } from './generic-providers';

export function registerAllProviders(): void {
  registerStripe();
  registerQuickBooks();
  registerSlack();
  registerTwilio();
  registerGenericProviders();
}
