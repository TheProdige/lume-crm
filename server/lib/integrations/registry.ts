/* ═══════════════════════════════════════════════════════════════
   Provider Registry
   Centralized registration and lookup for integration providers.
   ═══════════════════════════════════════════════════════════════ */

import type { ProviderDefinition } from './types';

const providers = new Map<string, ProviderDefinition>();

export function registerProvider(provider: ProviderDefinition): void {
  providers.set(provider.slug, provider);
}

export function getProvider(slug: string): ProviderDefinition | undefined {
  return providers.get(slug);
}

export function getAllProviders(): ProviderDefinition[] {
  return Array.from(providers.values());
}

export function hasProvider(slug: string): boolean {
  return providers.has(slug);
}
