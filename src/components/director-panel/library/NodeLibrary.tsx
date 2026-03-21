'use client';

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import * as LucideIcons from 'lucide-react';
import { Search, ChevronRight, X } from 'lucide-react';
import {
  NODE_REGISTRY,
  LIBRARY_CATEGORIES,
  searchNodes,
  getNodesByCategory,
  getNodesBySubcategory,
} from '../../../lib/director-panel/config/node-registry';
import { MODEL_CATALOG } from '../../../lib/director-panel/config/model-catalog';
import type { NodeRegistryEntry, ModelEntry } from '../../../types/director';
import { cn } from '../../../lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type NodeLibraryProps = {
  mode: 'sidebar' | 'contextmenu';
  position?: { x: number; y: number };
  onAddNode: (nodeType: string, position?: { x: number; y: number }) => void;
  onClose?: () => void;
};

// ---------------------------------------------------------------------------
// Icon helper
// ---------------------------------------------------------------------------

function getIcon(name: string): React.ComponentType<{ className?: string; size?: number }> {
  const icon = (LucideIcons as Record<string, unknown>)[name];
  if (typeof icon === 'function' || (typeof icon === 'object' && icon !== null)) {
    return icon as React.ComponentType<{ className?: string; size?: number }>;
  }
  return LucideIcons.Box;
}

// ---------------------------------------------------------------------------
// Model helpers
// ---------------------------------------------------------------------------

const MODEL_CATEGORY_MAP: Record<string, string> = {
  image_models: 'Image Models',
  video_models: 'Video Models',
  '3d_models': '3D Models',
  custom_models: 'Custom Models',
};

function getModelsBySubcategory(categoryKey: string, subcategory: string): ModelEntry[] {
  const catalogCategory = MODEL_CATEGORY_MAP[categoryKey];
  if (!catalogCategory) return [];
  return MODEL_CATALOG.filter(
    (m) => m.category === catalogCategory && m.subcategory === subcategory && m.status !== 'internal_only',
  );
}

function searchModels(query: string): ModelEntry[] {
  const q = query.toLowerCase();
  return MODEL_CATALOG.filter(
    (m) =>
      m.status !== 'internal_only' &&
      (m.displayName.toLowerCase().includes(q) ||
        m.id.toLowerCase().includes(q) ||
        m.category.toLowerCase().includes(q) ||
        m.subcategory.toLowerCase().includes(q)),
  );
}

// ---------------------------------------------------------------------------
// Shared subcomponents
// ---------------------------------------------------------------------------

/** A single node card in the 2-column grid */
function NodeCard({
  entry,
  onAdd,
  className,
}: {
  key?: React.Key;
  entry: NodeRegistryEntry;
  onAdd: () => void;
  className?: string;
}) {
  const Icon = getIcon(entry.icon);
  const isComingSoon = entry.status === 'coming_soon';

  const handleDragStart = useCallback(
    (e: React.DragEvent) => {
      e.dataTransfer.setData('application/director-node-type', entry.type);
      e.dataTransfer.setData('application/json', JSON.stringify({ nodeType: entry.type }));
      e.dataTransfer.effectAllowed = 'move';
    },
    [entry.type],
  );

  return (
    <button
      type="button"
      draggable
      onDragStart={handleDragStart}
      onClick={onAdd}
      className={cn(
        'group relative flex flex-col items-center justify-center gap-1.5 rounded-lg border border-[#333] bg-[#2a2a2a] px-2 py-3',
        'transition-all duration-150 ease-out',
        'hover:bg-[#333] hover:border-[#444] hover:shadow-lg hover:shadow-black/20',
        'active:scale-[0.97]',
        'cursor-grab active:cursor-grabbing',
        'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/20',
        isComingSoon && 'opacity-50 pointer-events-auto',
        className,
      )}
    >
      {isComingSoon && (
        <span className="absolute right-1.5 top-1.5 text-[9px] font-medium text-[#666] uppercase tracking-wider">
          Soon
        </span>
      )}
      <Icon className="text-[#e0e0e0] shrink-0" size={18} />
      <span className="text-[11px] leading-tight text-[#e0e0e0] text-center line-clamp-2 font-medium">
        {entry.displayName}
      </span>
    </button>
  );
}

