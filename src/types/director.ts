// ---------------------------------------------------------------------------
// Director Panel – TypeScript Types
// Node-based creative generation system (ComfyUI/Weavy-style) for Lume CRM
// ---------------------------------------------------------------------------

// ---- Core domain models ---------------------------------------------------

export type DirectorFlowStatus = 'draft' | 'active' | 'archived';

export interface DirectorFlow {
  id: string;
  org_id: string;
  title: string;
  slug: string;
  description: string;
  status: DirectorFlowStatus;
  created_by: string;
  updated_by: string;
  template_id?: string;
  linked_campaign_id?: string;
  linked_product_id?: string;
  linked_brand_profile_id?: string;
  thumbnail_asset_id?: string;
  version_number: number;
  created_at: string;
  updated_at: string;
}

export interface DirectorNode {
  id: string;
  flow_id: string;
  org_id: string;
  type: string;
  category: NodeCategory;
  title: string;
  position_x: number;
  position_y: number;
  width?: number;
  height?: number;
  z_index: number;
  data_json: Record<string, any>;
  ui_json: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export type DirectorEdgeType = 'default' | 'animated' | 'step';

export interface DirectorEdge {
  id: string;
  flow_id: string;
  org_id: string;
  source_node_id: string;
  target_node_id: string;
  source_handle: string;
  target_handle: string;
  label?: string;
  edge_type: DirectorEdgeType;
  data_json: Record<string, any>;
  created_at: string;
  updated_at: string;
}

// ---- Run / execution models -----------------------------------------------

export type DirectorRunStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface DirectorRun {
  id: string;
  org_id: string;
  flow_id: string;
  status: DirectorRunStatus;
  triggered_by: string;
  cost_estimate_credits: number;
  cost_actual_credits: number;
  provider_cost_actual: number;
  started_at?: string;
  finished_at?: string;
  error_json?: Record<string, any>;
  result_summary_json?: Record<string, any>;
  created_at: string;
}

export type DirectorRunStepStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'skipped';

export interface DirectorRunStep {
  id: string;
  run_id: string;
  node_id: string;
  org_id: string;
  provider?: string;
  model?: string;
  status: DirectorRunStepStatus;
  input_json: Record<string, any>;
  output_json: Record<string, any>;
  usage_json: Record<string, any>;
  error_json?: Record<string, any>;
  started_at?: string;
  finished_at?: string;
}

// ---- Templates ------------------------------------------------------------

export type DirectorTemplateScope = 'global' | 'org';

export interface DirectorTemplate {
  id: string;
  org_id: string | null;
  scope: DirectorTemplateScope;
  title: string;
  slug: string;
  description: string;
  category: string;
  preview_asset_id?: string;
  flow_snapshot_json: Record<string, any>;
  created_at: string;
  updated_at: string;
}

// ---- Flow links -----------------------------------------------------------

export type DirectorFlowLinkEntityType =
  | 'campaign'
  | 'product'
  | 'brand'
  | 'audience';

export interface DirectorFlowLink {
  id: string;
  org_id: string;
  flow_id: string;
  entity_type: DirectorFlowLinkEntityType;
  entity_id: string;
  created_at: string;
}

// ---- Credits --------------------------------------------------------------

export interface OrgCreditBalance {
  org_id: string;
  credits_balance: number;
  updated_at: string;
}

export type OrgCreditTransactionKind = 'debit' | 'credit' | 'refund' | 'bonus';

export interface OrgCreditTransaction {
  id: string;
  org_id: string;
  kind: OrgCreditTransactionKind;
  amount: number;
  reason: string;
  run_id?: string;
  metadata_json: Record<string, any>;
  created_at: string;
}

// ---- Node system types ----------------------------------------------------

export type NodeCategory =
  | 'quick_access'
  | 'tools'
  | 'image_models'
  | 'video_models'
  | 'audio_models'
  | '3d_models'
  | 'custom_models'
  | 'crm'
  | 'output';

export type NodeStatus =
  | 'active'
  | 'coming_soon'
  | 'internal_only'
  | 'deprecated';

export type NodeIOKind =
  | 'text'
  | 'image'
  | 'video'
  | 'audio'
  | '3d'
  | 'any'
  | 'brand_context'
  | 'campaign_context'
  | 'product_context'
  | 'audience_context';

export interface NodeIOPort {
  id: string;
  label: string;
  kind: NodeIOKind;
  required?: boolean;
  multiple?: boolean;
}

export type InspectorFieldType =
  | 'text'
  | 'textarea'
  | 'select'
  | 'number'
  | 'slider'
  | 'toggle'
  | 'color'
  | 'image_upload'
  | 'video_upload'
  | 'model_select'
  | 'provider_select';

export interface InspectorField {
  key: string;
  label: string;
  type: InspectorFieldType;
  options?: { label: string; value: string }[];
  min?: number;
  max?: number;
  step?: number;
  defaultValue?: any;
  dependsOn?: string;
}

export interface NodeRegistryEntry {
  type: string;
  category: NodeCategory;
  subcategory?: string;
  displayName: string;
  description?: string;
  icon: string;
  status: NodeStatus;
  inputs: NodeIOPort[];
  outputs: NodeIOPort[];
  defaultData: Record<string, any>;
  inspectorFields?: InspectorField[];
  providerBound?: boolean;
}

// ---- Provider types -------------------------------------------------------

export type ProviderType =
  | 'fal'
  | 'google'
  | 'runway'
  | 'kling'
  | 'higgsfield'
  | 'openai'
  | 'stability'
  | 'luma'
  | 'minimax'
  | 'recraft'
  | 'ideogram'
  | 'topaz'
  | 'bria'
  | 'nvidia';

export interface ModelEntry {
  id: string;
  provider: ProviderType;
  displayName: string;
  icon?: string;
  category: string;
  subcategory: string;
  status: NodeStatus;
  capabilities: string[];
  defaultParams: Record<string, any>;
  creditCost: number;
  badge?: string;
}

export interface ProviderRequest {
  provider: ProviderType;
  model: string;
  params: Record<string, any>;
  inputs: Record<string, any>;
}

export interface ProviderOutput {
  kind: NodeIOKind;
  url?: string;
  data?: any;
  metadata?: Record<string, any>;
}

export interface ProviderResponse {
  success: boolean;
  outputs: ProviderOutput[];
  metadata: Record<string, any>;
  usage: {
    provider: string;
    model: string;
    duration_ms: number;
    input_tokens?: number;
    output_tokens?: number;
  };
  cost: {
    credits: number;
    provider_cost_usd?: number;
  };
  error?: {
    code: string;
    message: string;
  };
}

// ---- Editor state types ---------------------------------------------------

export type OutputPanelTab = 'logs' | 'outputs' | 'costs';

export interface RunLogEntry {
  timestamp: string;
  nodeId?: string;
  level: 'info' | 'warn' | 'error';
  message: string;
}

export interface RunState {
  status: 'idle' | 'running' | 'completed' | 'failed';
  runId: string | null;
  progress: number;
  currentNodeId: string | null;
  logs: RunLogEntry[];
  outputs: ProviderOutput[];
  costs: {
    estimated: number;
    actual: number;
  };
  nodeStates: Record<string, 'pending' | 'running' | 'completed' | 'error'>;
}

export interface FlowEditorState {
  flow: DirectorFlow | null;
  nodes: DirectorNode[];
  edges: DirectorEdge[];
  selectedNodeId: string | null;
  isDirty: boolean;
  runState: RunState;
  libraryOpen: boolean;
  inspectorOpen: boolean;
  outputPanelOpen: boolean;
  outputPanelTab: OutputPanelTab;
  zoom: number;
}

// ---- Template types -------------------------------------------------------

export type TemplateCategory =
  | 'marketing'
  | 'ecommerce'
  | 'social'
  | 'video'
  | 'branding';

export interface TemplateRecipe {
  generationType: 'image' | 'video' | 'both';
  defaultModels: string[];
  styleRules: string[];
  lightingRules: string[];
  compositionRules: string[];
  cameraRules: string[];
  motionRules: string[];
  subjectBehavior: string[];
  environmentRules: string[];
  continuityStrategy: string;
  negativeDefaults: string[];
  recommendedAspectRatios: string[];
  recommendedDuration?: string;
  referenceStrategy: string;
  qualityRules: string[];
  fallbackStrategy: string;
  antiFailureRules: string[];
}

export interface BuiltInTemplate {
  id: string;
  title: string;
  slug: string;
  description: string;
  category: TemplateCategory;
  previewUrl?: string;
  recipe?: TemplateRecipe;
  nodes: Omit<DirectorNode, 'id' | 'flow_id' | 'org_id' | 'created_at' | 'updated_at'>[];
  edges: Omit<DirectorEdge, 'id' | 'flow_id' | 'org_id' | 'created_at' | 'updated_at'>[];
}
