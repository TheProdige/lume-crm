import type {
  DirectorNode,
  DirectorEdge,
  DirectorRun,
  DirectorRunStep,
  RunLogEntry,
  ProviderRequest,
  ProviderResponse,
  ProviderOutput,
  NodeIOKind,
  NodeRegistryEntry,
} from '../../../types/director';
import { getNodeDef } from '../config/node-registry';
import { MODEL_CATALOG } from '../config/model-catalog';
import { providerRegistry } from '../providers/provider-registry';

// ---- Helpers ----------------------------------------------------------------

const modelCatalogMap = new Map(MODEL_CATALOG.map((m) => [m.id, m]));

function getModelEntry(modelId: string) {
  return modelCatalogMap.get(modelId);
}

// ---- Connection Type Validation ---------------------------------------------

/**
 * Determine whether a source port of `sourceKind` can connect to a target port
 * of `targetKind`.  The `any` kind acts as a wildcard on both sides.
 * All other kinds must match exactly.
 */
export function canConnect(sourceKind: NodeIOKind, targetKind: NodeIOKind): boolean {
  if (sourceKind === 'any' || targetKind === 'any') return true;
  return sourceKind === targetKind;
}

// ---- Graph Validation -------------------------------------------------------

export type ValidationError = {
  nodeId?: string;
  edgeId?: string;
  message: string;
  severity: 'error' | 'warning';
};

export function validateGraph(
  nodes: DirectorNode[],
  edges: DirectorEdge[],
): ValidationError[] {
  const errors: ValidationError[] = [];

  if (nodes.length === 0) {
    errors.push({ message: 'Graph has no nodes', severity: 'error' });
    return errors;
  }

  const nodeMap = new Map<string, DirectorNode>();
  for (const node of nodes) nodeMap.set(node.id, node);

  // ---- Node-level validation ------------------------------------------------

  for (const node of nodes) {
    const def = getNodeDef(node.type);
    if (!def) {
      errors.push({
        nodeId: node.id,
        message: `Unknown node type "${node.type}"`,
        severity: 'error',
      });
      continue;
    }

    // Warn about non-executable node statuses
    if (def.status === 'coming_soon' || def.status === 'internal_only') {
      errors.push({
        nodeId: node.id,
        message: `"${def.displayName}" has status "${def.status}" and will not execute`,
        severity: 'warning',
      });
    }

    // For providerBound nodes, check referenced model status
    if (def.providerBound) {
      const data = node.data_json as Record<string, any>;
      const modelId = data?.model || def.defaultData?.model;
      if (modelId) {
        const modelEntry = getModelEntry(modelId);
        if (modelEntry && modelEntry.status !== 'active') {
          errors.push({
            nodeId: node.id,
            message: `"${def.displayName}" references model "${modelEntry.displayName}" which has status "${modelEntry.status}"`,
            severity: 'warning',
          });
        }
      }
    }

    // Check required inputs are connected
    for (const input of def.inputs) {
      if (input.required !== false) {
        const hasConnection = edges.some(
          (e) => e.target_node_id === node.id && e.target_handle === input.id,
        );
        if (!hasConnection) {
          errors.push({
            nodeId: node.id,
            message: `"${def.displayName}" is missing required input "${input.label}"`,
            severity: 'warning',
          });
        }
      }
    }
  }

  // ---- Edge-level validation ------------------------------------------------

  const edgeKeys = new Set<string>();

  for (const edge of edges) {
    // Check for non-existent source / target nodes
    const sourceNode = nodeMap.get(edge.source_node_id);
    const targetNode = nodeMap.get(edge.target_node_id);

    if (!sourceNode) {
      errors.push({
        edgeId: edge.id,
        message: `Edge references non-existent source node "${edge.source_node_id}"`,
        severity: 'error',
      });
      continue;
    }

    if (!targetNode) {
      errors.push({
        edgeId: edge.id,
        message: `Edge references non-existent target node "${edge.target_node_id}"`,
        severity: 'error',
      });
      continue;
    }

    // Check for duplicate edges
    const edgeKey = `${edge.source_node_id}:${edge.source_handle}:${edge.target_node_id}:${edge.target_handle}`;
    if (edgeKeys.has(edgeKey)) {
      errors.push({
        edgeId: edge.id,
        message: `Duplicate edge from "${edge.source_node_id}:${edge.source_handle}" to "${edge.target_node_id}:${edge.target_handle}"`,
        severity: 'error',
      });
      continue;
    }
    edgeKeys.add(edgeKey);

    // Check type compatibility between source output port and target input port
    const sourceDef = getNodeDef(sourceNode.type);
    const targetDef = getNodeDef(targetNode.type);
    if (sourceDef && targetDef) {
      const sourcePort = sourceDef.outputs.find((o) => o.id === edge.source_handle);
      const targetPort = targetDef.inputs.find((i) => i.id === edge.target_handle);

      if (sourcePort && targetPort && !canConnect(sourcePort.kind, targetPort.kind)) {
        errors.push({
          edgeId: edge.id,
          nodeId: edge.target_node_id,
          message: `Incompatible connection: "${sourcePort.kind}" output cannot connect to "${targetPort.kind}" input`,
          severity: 'error',
        });
      }
    }
  }

  // ---- Cycle detection ------------------------------------------------------

  if (hasCycle(nodes, edges)) {
    errors.push({ message: 'Graph contains a cycle — not supported in V1', severity: 'error' });
  }

  return errors;
}

