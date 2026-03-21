import type { NodeTypes } from '@xyflow/react';

import PromptNode from './PromptNode';
import ImageGeneratorNode from './ImageGeneratorNode';
import VideoGeneratorNode from './VideoGeneratorNode';
import PreviewNode from './PreviewNode';
import GenericNode from './GenericNode';
import CreativeDirectionNode from './CreativeDirectionNode';

// ---------------------------------------------------------------------------
// Re-exports
// ---------------------------------------------------------------------------

export { PromptNode, ImageGeneratorNode, VideoGeneratorNode, PreviewNode, GenericNode, CreativeDirectionNode };

// ---------------------------------------------------------------------------
// Node-type map consumed by <ReactFlow nodeTypes={nodeTypes} />
//
// - `active` nodes with a dedicated component get their own entry.
// - `active` nodes without a dedicated component fall through to GenericNode.
// - `coming_soon` nodes map to GenericNode (renders with a "coming soon" badge
//   via the registry status at runtime).
// - `internal_only` nodes are deliberately excluded from this map so they
//   cannot be placed on the canvas.
// - The `default` key is ReactFlow's built-in fallback.
// ---------------------------------------------------------------------------

export const nodeTypes: NodeTypes = {
  // -- Dedicated components (active) -----------------------------------------
  creative_direction: CreativeDirectionNode,
  prompt: PromptNode,
  image_generator: ImageGeneratorNode,
  video_generator: VideoGeneratorNode,
  preview: PreviewNode,

  // -- Active nodes -> GenericNode -------------------------------------------
  import: GenericNode,
  export: GenericNode,
  prompt_concatenator: GenericNode,
  prompt_enhancer: GenericNode,
  router: GenericNode,
  output: GenericNode,
  sticky_note: GenericNode,
  compare: GenericNode,
  number: GenericNode,
  text: GenericNode,
  toggle: GenericNode,
  seed: GenericNode,
  brand: GenericNode,
  campaign: GenericNode,
  product: GenericNode,
  audience: GenericNode,
  asset_library: GenericNode,
  save_to_assets: GenericNode,
  attach_to_campaign: GenericNode,
  mark_approved: GenericNode,
  style: GenericNode,

  upscale: GenericNode,
  inpaint: GenericNode,
  text_overlay: GenericNode,
  remove_background: GenericNode,
  tts: GenericNode,
  music_generator: GenericNode,
  lip_sync: GenericNode,
  audio_import: GenericNode,
  video_trim: GenericNode,
  video_transition: GenericNode,
  storyboard: GenericNode,

  // -- Coming soon nodes -> GenericNode --------------------------------------
  import_model: GenericNode,
  import_lora: GenericNode,
  import_multiple_loras: GenericNode,
  kling_o3_edit_video: GenericNode,
  levels: GenericNode,
  compositor: GenericNode,
  painter: GenericNode,
  crop: GenericNode,
  resize: GenericNode,
  blur: GenericNode,
  invert: GenericNode,
  channels: GenericNode,
  extract_video_frame: GenericNode,
  video_concatenator: GenericNode,
  mask_extractor: GenericNode,
  mask_by_text: GenericNode,
  matte_grow_shrink: GenericNode,
  merge_alpha: GenericNode,
  video_matte: GenericNode,
  video_mask_by_text: GenericNode,
  run_any_llm: GenericNode,
  image_describer: GenericNode,
  video_describer: GenericNode,
  text_iterator: GenericNode,
  image_iterator: GenericNode,
  video_iterator: GenericNode,
  depth_anything_v2: GenericNode,
  kling_element: GenericNode,
  list_selector: GenericNode,
  array: GenericNode,

  // -- ReactFlow fallback ----------------------------------------------------
  default: GenericNode,
};
