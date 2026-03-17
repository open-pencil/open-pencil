import { type InjectionKey, inject, provide } from 'vue'

import type { Editor } from '@open-pencil/core/editor'
import type { ComputedRef, Ref } from 'vue'

export interface LayerNode {
  id: string
  name: string
  type: string
  layoutMode: string
  visible: boolean
  locked: boolean
  children?: LayerNode[]
}

export interface LayerTreeContext {
  editor: Editor
  items: Ref<LayerNode[]>
  expanded: Ref<string[]>
  treeKey: Ref<number>
  selectedIds: ComputedRef<Set<string>>
  indentPerLevel: number
  select: (id: string, additive: boolean) => void
  toggleExpand: (id: string) => void
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