// ---- Cycle Detection --------------------------------------------------------

function hasCycle(nodes: DirectorNode[], edges: DirectorEdge[]): boolean {
  const adj = new Map<string, string[]>();
  for (const node of nodes) adj.set(node.id, []);
  for (const edge of edges) {
    const list = adj.get(edge.source_node_id);
    if (list) list.push(edge.target_node_id);
  }

  const visited = new Set<string>();
  const inStack = new Set<string>();

  function dfs(nodeId: string): boolean {
    visited.add(nodeId);
    inStack.add(nodeId);
    for (const neighbor of adj.get(nodeId) || []) {
      if (inStack.has(neighbor)) return true;
      if (!visited.has(neighbor) && dfs(neighbor)) return true;
    }
    inStack.delete(nodeId);
    return false;
  }

  for (const node of nodes) {
    if (!visited.has(node.id) && dfs(node.id)) return true;
  }
  return false;
}

// ---- Topological Sort -------------------------------------------------------

export function topologicalSort(
  nodes: DirectorNode[],
  edges: DirectorEdge[],
): DirectorNode[] {
  const inDegree = new Map<string, number>();
  const adj = new Map<string, string[]>();
  const nodeMap = new Map<string, DirectorNode>();

  for (const node of nodes) {
    inDegree.set(node.id, 0);
    adj.set(node.id, []);
    nodeMap.set(node.id, node);
  }

  for (const edge of edges) {
    adj.get(edge.source_node_id)?.push(edge.target_node_id);
    inDegree.set(edge.target_node_id, (inDegree.get(edge.target_node_id) || 0) + 1);
  }

  const queue: string[] = [];
  for (const [id, deg] of inDegree) {
    if (deg === 0) queue.push(id);
  }

  const sorted: DirectorNode[] = [];
  while (queue.length > 0) {
    const id = queue.shift()!;
    const node = nodeMap.get(id);
    if (node) sorted.push(node);

    for (const neighbor of adj.get(id) || []) {
      const newDeg = (inDegree.get(neighbor) || 1) - 1;
      inDegree.set(neighbor, newDeg);
      if (newDeg === 0) queue.push(neighbor);
    }
  }

  return sorted;
}

// ---- Execution Types --------------------------------------------------------

export type ExecutionCallbacks = {
  onLog: (entry: RunLogEntry) => void;
  onNodeStart: (nodeId: string) => void;
  onNodeComplete: (nodeId: string, outputs: Record<string, any>) => void;
  onNodeError: (nodeId: string, error: string) => void;
  onOutput: (output: ProviderOutput) => void;
  onProgress: (progress: number) => void;
};

export type ExecutionResult = {
  success: boolean;
  outputs: ProviderOutput[];
  steps: Omit<DirectorRunStep, 'id' | 'run_id' | 'org_id'>[];
  totalCost: number;
  creditsUsed: number;
  errors: string[];
};

