import { create } from 'zustand';
import type {
  DirectorFlow,
  DirectorNode,
  DirectorEdge,
  RunState,
  RunLogEntry,
  ProviderOutput,
} from '../../types/director';

// ─── Editor Store ────────────────────────────────────────────────────────────

export type FlowEditorStore = {
  // Flow metadata
  flow: DirectorFlow | null;
  nodes: DirectorNode[];
  edges: DirectorEdge[];
  selectedNodeId: string | null;
  isDirty: boolean;

  // Run state
  runState: RunState;

  // UI state
  libraryOpen: boolean;
  inspectorOpen: boolean;
  outputPanelOpen: boolean;
  outputPanelTab: 'logs' | 'outputs' | 'costs' | 'chat';
  zoom: number;

  // Actions — Flow
  setFlow: (flow: DirectorFlow) => void;
  updateFlowMeta: (partial: Partial<DirectorFlow>) => void;
  setNodes: (nodes: DirectorNode[]) => void;
  setEdges: (edges: DirectorEdge[]) => void;
  addNode: (node: DirectorNode) => void;
  updateNode: (id: string, data: Partial<DirectorNode>) => void;
  removeNode: (id: string) => void;
  addEdge: (edge: DirectorEdge) => void;
  removeEdge: (id: string) => void;
  selectNode: (id: string | null) => void;
  markDirty: () => void;
  markClean: () => void;

  // Actions — Run
  setRunState: (partial: Partial<RunState>) => void;
  addLog: (entry: RunLogEntry) => void;
  addOutput: (output: ProviderOutput) => void;
  resetRun: () => void;
  setNodeState: (nodeId: string, state: 'pending' | 'running' | 'completed' | 'error') => void;
  resetNodeStates: () => void;

  // Actions — UI
  toggleLibrary: () => void;
  setLibraryOpen: (open: boolean) => void;
  toggleInspector: () => void;
  setInspectorOpen: (open: boolean) => void;
  toggleOutputPanel: () => void;
  setOutputPanelTab: (tab: 'logs' | 'outputs' | 'costs' | 'chat') => void;
  setZoom: (zoom: number) => void;

  // Reset
  resetEditor: () => void;
};

const initialRunState: RunState = {
  status: 'idle',
  runId: null,
  progress: 0,
  currentNodeId: null,
  logs: [],
  outputs: [],
  costs: { estimated: 0, actual: 0 },
  nodeStates: {},
};

export const useFlowEditorStore = create<FlowEditorStore>((set) => ({
  // Initial state
  flow: null,
  nodes: [],
  edges: [],
  selectedNodeId: null,
  isDirty: false,
  runState: initialRunState,
  libraryOpen: true,
  inspectorOpen: true,
  outputPanelOpen: false,
  outputPanelTab: 'logs',
  zoom: 1,

  // Flow actions
  setFlow: (flow) => set({ flow, isDirty: false }),
  updateFlowMeta: (partial) =>
    set((s) => ({
      flow: s.flow ? { ...s.flow, ...partial } : null,
      isDirty: true,
    })),
  setNodes: (nodes) => set({ nodes }),
  setEdges: (edges) => set({ edges }),
  addNode: (node) =>
    set((s) => ({ nodes: [...s.nodes, node], isDirty: true })),
  updateNode: (id, data) =>
    set((s) => ({
      nodes: s.nodes.map((n) => (n.id === id ? { ...n, ...data } : n)),
      isDirty: true,
    })),
  removeNode: (id) =>
    set((s) => ({
      nodes: s.nodes.filter((n) => n.id !== id),
      edges: s.edges.filter((e) => e.source_node_id !== id && e.target_node_id !== id),
      selectedNodeId: s.selectedNodeId === id ? null : s.selectedNodeId,
      isDirty: true,
    })),
  addEdge: (edge) =>
    set((s) => ({ edges: [...s.edges, edge], isDirty: true })),
  removeEdge: (id) =>
    set((s) => ({
      edges: s.edges.filter((e) => e.id !== id),
      isDirty: true,
    })),
  selectNode: (id) => set({ selectedNodeId: id }),
  markDirty: () => set({ isDirty: true }),
  markClean: () => set({ isDirty: false }),

  // Run actions
  setRunState: (partial) =>
    set((s) => ({ runState: { ...s.runState, ...partial } })),
  addLog: (entry) =>
    set((s) => ({
      runState: { ...s.runState, logs: [...s.runState.logs, entry] },
    })),
  addOutput: (output) =>
    set((s) => ({
      runState: { ...s.runState, outputs: [...s.runState.outputs, output] },
    })),
  resetRun: () => set({ runState: initialRunState }),
  setNodeState: (nodeId, state) => set((s) => ({
    runState: { ...s.runState, nodeStates: { ...s.runState.nodeStates, [nodeId]: state } },
  })),
  resetNodeStates: () => set((s) => ({
    runState: { ...s.runState, nodeStates: {} },
  })),

  // UI actions
  toggleLibrary: () => set((s) => ({ libraryOpen: !s.libraryOpen })),
  setLibraryOpen: (open) => set({ libraryOpen: open }),
  toggleInspector: () => set((s) => ({ inspectorOpen: !s.inspectorOpen })),
  setInspectorOpen: (open) => set({ inspectorOpen: open }),
  toggleOutputPanel: () => set((s) => ({ outputPanelOpen: !s.outputPanelOpen })),
  setOutputPanelTab: (tab) => set({ outputPanelTab: tab }),
  setZoom: (zoom) => set({ zoom }),

  // Reset
  resetEditor: () =>
    set({
      flow: null,
      nodes: [],
      edges: [],
      selectedNodeId: null,
      isDirty: false,
      runState: initialRunState,
      libraryOpen: true,
      inspectorOpen: true,
      outputPanelOpen: false,
      outputPanelTab: 'logs',
      zoom: 1,
    }),
}));
