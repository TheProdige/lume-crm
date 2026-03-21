import type { TourStep } from './OnboardingTour';

// ─── Home Page Tour ──────────────────────────────────────────────────────────

export const HOME_TOUR_KEY = 'director-panel-home';

export const HOME_TOUR_STEPS: TourStep[] = [
  {
    placement: 'center',
    title: 'Welcome to Director Panel',
    content:
      'Director Panel is your AI-powered creative studio. Generate images, videos, and 3D assets — all connected to your CRM.',
  },
  {
    target: '[data-tour="credits"]',
    placement: 'bottom',
    title: 'Your Credits',
    content:
      'Every AI generation costs credits. You start with 100 free credits. A simple image costs 1-5 credits, a video 15-35 credits.',
  },
  {
    target: '[data-tour="new-flow"]',
    placement: 'bottom',
    title: 'Create a Flow',
    content:
      'Click "New Flow" to open the canvas editor. A flow is a visual pipeline where you connect AI nodes together.',
  },
  {
    target: '[data-tour="workflow-library"]',
    placement: 'bottom',
    title: 'Workflow Library',
    content:
      'Start from a pre-built template instead of building from scratch. Click any template to create a flow with pre-configured nodes.',
  },
  {
    target: '[data-tour="my-files"]',
    placement: 'top',
    title: 'Your Flows',
    content:
      'All your saved flows appear here. Click any flow to open it in the editor. You can search and switch between grid and list view.',
  },
];

// ─── Flow Editor Tour ────────────────────────────────────────────────────────

export const EDITOR_TOUR_KEY = 'director-panel-editor';

export const EDITOR_TOUR_STEPS: TourStep[] = [
  {
    placement: 'center',
    title: 'The Flow Editor',
    content:
      'This is your creative canvas. Drag nodes from the left panel, connect them together, and hit Run to generate content.',
  },
  {
    target: '[data-tour="node-library"]',
    placement: 'right',
    title: 'Node Library',
    content:
      'Browse all available nodes here. Drag a node onto the canvas, or click to add it. Use search to find specific tools.',
  },
  {
    target: '[data-tour="canvas"]',
    placement: 'center',
    title: 'The Canvas',
    content:
      'This is where your flow lives. Drag to pan, scroll to zoom. Connect nodes by dragging from an output port (right) to an input port (left).',
  },
  {
    target: '[data-tour="inspector"]',
    placement: 'left',
    title: 'Inspector Panel',
    content:
      'Click any node to see its settings here. Configure models, adjust parameters, and see validation warnings.',
  },
  {
    target: '[data-tour="run-button"]',
    placement: 'bottom',
    title: 'Run Your Flow',
    content:
      'When your flow is ready, click Run. The engine executes nodes in order, calls AI providers, and shows results in the output panel below.',
  },
  {
    target: '[data-tour="save-button"]',
    placement: 'bottom',
    title: 'Save Your Work',
    content:
      'Your flow auto-saves every 3 seconds. You can also press Ctrl+S or click Save manually. The yellow dot means unsaved changes.',
  },
  {
    placement: 'center',
    title: 'Quick Tips',
    content:
      'Right-click the canvas to add nodes quickly. Press Delete to remove selected nodes. Use Ctrl+S to save. Check the output panel at the bottom for logs and generated assets.',
  },
];