// ---- Execution Engine -------------------------------------------------------

export async function executeGraph(
  nodes: DirectorNode[],
  edges: DirectorEdge[],
  callbacks: ExecutionCallbacks,
  options: {
    flowId?: string;
    availableCredits?: number;
    abortSignal?: AbortSignal;
  } = {},
): Promise<ExecutionResult> {
  const errors: string[] = [];
  const allOutputs: ProviderOutput[] = [];
  const steps: Omit<DirectorRunStep, 'id' | 'run_id' | 'org_id'>[] = [];
  let totalCost = 0;
  let creditsUsed = 0;
  let remainingCredits = options.availableCredits ?? Infinity;

  // Validate
  const validationErrors = validateGraph(nodes, edges);
  const criticalErrors = validationErrors.filter((e) => e.severity === 'error');
  if (criticalErrors.length > 0) {
    for (const err of criticalErrors) {
      callbacks.onLog({ timestamp: new Date().toISOString(), level: 'error', message: err.message, nodeId: err.nodeId });
      errors.push(err.message);
    }
    return { success: false, outputs: [], steps: [], totalCost: 0, creditsUsed: 0, errors };
  }

  // Log warnings
  const warnings = validationErrors.filter((e) => e.severity === 'warning');
  for (const warn of warnings) {
    callbacks.onLog({ timestamp: new Date().toISOString(), level: 'warn', message: warn.message, nodeId: warn.nodeId });
  }

  // Sort nodes and group into parallel levels
  const sortedNodes = topologicalSort(nodes, edges);
  const nodeOutputs = new Map<string, Record<string, any>>();
  const total = sortedNodes.length;

  // Build dependency map for parallel execution
  const nodeDeps = new Map<string, Set<string>>();
  for (const node of sortedNodes) {
    const deps = new Set<string>();
    for (const edge of edges) {
      if (edge.target_node_id === node.id) deps.add(edge.source_node_id);
    }
    nodeDeps.set(node.id, deps);
  }

  // Group into execution levels (nodes at same level can run in parallel)
  const levels: DirectorNode[][] = [];
  const assigned = new Set<string>();
  while (assigned.size < sortedNodes.length) {
    const level: DirectorNode[] = [];
    for (const node of sortedNodes) {
      if (assigned.has(node.id)) continue;
      const deps = nodeDeps.get(node.id)!;
      const allDepsResolved = [...deps].every((d) => assigned.has(d));
      if (allDepsResolved) level.push(node);
    }
    if (level.length === 0) break; // safety
    for (const n of level) assigned.add(n.id);
    levels.push(level);
  }

  let completedCount = 0;

  for (const level of levels) {
    if (options.abortSignal?.aborted) {
      errors.push('Run cancelled by user');
      callbacks.onLog({ timestamp: new Date().toISOString(), level: 'warn', message: 'Run cancelled by user' });
      break;
    }

    // Execute all nodes in this level in parallel
    const levelResults = await Promise.allSettled(
      level.map(async (node) => {
        await executeOneNode(node);
      }),
    );

    // Check for failures
    for (let li = 0; li < levelResults.length; li++) {
      if (levelResults[li].status === 'rejected') {
        const reason = (levelResults[li] as PromiseRejectedResult).reason;
        const errMsg = reason?.message || String(reason);
        errors.push(`${level[li].title}: ${errMsg}`);
        callbacks.onLog({ timestamp: new Date().toISOString(), nodeId: level[li].id, level: 'error', message: errMsg });
        callbacks.onNodeError?.(level[li].id, errMsg);
      }
    }

    if (errors.length > 0) {
      callbacks.onLog({ timestamp: new Date().toISOString(), level: 'warn', message: `${errors.length} error(s) so far — continuing execution for independent branches` });
    }
  }

  async function executeOneNode(node: DirectorNode) {
    const i = sortedNodes.indexOf(node);
    const def = getNodeDef(node.type);
    if (!def) return;

    callbacks.onNodeStart(node.id);
    callbacks.onProgress((i / total) * 100);
    callbacks.onLog({
      timestamp: new Date().toISOString(),
      level: 'info',
      message: `Executing "${def.displayName}"...`,
      nodeId: node.id,
    });

    const startedAt = new Date().toISOString();

    // Gather inputs from connected upstream nodes
    const inputs: Record<string, any> = {};
    for (const edge of edges) {
      if (edge.target_node_id === node.id) {
        const sourceOutputs = nodeOutputs.get(edge.source_node_id);
        if (sourceOutputs && edge.source_handle) {
          inputs[edge.target_handle || 'input'] = sourceOutputs[edge.source_handle];
        }
      }
    }

    try {
      let outputs: Record<string, any> = {};

      if (def.providerBound) {
        const data = node.data_json as Record<string, any>;
        const provider = data?.provider || def.defaultData?.provider;
        const model = data?.model || def.defaultData?.model;

        // Check model status before executing
        if (model) {
          const modelEntry = getModelEntry(model);
          if (modelEntry && modelEntry.status !== 'active') {
            const msg = `Model "${modelEntry.displayName}" is not active (status: ${modelEntry.status}). Skipping node.`;
            callbacks.onLog({ timestamp: new Date().toISOString(), level: 'error', message: msg, nodeId: node.id });
            errors.push(`${def.displayName}: ${msg}`);
            callbacks.onNodeError(node.id, msg);
            steps.push({
              node_id: node.id,
              provider,
              model,
              status: 'skipped',
              input_json: inputs,
              output_json: {},
              usage_json: {},
              error_json: { message: msg },
              started_at: startedAt,
              finished_at: new Date().toISOString(),
            });
            return;
          }
        }

        // Credit check before execution
        const estimatedCost = providerRegistry.estimateCost({ provider, model, params: data || {}, inputs });
        if (estimatedCost > remainingCredits) {
          const msg = `Insufficient credits: need ~${estimatedCost} but only ${remainingCredits} remaining`;
          callbacks.onLog({ timestamp: new Date().toISOString(), level: 'error', message: msg, nodeId: node.id });
          errors.push(`${def.displayName}: ${msg}`);
          callbacks.onNodeError(node.id, msg);
          steps.push({
            node_id: node.id,
            provider,
            model,
            status: 'failed',
            input_json: inputs,
            output_json: {},
            usage_json: {},
            error_json: { code: 'INSUFFICIENT_CREDITS', message: msg },
            started_at: startedAt,
            finished_at: new Date().toISOString(),
          });
          throw new Error(msg); // Abort the entire run
        }

        // Execute via provider
        const request: ProviderRequest = {
          provider,
          model,
          params: { ...def.defaultData, ...data },
          inputs,
        };

        // Execute with retry (1 retry on failure)
        let response: ProviderResponse;
        const MAX_RETRIES = 1;
        for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
          response = await providerRegistry.execute(request);
          if (response.success) break;
          if (attempt < MAX_RETRIES) {
            callbacks.onLog({
              timestamp: new Date().toISOString(),
              nodeId: node.id,
              level: 'warn',
              message: `Attempt ${attempt + 1} failed: ${response.error?.message || 'Unknown error'}. Retrying...`,
            });
            await new Promise((r) => setTimeout(r, 2000)); // Wait 2s before retry
          }
        }

        if (!response!.success) {
          throw new Error(response!.error?.message || 'Provider execution failed after retry');
        }

        // Map outputs and attach metadata
        for (const output of response.outputs) {
          const enrichedOutput: ProviderOutput = {
            ...output,
            metadata: {
              ...(output.metadata || {}),
              flowId: options.flowId ?? null,
              nodeId: node.id,
              nodeType: node.type,
              provider,
              model,
              timestamp: new Date().toISOString(),
            },
          };

          if (output.kind === 'image') outputs['image'] = output.url || output.data;
          else if (output.kind === 'video') outputs['video'] = output.url || output.data;
          else if (output.kind === 'text') outputs['text'] = output.data;
          else outputs['output'] = output.url || output.data;

          allOutputs.push(enrichedOutput);
          callbacks.onOutput(enrichedOutput);
        }

        const stepCost = response.cost.credits;
        totalCost += stepCost;
        creditsUsed += stepCost;
        remainingCredits -= stepCost;

        steps.push({
          node_id: node.id,
          provider,
          model,
          status: 'completed',
          input_json: inputs,
          output_json: outputs,
          usage_json: response.usage,
          started_at: startedAt,
          finished_at: new Date().toISOString(),
        });
      } else {
        // Non-provider nodes -- handle locally
        outputs = await executeLocalNode(node, inputs, def, callbacks);
        steps.push({
          node_id: node.id,
          provider: null,
          model: null,
          status: 'completed',
          input_json: inputs,
          output_json: outputs,
          usage_json: {},
          started_at: startedAt,
          finished_at: new Date().toISOString(),
        });
      }

      nodeOutputs.set(node.id, outputs);
      callbacks.onNodeComplete(node.id, outputs);
      const durationMs = Date.now() - new Date(startedAt).getTime();
      const durationLabel = durationMs < 1000 ? `${durationMs}ms` : `${(durationMs / 1000).toFixed(1)}s`;
      callbacks.onLog({
        timestamp: new Date().toISOString(),
        level: 'info',
        message: `"${def.displayName}" completed in ${durationLabel}`,
        nodeId: node.id,
      });
    } catch (err: any) {
      const errorMsg = err?.message || 'Unknown error';
      errors.push(`${def.displayName}: ${errorMsg}`);
      callbacks.onNodeError(node.id, errorMsg);
      callbacks.onLog({
        timestamp: new Date().toISOString(),
        level: 'error',
        message: `"${def.displayName}" failed: ${errorMsg}`,
        nodeId: node.id,
      });

      steps.push({
        node_id: node.id,
        provider: (node.data_json as any)?.provider || null,
        model: (node.data_json as any)?.model || null,
        status: 'failed',
        input_json: inputs,
        output_json: {},
        usage_json: {},
        error_json: { message: errorMsg },
        started_at: startedAt,
        finished_at: new Date().toISOString(),
      });

      // Stop on provider failure, continue for local node errors
      if (def.providerBound) {
        throw err;
      }
    }

    completedCount++;
    callbacks.onProgress(Math.round((completedCount / total) * 100));
  }

  callbacks.onProgress(100);
  return {
    success: errors.length === 0,
    outputs: allOutputs,
    steps,
    totalCost,
    creditsUsed,
    errors,
  };
}

