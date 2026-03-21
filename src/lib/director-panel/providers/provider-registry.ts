import type { ProviderRequest, ProviderResponse, ProviderType } from '../../../types/director';
import { BaseProvider } from './base-provider';
import { FalProvider } from './fal-provider';

/** Default timeout for provider execution (ms). */
const PROVIDER_TIMEOUT_MS = 120_000;

/** Delay before retrying a failed network request (ms). */
const RETRY_DELAY_MS = 2_000;

/**
 * Check if an error looks like a network / transient failure worth retrying.
 */
function isNetworkError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  return (
    msg.includes('network') ||
    msg.includes('fetch') ||
    msg.includes('econnrefused') ||
    msg.includes('econnreset') ||
    msg.includes('etimedout') ||
    msg.includes('socket hang up') ||
    msg.includes('abort') ||
    msg.includes('failed to fetch')
  );
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Central provider registry. All provider interactions go through here.
 * UI code must NEVER call providers directly.
 */
class ProviderRegistry {
  private providers = new Map<ProviderType, BaseProvider>();

  register(provider: BaseProvider) {
    this.providers.set(provider.type, provider);
  }

  get(type: ProviderType): BaseProvider | undefined {
    return this.providers.get(type);
  }

  /**
   * Search all registered providers to find one that supports the given model.
   * Returns `undefined` if no provider claims support.
   */
  getProviderForModel(modelId: string): BaseProvider | undefined {
    for (const provider of this.providers.values()) {
      if (provider.supportsModel(modelId)) return provider;
    }
    return undefined;
  }

  async execute(request: ProviderRequest): Promise<ProviderResponse> {
    const provider = this.providers.get(request.provider);
    if (!provider) {
      return {
        success: false,
        outputs: [],
        metadata: {},
        usage: { provider: request.provider, model: request.model, duration_ms: 0 },
        cost: { credits: 0 },
        error: { code: 'PROVIDER_NOT_FOUND', message: `Provider "${request.provider}" is not registered` },
      };
    }

    if (!provider.supportsModel(request.model)) {
      return {
        success: false,
        outputs: [],
        metadata: {},
        usage: { provider: request.provider, model: request.model, duration_ms: 0 },
        cost: { credits: 0 },
        error: { code: 'MODEL_NOT_SUPPORTED', message: `Model "${request.model}" is not supported by provider "${request.provider}"` },
      };
    }

    // Attempt execution with timeout and one retry on network errors
    let lastError: unknown;

    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const result = await Promise.race<ProviderResponse>([
          provider.execute(request),
          new Promise<ProviderResponse>((_, reject) =>
            setTimeout(() => reject(new Error('__PROVIDER_TIMEOUT__')), PROVIDER_TIMEOUT_MS),
          ),
        ]);
        return result;
      } catch (err: any) {
        lastError = err;

        // Handle timeout specifically
        if (err?.message === '__PROVIDER_TIMEOUT__') {
          return {
            success: false,
            outputs: [],
            metadata: {},
            usage: { provider: request.provider, model: request.model, duration_ms: PROVIDER_TIMEOUT_MS },
            cost: { credits: 0 },
            error: {
              code: 'PROVIDER_TIMEOUT',
              message: `Provider "${request.provider}" timed out after ${PROVIDER_TIMEOUT_MS / 1000}s`,
            },
          };
        }

        // Retry once on network errors
        if (attempt === 0 && isNetworkError(err)) {
          await delay(RETRY_DELAY_MS);
          continue;
        }

        // Non-retryable error -- fall through
        break;
      }
    }

    return {
      success: false,
      outputs: [],
      metadata: {},
      usage: { provider: request.provider, model: request.model, duration_ms: 0 },
      cost: { credits: 0 },
      error: {
        code: 'PROVIDER_ERROR',
        message: (lastError as any)?.message || 'Unknown provider error',
      },
    };
  }

  estimateCost(request: ProviderRequest): number {
    const provider = this.providers.get(request.provider);
    return provider?.estimateCost(request) ?? 0;
  }

  listProviders(): ProviderType[] {
    return Array.from(this.providers.keys());
  }
}

// Singleton instance
export const providerRegistry = new ProviderRegistry();

// Register available providers
providerRegistry.register(new FalProvider());
// Future: providerRegistry.register(new GoogleProvider());
// Future: providerRegistry.register(new RunwayProvider());
// Future: providerRegistry.register(new KlingProvider());
// Future: providerRegistry.register(new HiggsFieldProvider());
