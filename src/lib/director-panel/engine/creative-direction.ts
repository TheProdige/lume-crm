// ═══════════════════════════════════════════════════════════════════════════
// Creative Direction Engine
// Transforms user intent into structured, optimized generation packages.
// ═══════════════════════════════════════════════════════════════════════════

// ─── Types ──────────────────────────────────────────────────────────────────

export interface CreativeDirection {
  concept: string;
  subject: string;
  wardrobe?: string;
  environment: string;
  mood: string;
  lighting: string;
  composition: string;
  camera: string;
  motion?: string;
  realismLevel: number; // 1-10
  artisticDirection?: string;
  brandTone?: string;
  shotType: ShotType;
  cameraAngle: CameraAngle;
  cameraMovement?: CameraMovement;
  lensType?: string;
  depthOfField?: string;
  negativePrompt: string;
  continuityLock?: ContinuityLock;
  references?: ReferenceEntry[];
  styleDna?: StyleDna;
}

export interface StyleDna {
  name: string;
  colorPalette: string[];
  lighting: string;
  contrast: 'low' | 'medium' | 'high' | 'extreme';
  texture: string;
  cameraStyle: string;
  composition: string;
  realismLevel: number;
  brandDescriptors: string[];
  visualRules: string[];
  negativeRules: string[];
}

export interface ContinuityLock {
  characterIdentity?: string;
  face?: string;
  outfit?: string;
  product?: string;
  environment?: string;
  lighting?: string;
  colorPalette?: string[];
  tone?: string;
  framingStyle?: string;
}

export interface ReferenceEntry {
  type: 'subject' | 'face' | 'outfit' | 'product' | 'environment' | 'composition' | 'style' | 'color' | 'motion';
  url: string;
  weight: number; // 0-1
  description?: string;
}

export type ShotType =
  | 'extreme_close_up' | 'close_up' | 'medium_close_up' | 'medium_shot'
  | 'medium_full_shot' | 'full_shot' | 'wide_shot' | 'extreme_wide_shot'
  | 'overhead' | 'macro' | 'editorial_portrait';

export type CameraAngle =
  | 'eye_level' | 'low_angle' | 'high_angle' | 'dutch_angle'
  | 'birds_eye' | 'worms_eye' | 'pov' | 'over_shoulder';

export type CameraMovement =
  | 'static' | 'dolly_in' | 'dolly_out' | 'dolly_left' | 'dolly_right'
  | 'pan_left' | 'pan_right' | 'tilt_up' | 'tilt_down'
  | 'orbit' | 'tracking' | 'handheld' | 'crane_up' | 'crane_down'
  | 'zoom_in' | 'zoom_out' | 'push_in' | 'pull_back';

export interface PromptScore {
  total: number; // 0-100
  clarity: number;
  specificity: number;
  cinematicDirection: number;
  visualConsistency: number;
  realismReadiness: number;
  continuityReadiness: number;
  issues: string[];
  suggestions: string[];
}

export interface GenerationPackage {
  direction: CreativeDirection;
  optimizedPrompt: string;
  negativePrompt: string;
  score: PromptScore;
  modelRecommendation: string;
  aspectRatio: string;
  qualityPreset: string;
}

// ─── Shot Type Descriptions ─────────────────────────────────────────────────

const SHOT_DESCRIPTIONS: Record<ShotType, string> = {
  extreme_close_up: 'extreme close-up shot, filling the frame with fine detail',
  close_up: 'close-up shot, head and shoulders framing',
  medium_close_up: 'medium close-up, chest-up framing',
  medium_shot: 'medium shot, waist-up framing',
  medium_full_shot: 'medium full shot, knees-up framing',
  full_shot: 'full body shot, full figure visible with some environment',
  wide_shot: 'wide shot, full figure small in frame with prominent environment',
  extreme_wide_shot: 'extreme wide shot, vast landscape with small figure',
  overhead: 'overhead shot, directly above looking down',
  macro: 'macro photography, extreme detail of small subject',
  editorial_portrait: 'editorial portrait, fashion magazine composition',
};

