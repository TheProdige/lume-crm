/* ═══════════════════════════════════════════════════════════════
   AI Tools — Director Panel
   The AI acts as a creative guide: it helps users pick the right
   template, write great prompts, and opens the flow editor with
   everything pre-filled and ready to run.
   ═══════════════════════════════════════════════════════════════ */

import type { ToolDefinition, ToolContext, ToolResult } from '../types';

// ─── Template catalog ────────────────────────────────────────────────────────
// IMPORTANT: Template IDs must match src/lib/director-panel/config/templates.ts
// If you add/remove/rename a template, update BOTH files.

type TemplateInput = {
  field: string;
  label: string;
  hint: string;
  type: 'text' | 'image' | 'video' | 'select';
  required: boolean;
  options?: string[];
  example?: string;
};

type TemplateDef = {
  id: string;
  name: string;
  description: string;
  bestFor: string;
  howItWorks: string;
  inputs: TemplateInput[];
  tips: string[];
  creditCost: string;
};

const TEMPLATES: TemplateDef[] = [
  {
    id: 'tpl-consistent-character',
    name: 'Consistent Character',
    description: 'Generate a character portrait then create consistent multi-angle views and outfit variations. Uses Flux 2 Pro for the base portrait and Flux Kontext for variations.',
    bestFor: 'Character design, branding mascots, social media avatars, game assets, storyboard characters',
    howItWorks: '1. AI generates a detailed character portrait from your description\n2. Creates a multi-angle sheet (front, left, right, 3/4 view)\n3. Generates a variation with different clothing/pose\n4. All views maintain consistent facial features',
    inputs: [
      { field: 'character_description', label: 'Character Description', hint: 'Describe the character in detail: face shape, skin tone, hair, expression, distinguishing features, background.', type: 'text', required: true, example: 'A portrait of a woman with short reddish-brown hair, smooth skin, slightly bewildered gaze, metallic silver shimmer on ears, bright grey background, 45 degree angle' },
      { field: 'character_reference', label: 'Reference Photo (optional)', hint: 'Upload a photo of a real person or character to use as reference.', type: 'image', required: false, example: 'A headshot or selfie' },
      { field: 'variation_outfit', label: 'Outfit Variation', hint: 'Describe an alternate outfit or pose for the character variation.', type: 'text', required: true, example: 'Same character, looking right, wearing a silver coat, medium shot' },
      { field: 'style', label: 'Visual Style', hint: 'Overall visual style.', type: 'select', required: false, options: ['photographic', 'cinematic', 'anime', 'digital_art', 'illustration'], example: 'photographic' },
    ],
    tips: [
      'Be very specific about facial features — the AI uses this to keep the character consistent across views.',
      'A reference photo dramatically improves consistency between angles.',
      'Keep the background simple (solid color) for best multi-angle results.',
      'The variation step can change clothes, pose, or setting while keeping the face identical.',
    ],
    creditCost: '~14 credits (portrait 5cr + multi-angle 4cr + variation 4cr + enhance 1cr)',
  },
  {
    id: 'tpl-brand-ads',
    name: 'Brand Ad Campaign',
    description: 'Upload your product photo and brand assets — generates a full multi-format ad campaign (square for Instagram, story for Reels, banner for web). Removes background automatically.',
    bestFor: 'E-commerce ads, social media campaigns, product launches, brand marketing, multi-platform advertising',
    howItWorks: '1. Upload your product photo\n2. Background is automatically removed\n3. AI generates ads in 3 formats: 1:1 (Instagram feed), 9:16 (Stories/Reels), 16:9 (banners)\n4. Each format gets 2 variations to choose from\n5. Results are saved and linked to your CRM campaign',
    inputs: [
      { field: 'product_photo', label: 'Product Photo', hint: 'Upload a clear photo of your product on any background — the AI will remove it automatically.', type: 'image', required: true, example: 'A photo of your product (headphones, sunglasses, shoes, etc.)' },
      { field: 'ad_description', label: 'Ad Description / Direction', hint: 'Describe the ad style, mood, and feel you want. Think about your target audience.', type: 'text', required: true, example: 'Luxury e-commerce product advertisement. Premium studio lighting, elegant composition, brand-consistent color palette. Clean, modern, aspirational.' },
      { field: 'brand_colors', label: 'Brand Colors (optional)', hint: 'Your brand\'s primary colors so the AI can match them.', type: 'text', required: false, example: 'Gold and black, minimalist luxury feel' },
      { field: 'campaign_name', label: 'Campaign Name (optional)', hint: 'Name of the CRM campaign to link these ads to.', type: 'text', required: false, example: 'Summer Launch 2025' },
    ],
    tips: [
      'Use a high-quality product photo — the better the input, the better the ad.',
      'The AI removes the background automatically, so don\'t worry about the original background.',
      'Mention your brand style in the ad description (luxury, playful, minimal, bold, etc.).',
      'You get 2 variations per format (6 total) — pick the best from each.',
      'Results are auto-saved and can be linked to a CRM campaign.',
    ],
    creditCost: '~31 credits (BG removal 1cr + 3 formats × 2 images × 5cr)',
  },
  {
    id: 'tpl-virtual-try-on',
    name: 'Virtual Try On',
    description: 'Upload a product (clothing, shoes, accessory) and generate realistic photos of models wearing it. Uses two approaches: direct try-on and model generation with product editing.',
    bestFor: 'Fashion e-commerce, clothing brands, accessory brands, lookbook generation, online stores',
    howItWorks: '1. Upload your product image (shirt, shoes, etc.)\n2. AI generates a model wearing the product directly (approach 1)\n3. AI generates a model separately, then edits the product onto them (approach 2)\n4. Compare both results and pick the best',
    inputs: [
      { field: 'product_image', label: 'Product Photo', hint: 'Upload a clear photo of the product (flat lay or on hanger works best).', type: 'image', required: true, example: 'A photo of a t-shirt, dress, shoes, or bag laid flat' },
      { field: 'product_description', label: 'Product Description', hint: 'Describe the product and how you want it styled on the model.', type: 'text', required: true, example: 'Generate a model wearing this shirt, balenciaga photoshoot style, runway photoshoot, editorial lighting, full body shot' },
      { field: 'model_description', label: 'Model Description', hint: 'Describe the ideal model (gender, body type, pose, setting).', type: 'text', required: true, example: 'A fresh male model walking on a runway, short styled hair, plain background, emphasizing the attire' },
      { field: 'edit_instruction', label: 'Edit Instruction', hint: 'How to combine product + model in the second approach.', type: 'text', required: false, example: 'Add the shirt to the model, keep the pose and background the same, only change the clothing' },
    ],
    tips: [
      'Flat lay product photos work better than photos on hangers.',
      'For best results, describe the model\'s pose to match how the product should look when worn.',
      'The two-approach method (direct try-on vs. model+edit) gives you options to compare.',
      'Works for clothing, shoes, bags, jewelry, hats — anything wearable.',
    ],
    creditCost: '~18 credits (try-on 4cr + model gen 5cr + edit 4cr + extras)',
  },
  {
    id: 'tpl-product-ads',
    name: 'Product Ad with Video',
    description: 'Upload product photos, remove backgrounds, composite them into a lifestyle scene, then generate a cinematic showcase video. Full pipeline from raw photos to video ad.',
    bestFor: 'Product showcase videos, furniture/decor brands, lifestyle product marketing, social media video ads',
    howItWorks: '1. Upload 2 product photos\n2. Backgrounds are removed automatically\n3. Products are composited together\n4. AI generates a lifestyle scene around the products\n5. A cinematic showcase video is created from the scene\n6. Both the image and video are saved',
    inputs: [
      { field: 'product_photo_1', label: 'Product Photo 1', hint: 'Upload the main product photo.', type: 'image', required: true, example: 'A chair, a lamp, a vase — any product' },
      { field: 'product_photo_2', label: 'Product Photo 2', hint: 'Upload a second product to composite with the first.', type: 'image', required: true, example: 'A table, a rug, a plant — something complementary' },
      { field: 'scene_description', label: 'Scene Description', hint: 'Describe the lifestyle scene you want the products placed in.', type: 'text', required: true, example: 'A bright designer living room, soft natural light from large windows, minimal modern decor, warm tones' },
      { field: 'camera_direction', label: 'Camera Direction for Video', hint: 'How should the camera move in the video?', type: 'text', required: true, example: 'Camera rotating slowly, keeping the products in center, smooth cinematic dolly, luxury commercial feel' },
    ],
    tips: [
      'Use 2 products that look good together (chair + table, headphones + phone, etc.).',
      'The scene description determines the lifestyle context — be specific about the environment.',
      'Simple camera movements produce the most professional-looking videos.',
      'Great for furniture, decor, electronics, and luxury goods.',
    ],
    creditCost: '~37 credits (2× BG removal 2cr + composite 0cr + scene gen 4cr + video gen 25cr + extras)',
  },
  {
    id: 'tpl-video-manipulation',
    name: 'Video Manipulation',
    description: 'Start from one image and generate 4 completely different video variations with different moods, environments, and camera movements. Compare and pick your favorite.',
    bestFor: 'Music videos, social media content, mood exploration, creative direction, A/B testing video concepts',
    howItWorks: '1. Upload or describe your base image\n2. AI enhances the image if needed\n3. 4 different video prompts are applied: Rain, Explosion, Nature, Desert\n4. Each creates a unique 5-second video with different mood and camera movement\n5. Compare all 4 and save the ones you like',
    inputs: [
      { field: 'source_image', label: 'Source Image', hint: 'Upload an image to use as the starting point for all video variations.', type: 'image', required: true, example: 'A silhouette, a portrait, a landscape — any image works' },
      { field: 'base_description', label: 'Base Scene Enhancement', hint: 'Describe enhancements to apply to the source image before creating videos.', type: 'text', required: false, example: 'A silhouette standing in dramatic volumetric light rays, fog, mysterious atmosphere, cinematic' },
      { field: 'mood_1', label: 'Mood 1', hint: 'First video mood/environment.', type: 'text', required: false, example: 'Dark rainy night, puddle reflections, slow dolly forward' },
      { field: 'mood_2', label: 'Mood 2', hint: 'Second video mood/environment.', type: 'text', required: false, example: 'Massive explosion, fire and debris, camera shake, action movie' },
      { field: 'mood_3', label: 'Mood 3', hint: 'Third video mood/environment.', type: 'text', required: false, example: 'Green meadow, golden sunset, gentle breeze, peaceful and serene' },
      { field: 'mood_4', label: 'Mood 4', hint: 'Fourth video mood/environment.', type: 'text', required: false, example: 'Vast desert, sand blowing, orange sky, epic wide shot' },
    ],
    tips: [
      'Silhouettes and simple compositions work best as source images — they adapt to any mood.',
      'You can customize the 4 moods to match your project (romantic, horror, action, calm, etc.).',
      'Each video is 5 seconds at standard quality — upgrade to high quality for the one you pick.',
      'Great for A/B testing different vibes before committing to a final direction.',
    ],
    creditCost: '~104 credits (enhance 4cr + 4× video gen 25cr each)',
  },
  {
    id: 'tpl-architecture-angles',
    name: 'Architecture & Interior Angles',
    description: 'Generate an interior/architecture scene then create multiple camera angle variations (close-up, high angle, frontal), crops, and a cinematic walkthrough video.',
    bestFor: 'Interior design portfolios, real estate marketing, architecture visualization, home staging, Airbnb listings',
    howItWorks: '1. AI generates a base interior scene\n2. Creates 3 angle variations (close-up, high angle, frontal)\n3. Crops a detail shot\n4. Generates a cinematic walkthrough video',
    inputs: [
      { field: 'scene_description', label: 'Interior/Scene Description', hint: 'Describe the room: style, layout, lighting, key furniture.', type: 'text', required: true, example: 'Living room, scandinavian design, wide shot, kitchen, open space, natural light' },
      { field: 'angle_1', label: 'Close-up Focus', hint: 'What to focus on for the close-up shot.', type: 'text', required: false, example: 'Close up of the kitchen table with fruits and decor' },
      { field: 'angle_2', label: 'Alternative Angle', hint: 'Describe a different camera angle.', type: 'text', required: false, example: 'High angle bird eye view of the entire room' },
      { field: 'camera_direction', label: 'Video Camera Movement', hint: 'How the camera moves for the walkthrough video.', type: 'text', required: false, example: 'Camera dolly in from the living room to the kitchen, smooth cinematic movement' },
    ],
    tips: [
      'Start with a wide establishing shot for the base scene.',
      'Simple room descriptions with a clear style (scandinavian, industrial, bohemian) work best.',
      'The walkthrough video creates a virtual tour effect — great for real estate.',
    ],
    creditCost: '~46 credits (scene 5cr + 3 angles 12cr + crop 0cr + enhance 4cr + video 25cr)',
  },
  {
    id: 'tpl-text-iterator',
    name: 'Batch Image Generator',
    description: 'Enter a list of subjects and a style — generates one image per subject automatically. Like "Dog + Hipster", "Cat + Hipster", "Giraffe + Hipster".',
    bestFor: 'Sticker packs, avatar series, product line variations, character collections, themed image sets',
    howItWorks: '1. Enter your list of subjects (one per line)\n2. Enter the style to apply to all subjects\n3. AI combines each subject + style\n4. Generates an image for each combination',
    inputs: [
      { field: 'subjects', label: 'Subject List', hint: 'Enter each subject on a new line. Each one will get its own image.', type: 'text', required: true, example: 'Dog\nCat\nGiraffe\nOwl\nFox' },
      { field: 'style', label: 'Style to Apply', hint: 'The visual style applied to every subject.', type: 'text', required: true, example: 'Hipster, wearing flannel shirt and round glasses, sitting in a coffee shop, portrait photography' },
    ],
    tips: [
      'Keep subjects short (one word or phrase) — they get combined with the style.',
      'Works great for creating a themed series with consistent style.',
      'Try animals, professions, emotions, or objects as subjects.',
    ],
    creditCost: '~5 credits per subject (Flux 2 Pro)',
  },
  {
    id: 'tpl-image-describer',
    name: 'Image Describe & Regenerate',
    description: 'Generate a creative image, let AI describe it in detail, then regenerate from that description — creates unique variations while preserving the essence.',
    bestFor: 'Creative exploration, artistic variations, concept iteration, mood boards, style discovery',
    howItWorks: '1. Generate an image from your creative prompt\n2. AI vision analyzes and describes the image in detail\n3. That description is used to regenerate a new variation\n4. Compare original vs variation side by side',
    inputs: [
      { field: 'creative_prompt', label: 'Creative Concept', hint: 'A detailed, creative prompt for the initial image.', type: 'text', required: true, example: 'Analog photography, a woman stands in front of a mysteriously floating doorway in a vast empty environment, ethereal mystery, Nordic cinema elegance, silver and pale granite gray palette' },
    ],
    tips: [
      'The more poetic and detailed your initial prompt, the more interesting the variations.',
      'The AI description captures elements you might not have explicitly described.',
      'Great for discovering unexpected interpretations of your concept.',
    ],
    creditCost: '~11 credits (original 5cr + describe 1cr + variation 5cr)',
  },
  {
    id: 'tpl-change-face',
    name: 'Change Face (Mask & Inpaint)',
    description: 'Generate a fashion model, mask the face area with the painter tool, then replace it with a different face using AI inpainting. Includes a second model variation with resize.',
    bestFor: 'Fashion photography, model replacement, face anonymization, creative portraits, lookbook generation',
    howItWorks: '1. Generate a model photo from description\n2. Use the Painter node to mask the face area\n3. Write what the new face should look like\n4. AI replaces only the masked area\n5. A second model variation is generated and resized for comparison',
    inputs: [
      { field: 'model_description', label: 'Model Description', hint: 'Describe the model\'s body, clothing, pose, and setting. The face will be replaced later.', type: 'text', required: true, example: 'A full shot of a male model, long hair, high-fashion designer clothing, 3:4 aspect ratio, posing directly towards camera' },
      { field: 'face_instruction', label: 'New Face Description', hint: 'What should the replacement face look like?', type: 'text', required: true, example: 'Replace the face and hair with a different character, keep proportions and everything else the same' },
      { field: 'reference_photo', label: 'Face Reference Photo (optional)', hint: 'Upload a photo of the face you want to use.', type: 'image', required: false },
    ],
    tips: [
      'The Painter node lets you manually mask the exact area to replace — be precise for best results.',
      'Works best with clear, well-lit model photos.',
      'The sticky note in the template explains the process step by step.',
    ],
    creditCost: '~18 credits (model gen 5cr + alt model 5cr + inpaint 4cr + extras)',
  },
  {
    id: 'tpl-illustration-machine',
    name: 'Illustration Machine',
    description: 'Upload a style reference illustration → AI analyzes the visual style → batch generates new illustrations in that exact style from different scene prompts. Creates a cohesive illustration set.',
    bestFor: 'Brand illustration sets, children\'s books, editorial illustrations, social media series, pitch decks, presentation graphics',
    howItWorks: '1. Upload a style reference image (your existing illustration)\n2. AI vision analyzes the colors, linework, composition style\n3. You provide 3 different scene descriptions\n4. Each scene is generated matching the reference style\n5. You get a cohesive set of 3 illustrations',
    inputs: [
      { field: 'style_reference', label: 'Style Reference Image', hint: 'Upload an illustration whose style you want to replicate. The AI will analyze colors, linework, composition.', type: 'image', required: true, example: 'An existing illustration from your brand, a style you admire, or a mood board' },
      { field: 'theme', label: 'Illustration Theme', hint: 'Overall theme and style keywords.', type: 'text', required: true, example: 'Colorful street illustrations with bold patterns, vibrant yellow and green palette, playful character design' },
      { field: 'scene_1', label: 'Scene 1', hint: 'First illustration scene.', type: 'text', required: true, example: 'Two friends sitting together reading books, relaxed poses, indoor cozy setting' },
      { field: 'scene_2', label: 'Scene 2', hint: 'Second illustration scene.', type: 'text', required: true, example: 'Group of people dancing at a rooftop party, sunset, city skyline' },
      { field: 'scene_3', label: 'Scene 3', hint: 'Third illustration scene.', type: 'text', required: true, example: 'A chef cooking in a modern kitchen, steam rising, fresh ingredients' },
    ],
    tips: [
      'The style reference is crucial — pick an illustration that best represents the look you want.',
      'Keep scene descriptions focused on actions and composition, not style (the style comes from the reference).',
      'Works best with illustrations that have a distinctive, recognizable style.',
      'You can add more scenes by duplicating the pattern in the editor.',
    ],
    creditCost: '~16 credits (style analysis 1cr + 3 illustrations × 5cr)',
  },
  {
    id: 'tpl-camera-angle-ideation',
    name: 'Camera Angle Ideation',
    description: 'Generate one scene, use AI to write 10 different camera angle prompts, then batch-generate all angles. Creates a full storyboard/shot list from a single image.',
    bestFor: 'Storyboarding, shot lists, cinematography planning, content series, multi-angle campaigns',
    howItWorks: '1. Generate base scene from prompt\n2. LLM creates 10 camera angle variations\n3. Each angle is applied to the base image\n4. Compare all angles side by side',
    inputs: [
      { field: 'scene_description', label: 'Scene Description', hint: 'Describe the base scene you want to explore from multiple angles.', type: 'text', required: true, example: 'A man walking in a desolate desert, holding a pink teddy bear, worn grey vest, gritty film texture' },
    ],
    tips: ['The LLM generates smart camera angles automatically — bird eye, worm eye, macro, wide, etc.', 'Great for pre-visualizing a shoot before actually filming.'],
    creditCost: '~22 credits (scene 5cr + LLM 1cr + 4 angles × 4cr)',
  },
  {
    id: 'tpl-image-to-video-compare',
    name: 'Image to Video (Multi-Model)',
    description: 'Generate one image then animate it with 4 different video AI models simultaneously. Compare which model gives the best animation for your scene.',
    bestFor: 'Finding the best video model, animation comparison, motion style exploration',
    howItWorks: '1. Generate a scene image\n2. Write an animation direction\n3. 4 video models animate the same image simultaneously\n4. Compare results side by side',
    inputs: [
      { field: 'scene', label: 'Scene Description', hint: 'Describe the image to generate.', type: 'text', required: true, example: 'A surreal inflated metallic couch between jagged rocks, pinkish sky at dusk' },
      { field: 'animation', label: 'Animation Direction', hint: 'How should the scene move?', type: 'text', required: true, example: 'Cats punching a hole in the couch, causing it to deflate' },
    ],
    tips: ['Each video model has different strengths — Wan for smooth motion, Kling for realism, LTX for speed.', 'Use 9:16 for social media, 16:9 for YouTube.'],
    creditCost: '~110 credits (image 5cr + 4 videos × 25cr avg)',
  },
  {
    id: 'tpl-compositor-advanced',
    name: 'Advanced Compositor',
    description: 'Generate objects, remove backgrounds, composite them into a scene, let AI describe the result, then generate a cinematic video. Full creative pipeline.',
    bestFor: 'Surreal art, product placement, creative advertising, music video concepts',
    howItWorks: '1. Generate scene + object images\n2. Remove backgrounds automatically\n3. Composite objects into scene\n4. AI describes the composite\n5. Generate video from the composite',
    inputs: [
      { field: 'scene', label: 'Base Scene', hint: 'The main scene/environment.', type: 'text', required: true, example: 'An ornately gilded art gallery with ethereal atmosphere' },
      { field: 'object', label: 'Object to Add', hint: 'What to composite into the scene.', type: 'text', required: true, example: 'A vintage walkie talkie with 80s retro feel' },
      { field: 'animation', label: 'Camera Movement', hint: 'How the video camera should move.', type: 'text', required: false, example: 'Extremely slow dolly, very cinematic movement' },
    ],
    tips: ['Works best with objects that contrast interestingly with the scene.', 'The AI description step ensures the video prompt captures all composited elements.'],
    creditCost: '~40 credits (2 images 10cr + 2 BG removal 2cr + composite 0cr + describe 1cr + video 25cr)',
  },
  {
    id: 'tpl-multi-image-models',
    name: 'Multiple Image Models Compare',
    description: 'Send the same prompt to 6 different image AI models and compare results side by side. Then animate the best one into a video.',
    bestFor: 'Model comparison, finding the right AI style, quality benchmarking, creative exploration',
    howItWorks: '1. Write one prompt\n2. 6 models generate simultaneously (Flux 2 Pro, Flux Fast, Recraft V4, Mystic, Reve, Nano Banana)\n3. Compare all results\n4. Animate the best into video',
    inputs: [
      { field: 'prompt', label: 'Image Prompt', hint: 'The prompt will be sent to all 6 models identically.', type: 'text', required: true, example: 'A man pushes a huge boulder on a grassy hill, surreal dreamlike, solid blue sky, rich earthtones' },
      { field: 'animation', label: 'Video Animation (optional)', hint: 'Direction for animating the best image.', type: 'text', required: false, example: 'Camera slowly rotating, entrance slow motion' },
    ],
    tips: ['Each model interprets prompts differently — Flux for photorealism, Recraft for design, Mystic for art.', 'Flux Fast is cheapest (1cr), Flux 2 Pro is highest quality (5cr).'],
    creditCost: '~46 credits (6 images ~23cr + video 25cr)',
  },
  {
    id: 'tpl-editing-images',
    name: 'Image Editing Pipeline',
    description: 'Upload model/product photos, then generate multiple edited versions in different scenes and contexts. Place the same model in a restaurant, on a street, with different products.',
    bestFor: 'Fashion editorials, lookbook generation, product placement in scenes, social media content series',
    howItWorks: '1. Upload model and product photos\n2. Write scene edit directions\n3. AI places model in different scenes\n4. Product is composited onto the model\n5. Compare all variations',
    inputs: [
      { field: 'model_photo', label: 'Model Photo', hint: 'Upload a photo of the model/person.', type: 'image', required: true },
      { field: 'product_photo', label: 'Product Photo (optional)', hint: 'Upload a product to place on the model.', type: 'image', required: false },
      { field: 'scene_1', label: 'Scene 1', hint: 'First environment to place the model in.', type: 'text', required: true, example: 'Luxury restaurant, warm ambient lighting, elegant atmosphere' },
      { field: 'scene_2', label: 'Scene 2', hint: 'Second environment.', type: 'text', required: true, example: 'City street at night, neon lights, urban fashion editorial' },
    ],
    tips: ['The model stays consistent across all scenes — only the background changes.', 'Works best with clean, well-lit model photos on simple backgrounds.'],
    creditCost: '~17 credits (2 scene edits 8cr + product edit 4cr + extras)',
  },
  {
    id: 'tpl-video-face-swap',
    name: 'Cinematic Video Face Swap',
    description: 'Advanced multi-step pipeline: generates a cinematic scene image, writes AI dialogue, creates a video, extracts a frame, inpaints a custom face onto it, then generates final videos from 2 different AI models for comparison.',
    bestFor: 'Cinematic shorts, music videos, artistic content, surreal face swaps, social media reels, creative ads',
    howItWorks: '1. AI generates a scene image from your description\n2. AI writes a short dialogue based on your direction\n3. The scene image is animated into a video\n4. A frame is extracted from the video\n5. Your custom face/character is inpainted onto the frame\n6. Two final videos are generated from the face-swapped image using different AI models\n7. You compare both results and save the best one',
    inputs: [
      {
        field: 'scene_description',
        label: 'Scene Description',
        hint: 'Describe the full visual scene: environment, character pose, lighting, mood, color palette, camera angle. The more specific you are, the better the result.',
        type: 'text',
        required: true,
        example: 'Grainy film photography, a solitary man standing in a quiet desert, surrounded by sand dunes, directional lighting casting elongated shadows, vintage rotary phone floating in front of him, muted beige and dusty rose palette, 90s surreal vibe',
      },
      {
        field: 'scene_reference_image',
        label: 'Scene Reference Image (optional)',
        hint: 'Upload a reference image if you want the AI to match a specific visual style, composition, or mood. This helps the AI understand what you\'re going for.',
        type: 'image',
        required: false,
        example: 'A photo of the location, a mood board, a screenshot from a film you like',
      },
      {
        field: 'face_description',
        label: 'Face / Character to Swap In',
        hint: 'Describe the face or character you want inpainted onto the video frame. Can be realistic, fantasy, animal, or abstract.',
        type: 'text',
        required: true,
        example: 'Big fur lion face with golden mane, realistic textures, piercing amber eyes',
      },
      {
        field: 'face_reference_image',
        label: 'Face Reference Image (optional)',
        hint: 'Upload a photo of the face you want to swap in. This gives the AI a visual reference for the inpainting step.',
        type: 'image',
        required: false,
        example: 'A selfie, a character design, a photo of the person/animal',
      },
      {
        field: 'dialogue_instruction',
        label: 'Dialogue / Speech',
        hint: 'What should the character say in the video? Either write the exact line, or give the AI a direction to generate it.',
        type: 'text',
        required: true,
        example: 'Write a dreamy poetic sentence, not longer than 8 seconds, no prefix. Something about standing on the edge of time.',
      },
      {
        field: 'vo_direction',
        label: 'Camera & Voice Direction',
        hint: 'How should the camera move? What\'s the voice-over tone? This controls the motion and feel of the video.',
        type: 'text',
        required: true,
        example: 'Dolly in slowly with gentle rotation. Whispered voice-over tone, intimate and reflective.',
      },
      {
        field: 'style',
        label: 'Visual Style',
        hint: 'Choose the overall visual style for the generation.',
        type: 'select',
        required: false,
        options: ['cinematic', 'photographic', 'anime', 'digital_art', 'film_noir', 'vintage', 'neon_punk', 'fantasy'],
        example: 'cinematic',
      },
      {
        field: 'aspect_ratio',
        label: 'Aspect Ratio',
        hint: '16:9 for landscape/YouTube, 9:16 for Instagram Reels/TikTok, 1:1 for square posts.',
        type: 'select',
        required: false,
        options: ['16:9', '9:16', '1:1'],
        example: '16:9',
      },
      {
        field: 'inspiration_video',
        label: 'Inspiration Video (optional)',
        hint: 'Upload a video you want to use as style inspiration. The AI will try to match the movement, pacing, and mood.',
        type: 'video',
        required: false,
        example: 'A music video clip, a film scene, a social media reel you admire',
      },
    ],
    tips: [
      'The more detailed your scene description, the better the result. Include colors, textures, lighting direction, and mood.',
      'For face swap: if you upload a reference photo, the result will be much more accurate than just a text description.',
      'Camera direction like "dolly in", "orbiting shot", "slow zoom" gives the video a professional cinematic feel.',
      'Keep dialogue short (under 8 seconds) for best lip-sync quality.',
      'The pipeline generates 2 versions with different AI models — compare them and pick the best one.',
      'For social media: use 9:16 for Reels/TikTok, 16:9 for YouTube, 1:1 for Instagram feed.',
      'If you\'re not happy with the result, try adjusting the scene description or face prompt and run again.',
    ],
    creditCost: '~80-120 credits (includes: image generation 5cr + LLM dialogue 1cr + video generation 25cr + frame extraction 0cr + face inpaint 4cr + 2x final videos 50cr)',
  },
];