// ---- Local Node Execution ---------------------------------------------------

async function executeLocalNode(
  node: DirectorNode,
  inputs: Record<string, any>,
  def: NodeRegistryEntry,
  callbacks: ExecutionCallbacks,
): Promise<Record<string, any>> {
  const data = node.data_json as Record<string, any>;

  switch (node.type) {
    // ── Text / prompt nodes ──
    case 'creative_direction':
      return {
        prompt: data.text || data.concept || '',
        negative_prompt: data._negativePrompt || data.negativePrompt || '',
      };
    case 'prompt':
      return { prompt: data.text || '' };
    case 'text':
      return { text: data.value || '' };
    case 'style':
      return { text: inputs.prompt ? `${inputs.prompt}, ${data.style} style` : (data.style || '') };
    case 'prompt_concatenator':
      return { text: [inputs.text_a, inputs.text_b].filter(Boolean).join(data.separator || ' ') };

    // ── Datatype nodes ──
    case 'number':
      return { value: data.value ?? 0 };
    case 'toggle':
      return { value: !!data.value };
    case 'seed':
      return { seed: data.randomize ? Math.floor(Math.random() * 2147483647) : (data.value ?? -1) };
    case 'list_selector':
      return { value: (data.items || [])[data.selected_index || 0] ?? null };
    case 'array':
      return { array: [inputs.item_1, inputs.item_2].filter((v: any) => v != null) };

    // ── Import / source nodes ──
    case 'import':
      return { output: data.url || data.asset_id || null };
    case 'import_model':
      return { model: data.model_url || null };
    case 'import_lora':
      return { lora: data.lora_url || null, strength: data.strength ?? 0.8 };
    case 'import_multiple_loras':
      return { loras: data.loras || [] };
    case 'asset_library':
      return { asset: data.asset_id || null };

    // ── CRM context nodes ──
    case 'brand':
      return { brand: data.brand_profile_id || null };
    case 'campaign':
      return { campaign: data.campaign_id || null };
    case 'product':
      return { product: data.product_id || null };
    case 'audience':
      return { audience: data.audience_id || null };

    // ── Upscale / Inpaint (provider-bound but handled here for input mapping) ──
    case 'upscale':
    case 'inpaint':
      // These are providerBound — should not reach here. Fallback:
      return { image: inputs.image || null };

    // ── Routing / flow control ──
    case 'router': {
      // Conditional routing: evaluate condition to decide output_a or output_b
      const condition = data.condition || 'always_a';
      const conditionValue = data.condition_value || '';
      const inputVal = String(inputs.input || inputs.text || '');
      let useA = true;

      if (condition === 'always_b') useA = false;
      else if (condition === 'contains' && conditionValue) useA = inputVal.toLowerCase().includes(conditionValue.toLowerCase());
      else if (condition === 'not_contains' && conditionValue) useA = !inputVal.toLowerCase().includes(conditionValue.toLowerCase());
      else if (condition === 'equals' && conditionValue) useA = inputVal === conditionValue;
      else if (condition === 'not_empty') useA = inputVal.trim().length > 0;
      else if (condition === 'empty') useA = inputVal.trim().length === 0;
      // 'always_a' is default

      return {
        output_a: useA ? (inputs.input ?? null) : null,
        output_b: useA ? null : (inputs.input ?? null),
      };
    }

    // ── Image processing (Canvas API) ──
    case 'levels': {
      const { applyLevels } = await import('./image-processing');
      const result = await applyLevels(inputs.image, data.brightness || 0, data.contrast || 0, data.saturation || 0);
      return { image: result };
    }
    case 'crop': {
      const { applyCrop } = await import('./image-processing');
      const result = await applyCrop(inputs.image, data.x || 0, data.y || 0, data.width || 512, data.height || 512);
      return { image: result };
    }
    case 'resize': {
      const { applyResize } = await import('./image-processing');
      const result = await applyResize(inputs.image, data.width || 1024, data.height || 1024, data.maintain_aspect ?? true);
      return { image: result };
    }
    case 'blur': {
      const { applyBlur } = await import('./image-processing');
      const result = await applyBlur(inputs.image, data.radius || 5, data.type || 'gaussian');
      return { image: result };
    }
    case 'invert': {
      const { applyInvert } = await import('./image-processing');
      const result = await applyInvert(inputs.image);
      return { image: result };
    }
    case 'channels': {
      const { extractChannel } = await import('./image-processing');
      const result = await extractChannel(inputs.image, data.channel || 'all');
      return { image: result };
    }
    case 'compositor': {
      const { composite } = await import('./image-processing');
      const result = await composite(inputs.foreground, inputs.background, data.blend_mode || 'normal', data.opacity ?? 1);
      return { image: result };
    }
    case 'merge_alpha': {
      const { mergeAlpha } = await import('./image-processing');
      const result = await mergeAlpha(inputs.foreground, inputs.mask);
      return { image: result };
    }
    case 'matte_grow_shrink': {
      const { matteGrowShrink } = await import('./image-processing');
      const result = await matteGrowShrink(inputs.mask, data.amount || 0);
      return { mask: result };
    }
    case 'extract_video_frame': {
      const { extractVideoFrame } = await import('./image-processing');
      const result = await extractVideoFrame(inputs.video, data.frame_index || 0);
      return { image: result };
    }
    case 'painter':
      // Painter is interactive — in execution it passes through the input
      return { image: inputs.image ?? null };

    case 'text_overlay': {
      // Render text on image using Canvas API
      const srcUrl = inputs.image;
      if (!srcUrl) return { image: null };
      const overlayText = inputs.text || data.text || '';
      if (!overlayText) return { image: srcUrl };
      const { renderTextOverlay } = await import('./image-processing');
      const resultUrl = await renderTextOverlay(srcUrl, {
        text: overlayText,
        fontSize: data.font_size || 48,
        fontColor: data.font_color || '#ffffff',
        fontWeight: data.font_weight || 'bold',
        position: data.position || 'bottom-center',
        background: data.background || 'rgba(0,0,0,0.5)',
        padding: data.padding || 16,
      });
      return { image: resultUrl };
    }

    // ── Iterators ──
    case 'text_iterator': {
      const iterText = inputs.prompt || inputs.text || '';
      const iterSep = data.separator === '\\n' ? '\n' : (data.separator || '\n');
      const iterItems = String(iterText).split(iterSep).map((s: string) => s.trim()).filter(Boolean);
      // Output each item as a separate prompt — downstream nodes receive them via the graph
      return { prompt: iterItems.join('\n'), items: iterItems };
    }
    case 'image_iterator': {
      const imgs = Array.isArray(inputs.images) ? inputs.images : [inputs.images].filter(Boolean);
      return { image: imgs[0] || null, items: imgs };
    }
    case 'video_iterator': {
      const vids = Array.isArray(inputs.videos) ? inputs.videos : [inputs.videos].filter(Boolean);
      return { video: vids[0] || null, items: vids };
    }

    // ── Audio nodes ──
    case 'audio_import':
      return { audio: data.url || null };

    // ── Video editing nodes ──
    case 'video_trim':
      // Video trim/speed requires server-side ffmpeg — pass through with metadata
      callbacks.onLog({ timestamp: new Date().toISOString(), level: 'warn', message: `"${def.displayName}" is not yet implemented. Passing through input unchanged.`, nodeId: node.id });
      return { video: inputs.video || null, trim: { start: data.start_time, end: data.end_time, speed: data.speed } };

    case 'video_transition':
      // Transition requires server-side processing — output first clip with metadata
      callbacks.onLog({ timestamp: new Date().toISOString(), level: 'warn', message: `"${def.displayName}" is not yet implemented. Passing through input unchanged.`, nodeId: node.id });
      return { video: inputs.video_a || inputs.video_b || null, transition: data.transition_type };

    case 'storyboard': {
      // Output shots as structured text for downstream prompts
      const shots = Array.isArray(data.shots) ? data.shots : [];
      const shotsText = shots.map((s: any, i: number) =>
        `Shot ${i + 1}: ${s.scene || ''} | Camera: ${s.camera || 'static'} | Duration: ${s.duration || '3s'}`
      ).join('\n');
      return { shots: shotsText, prompt: shotsText };
    }

    // ── Video processing ──
    case 'video_concatenator':
      // Requires server-side ffmpeg — pass through for now, log warning
      callbacks.onLog({ timestamp: new Date().toISOString(), level: 'warn', message: `"${def.displayName}" is not yet implemented. Passing through input unchanged.`, nodeId: node.id });
      return { video: inputs.video_a || inputs.video_b || null };

    // ── Sink / visual-only nodes ──
    case 'preview':
      return {};
    case 'compare':
      return {};
    case 'sticky_note':
      return {};

    // ── Output / pass-through nodes ──
    case 'export':
    case 'output':
    case 'save_to_assets':
    case 'attach_to_campaign':
    case 'mark_approved':
      return { output: inputs.input ?? null };

    // ── Fallback ──
    default:
      return { output: inputs.input ?? null };
  }
}

// ---- Cost Estimation --------------------------------------------------------

export function estimateGraphCost(nodes: DirectorNode[], edges: DirectorEdge[]): number {
  let total = 0;
  for (const node of nodes) {
    const def = getNodeDef(node.type);
    if (!def?.providerBound) continue;

    const data = node.data_json as Record<string, any>;
    const provider = data?.provider || def.defaultData?.provider;
    const model = data?.model || def.defaultData?.model;

    if (provider && model) {
      // Prefer catalog credit cost if available
      const modelEntry = getModelEntry(model);
      if (modelEntry) {
        total += modelEntry.creditCost;
      } else {
        total += providerRegistry.estimateCost({
          provider,
          model,
          params: data || {},
          inputs: {},
        });
      }
    }
  }
  return total;
}