const CAMERA_ANGLE_DESCRIPTIONS: Record<CameraAngle, string> = {
  eye_level: 'eye level angle, natural perspective',
  low_angle: 'low angle, looking up at subject, emphasizing power',
  high_angle: 'high angle, looking down at subject',
  dutch_angle: 'dutch angle, tilted frame creating tension',
  birds_eye: 'bird\'s eye view, directly from above',
  worms_eye: 'worm\'s eye view, extreme low angle from ground',
  pov: 'point of view shot, first person perspective',
  over_shoulder: 'over the shoulder framing',
};

const CAMERA_MOVEMENT_DESCRIPTIONS: Record<CameraMovement, string> = {
  static: 'static camera, no movement',
  dolly_in: 'slow dolly in toward subject',
  dolly_out: 'slow dolly out from subject',
  dolly_left: 'dolly movement to the left',
  dolly_right: 'dolly movement to the right',
  pan_left: 'smooth pan to the left',
  pan_right: 'smooth pan to the right',
  tilt_up: 'tilt upward revealing scene',
  tilt_down: 'tilt downward revealing scene',
  orbit: 'smooth orbit around subject',
  tracking: 'tracking shot following subject movement',
  handheld: 'handheld camera, natural subtle motion',
  crane_up: 'crane shot rising upward',
  crane_down: 'crane shot descending',
  zoom_in: 'slow zoom into subject',
  zoom_out: 'slow zoom out from subject',
  push_in: 'push in toward subject with intensity',
  pull_back: 'pull back revealing wider scene',
};

// ─── Prompt Quality Scorer ──────────────────────────────────────────────────