export const directorTools: ToolDefinition[] = [
  // ─── List Available Templates ────────────────────────────────
  {
    id: 'director.list_templates',
    label: 'List Director Panel Templates',
    description:
      'List all available Director Panel templates with their descriptions and required inputs. Use this when the user wants to create content, generate images/videos, or asks what they can do with the Director Panel. Always call this first to recommend the right template.',
    category: 'read',
    requiredPermissions: [],
    parameters: [],
    execute: async (_params, _ctx): Promise<ToolResult> => {
      const list = TEMPLATES.map((t) => {
        const required = t.inputs.filter(i => i.required).map(i => `${i.label}`).join(', ');
        const optional = t.inputs.filter(i => !i.required).map(i => `${i.label}`).join(', ');
        return `**${t.name}**\n${t.description}\n\nBest for: ${t.bestFor}\nCost: ${t.creditCost}\n\nRequired: ${required}\nOptional (but recommended): ${optional}\n\nTips:\n${t.tips.map(tip => `• ${tip}`).join('\n')}`;
      }).join('\n\n---\n\n');

      return {
        success: true,
        data: { templates: TEMPLATES },
        summary: `Available templates:\n\n${list}`,
      };
    },
  },

  // ─── Get Template Details ────────────────────────────────────
  {
    id: 'director.get_template_info',
    label: 'Get Template Details',
    description:
      'Get detailed information about a specific template including all required inputs the user needs to provide. Use this after the user picks a template, to guide them through filling in each required field.',
    category: 'read',
    requiredPermissions: [],
    parameters: [
      { name: 'template_id', type: 'string', description: 'Template ID (e.g. "tpl-video-face-swap")', required: true },
    ],
    execute: async (params, _ctx): Promise<ToolResult> => {
      const tpl = TEMPLATES.find((t) => t.id === params.template_id);
      if (!tpl) {
        return { success: false, error: `Template "${params.template_id}" not found` };
      }

      const required = tpl.inputs.filter(i => i.required);
      const optional = tpl.inputs.filter(i => !i.required);

      let summary = `**${tpl.name}**\n\n${tpl.description}\n\n`;
      summary += `**How it works:**\n${tpl.howItWorks}\n\n`;
      summary += `**Cost:** ${tpl.creditCost}\n\n`;
      summary += `---\n\n**What I need from you:**\n\n`;

      required.forEach((f, i) => {
        summary += `${i + 1}. **${f.label}** (required)\n`;
        summary += `   ${f.hint}\n`;
        summary += `   _Example: ${f.example}_\n\n`;
      });

      if (optional.length > 0) {
        summary += `**Optional but recommended for better results:**\n\n`;
        optional.forEach((f) => {
          summary += `- **${f.label}** (${f.type})\n`;
          summary += `  ${f.hint}\n`;
          if (f.example) summary += `  _Example: ${f.example}_\n`;
          if (f.options) summary += `  Options: ${f.options.join(', ')}\n`;
          summary += '\n';
        });
      }

      summary += `---\n\n**Pro tips:**\n${tpl.tips.map(t => `• ${t}`).join('\n')}\n\n`;
      summary += `Give me your inputs one by one, or all at once — I'll put everything together for you.`;

      return {
        success: true,
        data: { template: tpl },
        summary,
      };
    },
  },

  // ─── Help Write a Prompt ─────────────────────────────────────
  {
    id: 'director.enhance_prompt',
    label: 'Enhance Creative Prompt',
    description:
      'Help the user write a better, more detailed prompt for AI image/video generation. Use this when the user gives a vague or short description and needs help making it detailed enough for good results. Transform their idea into a professional-quality prompt with style, lighting, composition, and mood details.',
    category: 'read',
    requiredPermissions: [],
    parameters: [
      { name: 'user_idea', type: 'string', description: 'The user\'s rough idea or description', required: true },
      { name: 'content_type', type: 'string', description: '"image" or "video"', required: false, default: 'image' },
      { name: 'style', type: 'string', description: 'Desired style: "cinematic", "photographic", "anime", "digital_art", "commercial", "editorial"', required: false },
    ],
    execute: async (params, _ctx): Promise<ToolResult> => {
      const idea = params.user_idea as string;
      const type = params.content_type || 'image';
      const style = params.style || 'photographic';

      // Build enhanced prompt locally with best practices
      const enhancementTips: Record<string, string> = {
        cinematic: 'cinematic lighting, dramatic shadows, shallow depth of field, film grain, anamorphic lens, color grading',
        photographic: 'professional photography, studio lighting, sharp focus, high detail, DSLR quality, natural colors',
        anime: 'anime style, cel-shaded, vibrant colors, detailed linework, studio quality animation',
        digital_art: 'digital illustration, detailed rendering, vibrant palette, concept art quality',
        commercial: 'clean commercial photography, bright even lighting, product-focused, advertising quality',
        editorial: 'editorial photography, natural light, candid feel, magazine quality, authentic mood',
      };

      const tip = enhancementTips[style as string] || enhancementTips.photographic;
      const enhanced = `${idea}, ${tip}, 4K quality, highly detailed`;
      const negative = 'blurry, low quality, watermark, text overlay, deformed, ugly, duplicate';

      return {
        success: true,
        data: { enhanced_prompt: enhanced, negative_prompt: negative, style },
        summary: `Here's your enhanced prompt:\n\n**Prompt:**\n> ${enhanced}\n\n**Negative prompt:**\n> ${negative}\n\nDoes this look good? I can adjust the style, add more details, or change the mood. When you're happy with it, I'll open the template with this prompt pre-filled.`,
      };
    },
  },

  // ─── Open Template with Pre-filled Data ──────────────────────
  {
    id: 'director.open_template',
    label: 'Open Template in Editor',
    description:
      'Open a Director Panel template in the flow editor with the user\'s data pre-filled and ready to run. Use this ONLY after you have collected all required inputs from the user. This generates a URL that opens the editor with the template loaded.',
    category: 'action',
    requiredPermissions: [],
    parameters: [
      { name: 'template_id', type: 'string', description: 'Template ID', required: true },
      { name: 'inputs', type: 'object', description: 'Object with field values the user provided (keys match requiredInputs field names)', required: true },
    ],
    execute: async (params, _ctx): Promise<ToolResult> => {
      const tpl = TEMPLATES.find((t) => t.id === params.template_id);
      if (!tpl) {
        return { success: false, error: `Template "${params.template_id}" not found` };
      }

      // Check all required inputs are filled
      const missing = tpl.inputs.filter(
        (f) => f.required && !(params.inputs as Record<string, any>)?.[f.field]
      );

      if (missing.length > 0) {
        return {
          success: false,
          error: `Missing required inputs: ${missing.map(m => m.label).join(', ')}`,
          summary: `I still need the following:\n${missing.map(m => `- **${m.label}**: ${m.hint}`).join('\n')}\n\nPlease provide these and I'll prepare the template.`,
        };
      }

      // Encode inputs as URL params for the editor to pick up
      const inputsEncoded = encodeURIComponent(JSON.stringify(params.inputs));
      const url = `/director-panel/flows/new?template=${params.template_id}&inputs=${inputsEncoded}`;

      return {
        success: true,
        data: { url, template: tpl.name, inputs: params.inputs },
        summary: `Everything is ready! Click the link below to open your flow:\n\n**[Open "${tpl.name}" in Director Panel](${url})**\n\nThe template will be loaded with all your settings pre-filled. Just click **Run** to generate.\n\nEstimated cost: ${tpl.creditCost}`,
      };
    },
  },

  // ─── Check Credits ───────────────────────────────────────────
  {
    id: 'director.check_credits',
    label: 'Check AI Credits',
    description:
      'Check the current AI credit balance. Use when the user asks about credits, balance, or cost before generating content.',
    category: 'read',
    requiredPermissions: [],
    parameters: [],
    execute: async (_params, _ctx): Promise<ToolResult> => {
      try {
        const { supabase } = await import('../../supabase');
        const session = await supabase.auth.getSession();
        const token = session.data.session?.access_token;

        const response = await fetch('/api/director-panel/credits', {
          headers: { 'Authorization': `Bearer ${token}` },
        });

        if (!response.ok) {
          return { success: true, data: { balance: 0 }, summary: 'Could not fetch balance. You may need to run the Director Panel SQL migration first.' };
        }

        const data = await response.json();
        const balance = data.credits_balance ?? 0;

        return {
          success: true,
          data: { balance },
          summary: `Your balance: **${balance} credits**\n\nWhat you can do:\n- ~${Math.floor(balance / 1)} quick images (Flux Fast, 1 cr)\n- ~${Math.floor(balance / 5)} high-quality images (Flux 2 Pro, 5 cr)\n- ~${Math.floor(balance / 25)} videos (Wan 2.5, 25 cr)\n- ~${Math.floor(balance / 80)} advanced pipelines (Face Swap, ~80 cr)`,
        };
      } catch {
        return { success: true, data: { balance: 0 }, summary: 'Could not check balance.' };
      }
    },
  },
];
