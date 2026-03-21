import type { ProviderRequest, ProviderResponse, ProviderOutput, NodeIOKind } from '../../../types/director';
import { BaseProvider } from './base-provider';

// ---- Supported model list ---------------------------------------------------

const FAL_MODELS = [
  'flux-2-pro', 'flux-2-flex', 'flux-2-dev-lora', 'flux-fast', 'flux-pro-1.1',
  'flux-pro-1.1-ultra', 'flux-dev-lora', 'flux-kontext', 'flux-kontext-lora',
  'flux-kontext-multi-image', 'flux-fill-pro', 'flux-2-max', 'flux-canny-pro',
  'flux-depth-pro', 'flux-dev-redux', 'flux-controlnet-lora', 'flux-pro-outpaint',
  'reve', 'mystic', 'nano-banana-2', 'nano-banana-pro', 'nano-banana',
  'wan-2.5', 'wan-2.2', 'wan-video', 'ltx-2-video', 'seedance-v1.5-pro',
  'seedance-v1.0', 'pixverse-v4.5', 'moonvalley', 'omnihuman-v1.5',
  'sync-2-pro', 'magnific-upscale', 'magnific-skin-enhancer',
  'magnific-precision-upscale', 'magnific-precision-upscale-v2',
  'enhancor-image-upscale', 'enhancor-realistic-skin',
  'real-esrgan-video-upscaler', 'video-smoother',
  'meshy-v6', 'sam-3d-objects', 'rodin-v2', 'rodin',
  'hunyuan-3d-v3', 'hunyuan-3d-v2.1', 'hunyuan-3d-v2.0', 'trellis-3d-v2',
  'grok-imagine-video', 'hunyuan', 'vectorizer', 'text-to-vector',
  'seedream-v4.5-edit', 'seedream-v5-edit', 'seededit-3.0',
  'qwen-image-edit-plus', 'qwen-image-edit-2511', 'qwen-edit-multiangle',
  'relight-2.0', 'replace-background',
] as const;

const FAL_MODEL_SET = new Set<string>(FAL_MODELS);

// ---- Per-model cost lookup table --------------------------------------------

const COST_TABLE: Record<string, number> = {
  // Image generation -- standard
  'flux-2-pro': 5,
  'flux-2-max': 6,
  'flux-2-flex': 3,
  'flux-2-dev-lora': 3,
  'flux-fast': 1,
  'flux-pro-1.1': 4,
  'flux-pro-1.1-ultra': 5,
  'flux-dev-lora': 2,
  'flux-kontext': 4,
  'flux-kontext-lora': 4,
  'flux-kontext-multi-image': 5,
  'flux-fill-pro': 4,
  'flux-canny-pro': 4,
  'flux-depth-pro': 4,
  'flux-dev-redux': 3,
  'flux-controlnet-lora': 3,
  'flux-pro-outpaint': 5,
  'reve': 3,
  'mystic': 2,
  'nano-banana-2': 2,
  'nano-banana-pro': 3,
  'nano-banana': 1,
  'hunyuan': 3,

  // Video generation
  'wan-2.5': 15,
  'wan-2.2': 12,
  'wan-video': 15,
  'ltx-2-video': 12,
  'seedance-v1.5-pro': 18,
  'seedance-v1.0': 15,
  'pixverse-v4.5': 15,
  'moonvalley': 15,
  'omnihuman-v1.5': 20,
  'sync-2-pro': 15,
  'grok-imagine-video': 15,

  // Upscaling / enhancement
  'magnific-upscale': 3,
  'magnific-skin-enhancer': 3,
  'magnific-precision-upscale': 4,
  'magnific-precision-upscale-v2': 4,
  'enhancor-image-upscale': 2,
  'enhancor-realistic-skin': 3,
  'real-esrgan-video-upscaler': 5,
  'video-smoother': 4,

  // 3D generation
  'meshy-v6': 20,
  'sam-3d-objects': 15,
  'rodin-v2': 20,
  'rodin': 18,
  'hunyuan-3d-v3': 20,
  'hunyuan-3d-v2.1': 18,
  'hunyuan-3d-v2.0': 15,
  'trellis-3d-v2': 15,

  // Vector / utility
  'vectorizer': 2,
  'text-to-vector': 2,

  // Image editing
  'seedream-v4.5-edit': 4,
  'seedream-v5-edit': 5,
  'seededit-3.0': 4,
  'qwen-image-edit-plus': 3,
  'qwen-image-edit-2511': 3,
  'qwen-edit-multiangle': 4,
  'relight-2.0': 3,
  'replace-background': 3,
};

/** Default cost when a model is not in the lookup table. */
const DEFAULT_CREDIT_COST = 3;

// ---- Output kind inference --------------------------------------------------

function inferOutputKind(model: string): NodeIOKind {
  if (
    model.includes('video') || model.includes('wan') || model.includes('ltx') ||
    model.includes('seedance') || model.includes('moonvalley') || model.includes('pixverse') ||
    model.includes('grok-imagine-video') || model.includes('omnihuman') || model.includes('sync') ||
    model.includes('smoother')
  ) return 'video';
  if (
    model.includes('3d') || model.includes('meshy') || model.includes('rodin') ||
    model.includes('trellis') || model.includes('sam-3d')
  ) return '3d';
  return 'image';
}