export function scorePrompt(prompt: string, direction?: Partial<CreativeDirection>): PromptScore {
  const issues: string[] = [];
  const suggestions: string[] = [];
  const words = prompt.trim().split(/\s+/).length;

  // Clarity (0-20)
  let clarity = 0;
  if (words >= 5) clarity += 5;
  if (words >= 15) clarity += 5;
  if (words >= 30) clarity += 5;
  if (!/\b(thing|stuff|something|nice|cool|good|bad)\b/i.test(prompt)) clarity += 5;
  else issues.push('Vague words detected (thing, stuff, nice, cool)');

  // Specificity (0-20)
  let specificity = 0;
  const hasSubject = /\b(person|man|woman|model|figure|product|building|car|landscape|portrait|scene)\b/i.test(prompt);
  const hasAction = /\b(standing|sitting|walking|running|looking|holding|wearing|floating|flying)\b/i.test(prompt);
  const hasDetail = /\b(detailed|intricate|textured|smooth|rough|metallic|glass|wooden|fabric)\b/i.test(prompt);
  const hasColor = /\b(red|blue|green|gold|silver|black|white|warm|cool|muted|vibrant|pastel)\b/i.test(prompt);
  if (hasSubject) specificity += 5; else suggestions.push('Add a clear subject (person, product, scene)');
  if (hasAction) specificity += 5;
  if (hasDetail) specificity += 5;
  if (hasColor) specificity += 5; else suggestions.push('Add color direction');

  // Cinematic Direction (0-20)
  let cinematic = 0;
  const hasLighting = /\b(light|lighting|shadow|backlit|rim|volumetric|golden.?hour|sunset|sunrise|studio|natural|dramatic|soft|harsh|ambient)\b/i.test(prompt);
  const hasCamera = /\b(close.?up|wide.?shot|full.?shot|medium|overhead|low.?angle|portrait|macro|depth.?of.?field|bokeh|35mm|50mm|85mm)\b/i.test(prompt);
  const hasMood = /\b(cinematic|dramatic|moody|serene|intense|ethereal|mysterious|elegant|luxurious|gritty|nostalgic)\b/i.test(prompt);
  const hasComposition = /\b(centered|rule.?of.?thirds|symmetr|asymmetr|leading.?lines|negative.?space|framing|foreground|background)\b/i.test(prompt);
  if (hasLighting) cinematic += 5; else suggestions.push('Add lighting direction (e.g., soft natural light, dramatic rim lighting)');
  if (hasCamera) cinematic += 5; else suggestions.push('Add camera/shot description (e.g., close-up, 85mm lens)');
  if (hasMood) cinematic += 5; else suggestions.push('Add mood/atmosphere (e.g., cinematic, moody, elegant)');
  if (hasComposition) cinematic += 5;

  // Visual Consistency (0-15)
  let visualConsistency = 5; // base
  if (direction?.styleDna) visualConsistency += 5;
  if (direction?.brandTone) visualConsistency += 5;

  // Realism Readiness (0-15)
  let realism = 0;
  const hasQuality = /\b(4k|8k|high.?quality|professional|photorealistic|hyper.?realistic|ultra.?realistic|photo|photograph)\b/i.test(prompt);
  const hasTexture = /\b(skin|pores|fabric|texture|grain|film|analog|digital)\b/i.test(prompt);
  const hasEnvironment = /\b(studio|outdoor|indoor|urban|nature|interior|exterior|street|forest|ocean|desert|city)\b/i.test(prompt);
  if (hasQuality) realism += 5; else suggestions.push('Add quality marker (e.g., professional photography, 8k)');
  if (hasTexture) realism += 5;
  if (hasEnvironment) realism += 5;

  // Continuity Readiness (0-10)
  let continuity = 0;
  if (direction?.continuityLock) {
    const lock = direction.continuityLock;
    if (lock.characterIdentity || lock.face) continuity += 3;
    if (lock.environment || lock.lighting) continuity += 3;
    if (lock.colorPalette?.length) continuity += 4;
  } else {
    continuity = 5; // neutral if no continuity needed
  }

  const total = clarity + specificity + cinematic + visualConsistency + realism + continuity;

  if (total < 40) {
    suggestions.push('Prompt needs significant improvement for quality output');
  } else if (total < 60) {
    suggestions.push('Prompt is acceptable but could be enhanced');
  }

  return {
    total,
    clarity,
    specificity,
    cinematicDirection: cinematic,
    visualConsistency,
    realismReadiness: realism,
    continuityReadiness: continuity,
    issues,
    suggestions,
  };
}

// ─── Structured Prompt Builder ──────────────────────────────────────────────

