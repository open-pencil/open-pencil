import { type ComputedRef, type InjectionKey, type Ref, inject, provide } from 'vue'

import type { Editor } from '@open-pencil/core/editor'

export interface LayerNode {
  id: string
  name: string
  type: string
  layoutMode: string
  /** Whether the layer is a slot frame holding a slot property's content. */
  slot?: boolean
  /** Whether the layer is an icon from a set, which keeps its name to be swapped or exported. */
  icon?: boolean
  visible: boolean
  locked: boolean
  children?: LayerNode[]
}

export interface LayerRow {
  node: LayerNode
  level: number
  hasChildren: boolean
}

export interface LayerSelectionMode {
  additive: boolean
  range: boolean
}

export interface LayerTreeVirtualizer {
  scrollToIndex: (index: number, options?: { align?: 'auto' | 'center' | 'end' | 'start' }) => void
}

export interface LayerDragInstruction {
  type: 'reorder-above' | 'reorder-below' | 'make-child'
}

export interface LayerTreeContext {
  editor: Editor
  items: Ref<LayerNode[]>
  expanded: Ref<string[]>
  visibleRows: ComputedRef<LayerRow[]>
  treeVersion: Ref<number>
  selectedIds: ComputedRef<Set<string>>
  focused: Ref<boolean>
  indentPerLevel: number
  draggingId: Ref<string | null>
  instruction: Ref<LayerDragInstruction | null>
  instructionTargetId: Ref<string | null>
  setupDrag: (
    el: Ref<HTMLElement | null>,
    item: () => { id: string; level: number; hasChildren: boolean; parentId: string | null }
  ) => void
  select: (id: string, selection: boolean | LayerSelectionMode) => void
  toggleExpand: (id: string) => void
  setFocused: (focused: boolean) => void
  setVirtualizer: (virtualizer: LayerTreeVirtualizer) => void
  toggleVisibility: (id: string) => void
  toggleLock: (id: string) => void
  rename: (id: string, name: string) => void
  setRowRef: (id: string, el: HTMLElement | null) => void
}

export const LAYER_TREE_KEY: InjectionKey<LayerTreeContext> = Symbol('layer-tree')

export function provideLayerTree(ctx: LayerTreeContext) {
  provide(LAYER_TREE_KEY, ctx)
}

export function useLayerTree(): LayerTreeContext {
  const ctx = inject(LAYER_TREE_KEY)
  if (!ctx) throw new Error('[open-pencil] useLayerTree() called outside <LayerTreeRoot>')
  return ctx
}