// ---- Input validation helpers -----------------------------------------------

function validateRequest(request: ProviderRequest): string | null {
  if (!request.model) return 'Missing required field: model';
  if (!FAL_MODEL_SET.has(request.model)) return `Unsupported model: ${request.model}`;

  // For text-to-* models a prompt is generally required (unless it's an edit / upscale model)
  const isEditOrUpscale =
    request.model.includes('upscale') || request.model.includes('enhancor') ||
    request.model.includes('magnific') || request.model.includes('smoother') ||
    request.model.includes('edit') || request.model.includes('relight') ||
    request.model.includes('replace-background') || request.model.includes('vectorizer') ||
    request.model.includes('esrgan') || request.model.includes('fill') ||
    request.model.includes('outpaint') || request.model.includes('redux') ||
    request.model.includes('matte') || request.model.includes('3d') ||
    request.model.includes('meshy') || request.model.includes('rodin') ||
    request.model.includes('trellis') || request.model.includes('sam-3d');

  if (!isEditOrUpscale) {
    const prompt = request.inputs?.prompt ?? request.params?.prompt ?? request.params?.text;
    if (!prompt && !request.inputs?.image && !request.inputs?.start_image) {
      return `Model "${request.model}" requires a prompt or input image`;
    }
  }

  return null; // Valid
}

// ---- Provider implementation ------------------------------------------------

/**
 * fal.ai provider adapter.
 * V1: Routes requests through server-side API to protect API keys.
 */
export class FalProvider extends BaseProvider {
  readonly type = 'fal' as const;
  readonly displayName = 'fal.ai';

  async execute(request: ProviderRequest): Promise<ProviderResponse> {
    // Validate inputs before calling the API
    const validationError = validateRequest(request);
    if (validationError) {
      return this.errorResponse('FAL_VALIDATION_ERROR', validationError);
    }

    const start = Date.now();
    const controller = new AbortController();

    try {
      // Get auth token from Supabase session
      const { supabase } = await import('../../../lib/supabase');
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || '';

      const response = await fetch('/api/director-panel/providers/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          provider: this.type,
          model: request.model,
          params: request.params,
          inputs: request.inputs,
        }),
        signal: controller.signal,
      });

      const duration_ms = Date.now() - start;

      // Handle rate limiting specifically
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        const retryMsg = retryAfter
          ? `Rate limited by fal.ai. Retry after ${retryAfter}s.`
          : 'Rate limited by fal.ai. Please wait before retrying.';
        return this.errorResponse('FAL_RATE_LIMITED', retryMsg);
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return this.errorResponse(
          'FAL_API_ERROR',
          errorData.message || `fal.ai returned status ${response.status}`,
        );
      }

      const data = await response.json();
      const duration = Date.now() - start;

      // Normalize outputs to proper ProviderOutput[]
      const rawOutputs: any[] = data.outputs || [];
      const expectedKind = inferOutputKind(request.model);

      const normalizedOutputs: ProviderOutput[] = rawOutputs.map((raw: any) => ({
        kind: (raw.kind as NodeIOKind) || expectedKind,
        url: raw.url ?? undefined,
        data: raw.data ?? undefined,
        metadata: {
          ...(raw.metadata || {}),
          provider: this.type,
          model: request.model,
        },
      }));

      // If the API returned no structured outputs but has a top-level url/image,
      // synthesize one output entry.
      if (normalizedOutputs.length === 0 && (data.url || data.image || data.video)) {
        normalizedOutputs.push({
          kind: expectedKind,
          url: data.url || data.image || data.video,
          metadata: { provider: this.type, model: request.model },
        });
      }

      return {
        success: true,
        outputs: normalizedOutputs,
        metadata: data.metadata || {},
        usage: {
          provider: this.type,
          model: request.model,
          duration_ms: duration,
        },
        cost: {
          credits: data.cost?.credits ?? this.estimateCost(request),
          provider_cost_usd: data.cost?.provider_cost_usd,
        },
      };
    } catch (err: any) {
      // Distinguish abort from other errors
      if (err?.name === 'AbortError') {
        return this.errorResponse('FAL_CANCELLED', 'Request was cancelled');
      }
      return this.errorResponse('FAL_NETWORK_ERROR', err?.message || 'Network error calling fal.ai');
    }
  }

  /**
   * Abort controller factory -- callers can use this to cancel in-flight requests.
   */
  createAbortController(): AbortController {
    return new AbortController();
  }

  estimateCost(request: ProviderRequest): number {
    return COST_TABLE[request.model] ?? DEFAULT_CREDIT_COST;
  }

  supportsModel(modelId: string): boolean {
    return FAL_MODEL_SET.has(modelId);
  }

  listModels(): string[] {
    return [...FAL_MODELS];
  }
}