export function buildOptimizedPrompt(direction: CreativeDirection): string {
  const parts: string[] = [];

  // 1. Shot & camera
  if (direction.shotType) {
    parts.push(SHOT_DESCRIPTIONS[direction.shotType] || direction.shotType);
  }
  if (direction.cameraAngle && direction.cameraAngle !== 'eye_level') {
    parts.push(CAMERA_ANGLE_DESCRIPTIONS[direction.cameraAngle] || direction.cameraAngle);
  }

  // 2. Subject
  if (direction.subject) {
    parts.push(direction.subject);
  }

  // 3. Wardrobe
  if (direction.wardrobe) {
    parts.push(`wearing ${direction.wardrobe}`);
  }

  // 4. Action/concept
  if (direction.concept && direction.concept !== direction.subject) {
    parts.push(direction.concept);
  }

  // 5. Environment
  if (direction.environment) {
    parts.push(`in ${direction.environment}`);
  }

  // 6. Lighting
  if (direction.lighting) {
    parts.push(`${direction.lighting} lighting`);
  }

  // 7. Mood
  if (direction.mood) {
    parts.push(`${direction.mood} mood`);
  }

  // 8. Composition
  if (direction.composition) {
    parts.push(direction.composition);
  }

  // 9. Camera details
  if (direction.lensType) {
    parts.push(`shot on ${direction.lensType}`);
  }
  if (direction.depthOfField) {
    parts.push(`${direction.depthOfField} depth of field`);
  }

  // 10. Artistic direction
  if (direction.artisticDirection) {
    parts.push(direction.artisticDirection);
  }

  // 11. Brand tone
  if (direction.brandTone) {
    parts.push(direction.brandTone);
  }

  // 12. Realism level
  if (direction.realismLevel >= 8) {
    parts.push('photorealistic, ultra-detailed, professional photography');
  } else if (direction.realismLevel >= 6) {
    parts.push('realistic, detailed');
  } else if (direction.realismLevel >= 4) {
    parts.push('semi-realistic, stylized');
  }

  // 13. Style DNA overrides
  if (direction.styleDna) {
    const dna = direction.styleDna;
    if (dna.colorPalette.length > 0) {
      parts.push(`${dna.colorPalette.join(', ')} color palette`);
    }
    if (dna.texture) parts.push(`${dna.texture} texture`);
    if (dna.contrast && dna.contrast !== 'medium') parts.push(`${dna.contrast} contrast`);
    for (const rule of dna.visualRules) {
      parts.push(rule);
    }
  }

  // 14. Continuity locks
  if (direction.continuityLock) {
    const lock = direction.continuityLock;
    if (lock.characterIdentity) parts.push(`same character: ${lock.characterIdentity}`);
    if (lock.face) parts.push(`same face: ${lock.face}`);
    if (lock.outfit) parts.push(`same outfit: ${lock.outfit}`);
    if (lock.environment) parts.push(`same environment: ${lock.environment}`);
    if (lock.lighting) parts.push(`same lighting: ${lock.lighting}`);
    if (lock.tone) parts.push(`same tone: ${lock.tone}`);
  }

  return parts.filter(Boolean).join('. ') + '.';
}

export function buildNegativePrompt(direction: CreativeDirection): string {
  const negatives: string[] = [
    'blurry', 'low quality', 'distorted', 'watermark', 'text overlay',
    'cropped awkwardly', 'bad anatomy', 'deformed',
  ];

  if (direction.realismLevel >= 7) {
    negatives.push('cartoon', 'anime', 'illustration', 'painting', 'cgi looking');
  }

  if (direction.styleDna?.negativeRules) {
    negatives.push(...direction.styleDna.negativeRules);
  }

  if (direction.negativePrompt) {
    negatives.push(direction.negativePrompt);
  }

  return [...new Set(negatives)].join(', ');
}

// ─── Video Motion Builder ───────────────────────────────────────────────────

export function buildMotionPrompt(direction: CreativeDirection): string {
  const parts: string[] = [];

  if (direction.cameraMovement) {
    parts.push(CAMERA_MOVEMENT_DESCRIPTIONS[direction.cameraMovement] || direction.cameraMovement);
  }

  if (direction.motion) {
    parts.push(direction.motion);
  }

  return parts.join('. ');
}

// ─── Auto-enhance from Simple Idea ──────────────────────────────────────────