/** A single model card in the 2-column grid */
function ModelCard({
  model,
  onAdd,
  className,
}: {
  key?: React.Key;
  model: ModelEntry;
  onAdd: () => void;
  className?: string;
}) {
  const Icon = getIcon(model.icon ?? 'Box');
  const isComingSoon = model.status === 'coming_soon';
  const isNew = model.badge === 'New';

  const handleDragStart = useCallback(
    (e: React.DragEvent) => {
      e.dataTransfer.setData('application/reactflow', model.id);
      e.dataTransfer.setData(
        'application/json',
        JSON.stringify({ nodeType: 'model', modelId: model.id, provider: model.provider }),
      );
      e.dataTransfer.effectAllowed = 'move';
    },
    [model.id, model.provider],
  );

  return (
    <button
      type="button"
      draggable
      onDragStart={handleDragStart}
      onClick={onAdd}
      className={cn(
        'group relative flex flex-col items-center justify-center gap-1.5 rounded-lg border border-[#333] bg-[#2a2a2a] px-2 py-3',
        'transition-all duration-150 ease-out',
        'hover:bg-[#333] hover:border-[#444] hover:shadow-lg hover:shadow-black/20',
        'active:scale-[0.97]',
        'cursor-grab active:cursor-grabbing',
        'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/20',
        isComingSoon && 'opacity-50',
        className,
      )}
    >
      {isComingSoon && (
        <span className="absolute right-1.5 top-1.5 text-[9px] font-medium text-[#666] uppercase tracking-wider">
          Soon
        </span>
      )}
      {isNew && (
        <span className="absolute right-1.5 top-1.5 text-[9px] font-semibold text-emerald-400 uppercase tracking-wider">
          New
        </span>
      )}
      <Icon className="text-[#e0e0e0] shrink-0" size={18} />
      <span className="text-[11px] leading-tight text-[#e0e0e0] text-center line-clamp-2 font-medium">
        {model.displayName}
      </span>
    </button>
  );
}

/** Search input bar */
function SearchBar({
  value,
  onChange,
  placeholder = 'Search nodes...',
  autoFocus = false,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  className?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  return (
    <div className={cn('relative', className)}>
      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#666]" size={14} />
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(
          'w-full rounded-md bg-[#2a2a2a] border border-transparent py-1.5 pl-8 pr-8 text-xs text-[#e0e0e0] placeholder:text-[#666]',
          'transition-colors duration-150',
          'focus:border-[#555] focus:outline-none focus:ring-0',
        )}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-[#666] hover:text-[#e0e0e0] transition-colors"
        >
          <X size={12} />
        </button>
      )}
    </div>
  );
}

/** Section header */
function SectionHeader({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <h3 className={cn('text-[10px] font-semibold uppercase tracking-wider text-[#888] px-1 pt-4 pb-1.5', className)}>
      {children}
    </h3>
  );
}

/** Subcategory header */
function SubcategoryHeader({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <h4 className={cn('text-[10px] font-medium text-[#666] px-1 pt-3 pb-1', className)}>
      {children}
    </h4>
  );
}

// ---------------------------------------------------------------------------
// Sidebar mode
// ---------------------------------------------------------------------------

