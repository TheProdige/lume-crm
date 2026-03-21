import type { ProviderRequest, ProviderResponse, ProviderType } from '../../../types/director';

/**
 * Abstract base class for all AI provider adapters.
 * Each provider (fal, google, runway, etc.) extends this.
 */
export abstract class BaseProvider {
  abstract readonly type: ProviderType;
  abstract readonly displayName: string;

  /**
   * Execute a generation request against this provider.
   * Must return a normalized ProviderResponse.
   */
  abstract execute(request: ProviderRequest): Promise<ProviderResponse>;

  /**
   * Estimate the credit cost for a request before execution.
   */
  abstract estimateCost(request: ProviderRequest): number;

  /**
   * Check if the provider supports a given model.
   */
  abstract supportsModel(modelId: string): boolean;

  /**
   * List all supported model IDs.
   */
  abstract listModels(): string[];

  /**
   * Build a standard error response.
   */
  protected errorResponse(code: string, message: string): ProviderResponse {
    return {
      success: false,
      outputs: [],
      metadata: {},
      usage: { provider: this.type, model: '', duration_ms: 0 },
      cost: { credits: 0 },
      error: { code, message },
    };
  }
}