export function directionFromIdea(idea: string, type: 'image' | 'video' = 'image'): CreativeDirection {
  const lower = idea.toLowerCase();

  // Detect subject
  let subject = idea;
  let environment = '';
  let mood = 'cinematic';
  let lighting = 'natural, soft';
  let shotType: ShotType = 'medium_shot';
  let cameraAngle: CameraAngle = 'eye_level';

  // Person detection
  if (/\b(person|man|woman|model|portrait|face|character)\b/i.test(lower)) {
    shotType = 'medium_close_up';
    lighting = 'soft studio lighting with subtle rim light';
  }

  // Product detection
  if (/\b(product|bottle|shoe|watch|bag|phone|car|jewelry)\b/i.test(lower)) {
    shotType = 'close_up';
    lighting = 'clean studio lighting, soft shadows';
    mood = 'elegant, premium';
    environment = 'minimal studio background';
  }

  // Landscape detection
  if (/\b(landscape|city|street|building|architecture|mountain|ocean|forest)\b/i.test(lower)) {
    shotType = 'wide_shot';
    lighting = 'golden hour, dramatic natural light';
    mood = 'epic, cinematic';
  }

  // Fashion detection
  if (/\b(fashion|runway|editorial|outfit|dress|suit|style)\b/i.test(lower)) {
    shotType = 'full_shot';
    lighting = 'editorial lighting, high contrast';
    mood = 'editorial, high fashion';
  }

  // Interior/real estate
  if (/\b(interior|room|kitchen|living|bedroom|bathroom|house|apartment)\b/i.test(lower)) {
    shotType = 'wide_shot';
    lighting = 'bright natural light from windows';
    mood = 'warm, inviting';
    cameraAngle = 'eye_level';
  }

  return {
    concept: idea,
    subject,
    environment,
    mood,
    lighting,
    composition: 'balanced, professional composition',
    camera: `${SHOT_DESCRIPTIONS[shotType]}, ${CAMERA_ANGLE_DESCRIPTIONS[cameraAngle]}`,
    shotType,
    cameraAngle,
    cameraMovement: type === 'video' ? 'dolly_in' : undefined,
    motion: type === 'video' ? 'subtle, natural movement' : undefined,
    realismLevel: 8,
    negativePrompt: '',
  };
}

// ─── Generation Package Builder ─────────────────────────────────────────────

export function buildGenerationPackage(
  direction: CreativeDirection,
  modelHint?: string,
  isVideo = false,
): GenerationPackage {
  const optimizedPrompt = buildOptimizedPrompt(direction);
  const negativePrompt = buildNegativePrompt(direction);
  const score = scorePrompt(optimizedPrompt, direction);

  // Model recommendation
  let modelRecommendation = modelHint || 'flux-2-pro';
  if (isVideo) {
    modelRecommendation = modelHint || 'wan-2.5';
  }
  if (direction.realismLevel >= 9 && !isVideo) {
    modelRecommendation = 'flux-pro-1.1-ultra';
  }

  // Aspect ratio
  let aspectRatio = '1:1';
  if (direction.shotType === 'wide_shot' || direction.shotType === 'extreme_wide_shot') {
    aspectRatio = '16:9';
  } else if (direction.shotType === 'editorial_portrait' || direction.shotType === 'full_shot') {
    aspectRatio = '3:4';
  }

  return {
    direction,
    optimizedPrompt,
    negativePrompt,
    score,
    modelRecommendation,
    aspectRatio,
    qualityPreset: direction.realismLevel >= 8 ? 'high' : 'standard',
  };
}

// ─── Prompt Enhancement Tools ───────────────────────────────────────────────

export function enhanceCinematic(prompt: string): string {
  const additions = [
    'cinematic lighting',
    'professional photography',
    'depth of field',
    'dramatic atmosphere',
    'film grain',
    '8k resolution',
  ];
  const existing = prompt.toLowerCase();
  const missing = additions.filter((a) => !existing.includes(a.toLowerCase()));
  return missing.length > 0 ? `${prompt}. ${missing.slice(0, 3).join(', ')}.` : prompt;
}

export function enhanceRealism(prompt: string): string {
  const additions = [
    'photorealistic',
    'ultra-detailed skin texture',
    'natural imperfections',
    'professional DSLR quality',
    'shot on Canon EOS R5',
  ];
  const existing = prompt.toLowerCase();
  const missing = additions.filter((a) => !existing.includes(a.toLowerCase()));
  return missing.length > 0 ? `${prompt}. ${missing.slice(0, 3).join(', ')}.` : prompt;
}

export function enhanceLuxury(prompt: string): string {
  return `${prompt}. luxury, premium quality, elegant composition, aspirational, high-end brand aesthetic, sophisticated lighting.`;
}

export function naturalizeUGC(prompt: string): string {
  return `${prompt}. candid, natural, authentic feel, smartphone quality, casual composition, real moment, unposed.`;
}