function SidebarView({ onAddNode }: Pick<NodeLibraryProps, 'onAddNode'>) {
  const [searchQuery, setSearchQuery] = useState('');

  // Gather visible nodes (filter out internal_only)
  const visibleNodes = useMemo(
    () => NODE_REGISTRY.filter((n) => n.status !== 'internal_only'),
    [],
  );

  // Search results
  const filteredNodes = useMemo(() => {
    if (!searchQuery.trim()) return null;
    return searchNodes(searchQuery).filter((n) => n.status !== 'internal_only');
  }, [searchQuery]);

  const filteredModels = useMemo(() => {
    if (!searchQuery.trim()) return null;
    return searchModels(searchQuery);
  }, [searchQuery]);

  const isSearching = searchQuery.trim().length > 0;

  // Quick access nodes
  const quickAccessNodes = useMemo(
    () => visibleNodes.filter((n) => n.category === 'quick_access'),
    [visibleNodes],
  );

  const handleAddNode = useCallback(
    (nodeType: string) => {
      onAddNode(nodeType);
    },
    [onAddNode],
  );

  const handleAddModel = useCallback(
    (modelId: string) => {
      onAddNode(modelId);
    },
    [onAddNode],
  );

  return (
    <div className="flex h-full w-[280px] flex-col border-r border-[#333] bg-[#1a1a1a]">
      {/* Header */}
      <div className="shrink-0 border-b border-[#333] px-3 py-3">
        <p className="text-[10px] font-medium uppercase tracking-wider text-[#666] mb-2">
          Node Library
        </p>
        <SearchBar value={searchQuery} onChange={setSearchQuery} autoFocus />
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden px-3 pb-6 scrollbar-thin scrollbar-thumb-[#333] scrollbar-track-transparent">
        {isSearching ? (
          /* Search results */
          <div>
            {filteredNodes && filteredNodes.length > 0 && (
              <>
                <SectionHeader className="pt-3">Nodes</SectionHeader>
                <div className="grid grid-cols-2 gap-1.5">
                  {filteredNodes.map((node) => (
                    <NodeCard
                      key={node.type}
                      entry={node}
                      onAdd={() => handleAddNode(node.type)}
                    />
                  ))}
                </div>
              </>
            )}
            {filteredModels && filteredModels.length > 0 && (
              <>
                <SectionHeader>Models</SectionHeader>
                <div className="grid grid-cols-2 gap-1.5">
                  {filteredModels.map((model) => (
                    <ModelCard
                      key={model.id}
                      model={model}
                      onAdd={() => handleAddModel(model.id)}
                    />
                  ))}
                </div>
              </>
            )}
            {(!filteredNodes || filteredNodes.length === 0) &&
              (!filteredModels || filteredModels.length === 0) && (
                <div className="flex flex-col items-center justify-center py-12 text-[#666]">
                  <LucideIcons.SearchX size={24} className="mb-2" />
                  <p className="text-xs">No results found</p>
                </div>
              )}
          </div>
        ) : (
          /* Default browsing layout */
          <div>
            {/* Quick access */}
            <SectionHeader className="pt-3">Quick access</SectionHeader>
            <div className="grid grid-cols-2 gap-1.5">
              {quickAccessNodes.map((node) => (
                <NodeCard
                  key={node.type}
                  entry={node}
                  onAdd={() => handleAddNode(node.type)}
                />
              ))}
            </div>

            {/* Toolbox */}
            {LIBRARY_CATEGORIES.filter((cat) => cat.key === 'tools').map((cat) => (
              <div key={cat.key}>
                <SectionHeader>Toolbox</SectionHeader>
                {cat.subcategories?.map((sub) => {
                  const nodes = getNodesBySubcategory(cat.key, sub.key).filter(
                    (n) => n.status !== 'internal_only',
                  );
                  if (nodes.length === 0) return null;
                  return (
                    <div key={sub.key}>
                      <SubcategoryHeader>{sub.label}</SubcategoryHeader>
                      <div className="grid grid-cols-2 gap-1.5">
                        {nodes.map((node) => (
                          <NodeCard
                            key={node.type}
                            entry={node}
                            onAdd={() => handleAddNode(node.type)}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}

            {/* Model categories */}
            {LIBRARY_CATEGORIES.filter((cat) =>
              ['image_models', 'video_models', '3d_models', 'custom_models'].includes(cat.key),
            ).map((cat) => {
              const catalogCategoryName = MODEL_CATEGORY_MAP[cat.key];
              const hasModels = MODEL_CATALOG.some(
                (m) => m.category === catalogCategoryName && m.status !== 'internal_only',
              );
              // Also include any NODE_REGISTRY entries for this category
              const categoryNodes = getNodesByCategory(cat.key).filter(
                (n) => n.status !== 'internal_only',
              );

              if (!hasModels && categoryNodes.length === 0) {
                return (
                  <div key={cat.key}>
                    <SectionHeader>{cat.label}</SectionHeader>
                    <p className="text-[10px] text-[#666] px-1 py-2 italic">No models available</p>
                  </div>
                );
              }

              return (
                <div key={cat.key}>
                  <SectionHeader>{cat.label}</SectionHeader>

                  {/* Generic nodes for this category (e.g. image_generator, video_generator) */}
                  {categoryNodes.length > 0 && (
                    <div className="grid grid-cols-2 gap-1.5 mb-1">
                      {categoryNodes.map((node) => (
                        <NodeCard
                          key={node.type}
                          entry={node}
                          onAdd={() => handleAddNode(node.type)}
                        />
                      ))}
                    </div>
                  )}

                  {/* Models grouped by subcategory */}
                  {cat.subcategories?.map((sub) => {
                    const models = getModelsBySubcategory(cat.key, sub.key);
                    if (models.length === 0) return null;
                    return (
                      <div key={sub.key}>
                        <SubcategoryHeader>{sub.label}</SubcategoryHeader>
                        <div className="grid grid-cols-2 gap-1.5">
                          {models.map((model) => (
                            <ModelCard
                              key={model.id}
                              model={model}
                              onAdd={() => handleAddModel(model.id)}
                            />
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}

            {/* CRM nodes */}
            {(() => {
              const crmNodes = getNodesByCategory('crm').filter((n) => n.status !== 'internal_only');
              if (crmNodes.length === 0) return null;
              return (
                <div>
                  <SectionHeader>CRM</SectionHeader>
                  <div className="grid grid-cols-2 gap-1.5">
                    {crmNodes.map((node) => (
                      <NodeCard
                        key={node.type}
                        entry={node}
                        onAdd={() => handleAddNode(node.type)}
                      />
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* Output nodes */}
            {(() => {
              const outputNodes = getNodesByCategory('output').filter(
                (n) => n.status !== 'internal_only',
              );
              if (outputNodes.length === 0) return null;
              return (
                <div>
                  <SectionHeader>Output</SectionHeader>
                  <div className="grid grid-cols-2 gap-1.5">
                    {outputNodes.map((node) => (
                      <NodeCard
                        key={node.type}
                        entry={node}
                        onAdd={() => handleAddNode(node.type)}
                      />
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Context menu mode
// ---------------------------------------------------------------------------

/** A simple row item in the context menu */
function ContextMenuItem({
  label,
  icon,
  isComingSoon,
  onClick,
  onMouseEnter,
  hasSubmenu,
  isActive,
}: {
  key?: React.Key;
  label: string;
  icon?: string;
  isComingSoon?: boolean;
  onClick: () => void;
  onMouseEnter?: () => void;
  hasSubmenu?: boolean;
  isActive?: boolean;
}) {
  const Icon = icon ? getIcon(icon) : null;

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      className={cn(
        'flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-left text-xs text-[#e0e0e0]',
        'transition-colors duration-100',
        'hover:bg-[#333]',
        isActive && 'bg-[#333]',
        isComingSoon && 'opacity-50',
      )}
    >
      {Icon && <Icon size={14} className="shrink-0 text-[#888]" />}
      <span className="flex-1 truncate">{label}</span>
      {isComingSoon && (
        <span className="text-[9px] font-medium text-[#666] uppercase tracking-wider">Soon</span>
      )}
      {hasSubmenu && <ChevronRight size={12} className="shrink-0 text-[#666]" />}
    </button>
  );
}

function ContextMenuView({
  position,
  onAddNode,
  onClose,
}: Pick<NodeLibraryProps, 'position' | 'onAddNode' | 'onClose'>) {
  const [searchQuery, setSearchQuery] = useState('');
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);
  const [hoveredSubcategory, setHoveredSubcategory] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose?.();
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose?.();
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  const isSearching = searchQuery.trim().length > 0;

  const filteredNodes = useMemo(() => {
    if (!isSearching) return null;
    return searchNodes(searchQuery).filter((n) => n.status !== 'internal_only');
  }, [searchQuery, isSearching]);

  const filteredModels = useMemo(() => {
    if (!isSearching) return null;
    return searchModels(searchQuery);
  }, [searchQuery, isSearching]);

  const quickAccessNodes = useMemo(
    () => NODE_REGISTRY.filter((n) => n.category === 'quick_access' && n.status !== 'internal_only'),
    [],
  );

  const handleAdd = useCallback(
    (nodeType: string) => {
      onAddNode(nodeType, position);
      onClose?.();
    },
    [onAddNode, onClose, position],
  );

  // Get subcategory items for the hovered category
  const submenuItems = useMemo(() => {
    if (!hoveredCategory) return null;
    const cat = LIBRARY_CATEGORIES.find((c) => c.key === hoveredCategory);
    if (!cat?.subcategories) return null;
    return cat.subcategories;
  }, [hoveredCategory]);

  // Get items for the hovered subcategory
  const subSubmenuItems = useMemo(() => {
    if (!hoveredCategory || !hoveredSubcategory) return null;

    const isModelCategory = ['image_models', 'video_models', '3d_models', 'custom_models'].includes(
      hoveredCategory,
    );

    if (isModelCategory) {
      const models = getModelsBySubcategory(hoveredCategory, hoveredSubcategory);
      const nodes = getNodesBySubcategory(hoveredCategory, hoveredSubcategory).filter(
        (n) => n.status !== 'internal_only',
      );
      return { nodes, models };
    }

    const nodes = getNodesBySubcategory(hoveredCategory, hoveredSubcategory).filter(
      (n) => n.status !== 'internal_only',
    );
    return { nodes, models: [] as ModelEntry[] };
  }, [hoveredCategory, hoveredSubcategory]);

  const menuX = position?.x ?? 0;
  const menuY = position?.y ?? 0;

  return (
    <div
      ref={menuRef}
      className="fixed z-[9999] flex"
      style={{ left: menuX, top: menuY }}
    >
      {/* Main menu panel */}
      <div
        className={cn(
          'w-[220px] rounded-lg border border-[#333] bg-[#1e1e1e] shadow-xl shadow-black/40',
          'overflow-hidden',
          'animate-in fade-in-0 zoom-in-95 duration-150',
        )}
      >
        <div className="p-2">
          <SearchBar value={searchQuery} onChange={setSearchQuery} autoFocus placeholder="Search..." />
        </div>

        <div className="max-h-[400px] overflow-y-auto px-1 pb-1.5">
          {isSearching ? (
            /* Search results */
            <div>
              {filteredNodes && filteredNodes.length > 0 && (
                <div>
                  {filteredNodes.map((node) => (
                    <ContextMenuItem
                      key={node.type}
                      label={node.displayName}
                      icon={node.icon}
                      isComingSoon={node.status === 'coming_soon'}
                      onClick={() => handleAdd(node.type)}
                    />
                  ))}
                </div>
              )}
              {filteredModels && filteredModels.length > 0 && (
                <div>
                  {filteredNodes && filteredNodes.length > 0 && (
                    <div className="mx-2 my-1 border-t border-[#333]" />
                  )}
                  {filteredModels.map((model) => (
                    <ContextMenuItem
                      key={model.id}
                      label={model.displayName}
                      icon={model.icon}
                      isComingSoon={model.status === 'coming_soon'}
                      onClick={() => handleAdd(model.id)}
                    />
                  ))}
                </div>
              )}
              {(!filteredNodes || filteredNodes.length === 0) &&
                (!filteredModels || filteredModels.length === 0) && (
                  <p className="px-3 py-4 text-center text-[11px] text-[#666]">No results</p>
                )}
            </div>
          ) : (
            /* Default: quick access + categories */
            <div>
              {/* Quick access items */}
              <p className="px-2.5 pt-1.5 pb-0.5 text-[9px] font-semibold uppercase tracking-wider text-[#666]">
                Quick access
              </p>
              {quickAccessNodes.map((node) => (
                <ContextMenuItem
                  key={node.type}
                  label={node.displayName}
                  icon={node.icon}
                  isComingSoon={node.status === 'coming_soon'}
                  onClick={() => handleAdd(node.type)}
                  onMouseEnter={() => {
                    setHoveredCategory(null);
                    setHoveredSubcategory(null);
                  }}
                />
              ))}

              <div className="mx-2 my-1 border-t border-[#333]" />

              {/* Categories */}
              <p className="px-2.5 pt-1 pb-0.5 text-[9px] font-semibold uppercase tracking-wider text-[#666]">
                Categories
              </p>
              {LIBRARY_CATEGORIES.filter((c) => c.key !== 'quick_access').map((cat) => (
                <ContextMenuItem
                  key={cat.key}
                  label={cat.label}
                  hasSubmenu={!!cat.subcategories && cat.subcategories.length > 0}
                  onClick={() => {
                    // If no subcategories, toggle expand
                    if (!cat.subcategories || cat.subcategories.length === 0) {
                      const nodes = getNodesByCategory(cat.key).filter(
                        (n) => n.status !== 'internal_only',
                      );
                      if (nodes.length === 1) handleAdd(nodes[0].type);
                    }
                  }}
                  onMouseEnter={() => {
                    setHoveredCategory(cat.key);
                    setHoveredSubcategory(null);
                  }}
                  isActive={hoveredCategory === cat.key}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Subcategory submenu (level 2) */}
      {!isSearching && hoveredCategory && submenuItems && submenuItems.length > 0 && (
        <div
          className={cn(
            'w-[200px] rounded-lg border border-[#333] bg-[#1e1e1e] shadow-xl shadow-black/40',
            'ml-1 overflow-hidden',
            'animate-in fade-in-0 slide-in-from-left-1 duration-100',
          )}
          onMouseLeave={() => setHoveredSubcategory(null)}
        >
          <div className="max-h-[400px] overflow-y-auto px-1 py-1.5">
            {submenuItems.map((sub) => (
              <ContextMenuItem
                key={sub.key}
                label={sub.label}
                hasSubmenu
                onClick={() => {}}
                onMouseEnter={() => setHoveredSubcategory(sub.key)}
                isActive={hoveredSubcategory === sub.key}
              />
            ))}
          </div>
        </div>
      )}

      {/* Items submenu (level 3) */}
      {!isSearching && hoveredSubcategory && subSubmenuItems && (
        <div
          className={cn(
            'w-[200px] rounded-lg border border-[#333] bg-[#1e1e1e] shadow-xl shadow-black/40',
            'ml-1 overflow-hidden',
            'animate-in fade-in-0 slide-in-from-left-1 duration-100',
          )}
        >
          <div className="max-h-[400px] overflow-y-auto px-1 py-1.5">
            {subSubmenuItems.nodes.length > 0 &&
              subSubmenuItems.nodes.map((node) => (
                <ContextMenuItem
                  key={node.type}
                  label={node.displayName}
                  icon={node.icon}
                  isComingSoon={node.status === 'coming_soon'}
                  onClick={() => handleAdd(node.type)}
                />
              ))}
            {subSubmenuItems.models.length > 0 &&
              subSubmenuItems.models.map((model) => (
                <ContextMenuItem
                  key={model.id}
                  label={model.displayName}
                  icon={model.icon}
                  isComingSoon={model.status === 'coming_soon'}
                  onClick={() => handleAdd(model.id)}
                />
              ))}
            {subSubmenuItems.nodes.length === 0 && subSubmenuItems.models.length === 0 && (
              <p className="px-3 py-3 text-center text-[11px] text-[#666] italic">Empty</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function NodeLibrary({ mode, position, onAddNode, onClose }: NodeLibraryProps) {
  if (mode === 'contextmenu') {
    return <ContextMenuView position={position} onAddNode={onAddNode} onClose={onClose} />;
  }

  return <SidebarView onAddNode={onAddNode} />;
}

export default NodeLibrary;
