import { computed, ref, shallowRef, triggerRef } from 'vue'

import type { SceneGraph } from '@open-pencil/core/scene-graph'

import type { AppEditorState } from '@/app/editor/session/types'

import { createCanvasPaneState, clonePaneForSplit } from './create'
import { logSplitPaneDebug } from './debug'
import {
  closePaneNode,
  containsPane,
  leafPaneIds,
  MAX_VISIBLE_CANVAS_PANES,
  paneCount,
  splitPaneNode,
  updateSplitSizes as updateSplitNodeSizes
} from './split-tree'
import type {
  AppCanvasPaneState,
  CanvasSplitNode,
  ClosePaneResult,
  SplitDirection,
  SplitPaneResult
} from './types'

export const APP_PANE_STATE_KEYS = [
  'currentPageId',
  'selectedIds',
  'marquee',
  'snapGuides',
  'rotationPreview',
  'dropTargetId',
  'layoutInsertIndicator',
  'autoLayoutHover',
  'hoveredNodeId',
  'editingTextId',
  'penState',
  'penCursorX',
  'penCursorY',
  'panX',
  'panY',
  'zoom',
  'renderVersion',
  'pageColor',
  'enteredContainerId',
  'cursorCanvasX',
  'cursorCanvasY',
  'nodeEditState'
] as const

type AppPaneStateKey = (typeof APP_PANE_STATE_KEYS)[number]

type PaneRegistryOptions = {
  graph: SceneGraph
  state: AppEditorState
}

export function createCanvasPaneRegistry({ graph, state }: PaneRegistryOptions) {
  let nextPaneIndex = 1
  let nextSplitIndex = 1

  function createPaneId(): string {
    return `pane-${nextPaneIndex++}`
  }

  function createSplitId(): string {
    return `split-${nextSplitIndex++}`
  }

  const initialPane = createCanvasPaneState(createPaneId(), state.currentPageId, state)
  const panes = shallowRef(new Map([[initialPane.id, initialPane]]))
  const activePaneId = ref(initialPane.id)
  const splitTree = ref<CanvasSplitNode>({ type: 'pane', paneId: initialPane.id })
  const splitResizeActive = ref(false)
  const visiblePaneCount = computed(() => paneCount(splitTree.value))

  function getPane(id: string): AppCanvasPaneState | undefined {
    return panes.value.get(id)
  }

  function getFirstPaneId(): string {
    return leafPaneIds(splitTree.value)[0] ?? initialPane.id
  }

  function getActivePane(): AppCanvasPaneState {
    const active = getPane(activePaneId.value)
    if (active) return active

    const fallbackId = getFirstPaneId()
    activePaneId.value = fallbackId
    const fallback = getPane(fallbackId)
    if (fallback) return fallback

    panes.value.set(initialPane.id, initialPane)
    splitTree.value = { type: 'pane', paneId: initialPane.id }
    activePaneId.value = initialPane.id
    triggerRef(panes)
    return initialPane
  }

  function setActivePane(id: string): void {
    if (!getPane(id) || splitResizeActive.value) return
    activePaneId.value = id
  }

  function setSplitResizeActive(active: boolean): void {
    splitResizeActive.value = active
  }

  function splitPane(id: string, direction: SplitDirection): SplitPaneResult {
    const source = getPane(id)
    if (!source || !containsPane(splitTree.value, id)) return { ok: false, reason: 'missing-pane' }
    if (visiblePaneCount.value >= MAX_VISIBLE_CANVAS_PANES) return { ok: false, reason: 'pane-cap' }

    const pane = clonePaneForSplit(createPaneId(), source)
    const nextTree = splitPaneNode(splitTree.value, id, pane.id, createSplitId(), direction)
    if (!containsPane(nextTree, pane.id)) return { ok: false, reason: 'missing-pane' }

    panes.value.set(pane.id, pane)
    splitTree.value = nextTree
    activePaneId.value = pane.id
    triggerRef(panes)
    return { ok: true, paneId: pane.id }
  }

  function closePane(id: string): ClosePaneResult {
    if (!getPane(id) || !containsPane(splitTree.value, id))
      return { ok: false, reason: 'missing-pane' }
    if (visiblePaneCount.value <= 1) return { ok: false, reason: 'last-pane' }

    const nextTree = closePaneNode(splitTree.value, id)
    if (!nextTree) return { ok: false, reason: 'last-pane' }

    const pane = getPane(id)
    if (pane) clearPaneTransientState(pane)
    panes.value.delete(id)
    splitTree.value = nextTree
    if (activePaneId.value === id || !getPane(activePaneId.value))
      activePaneId.value = getFirstPaneId()
    triggerRef(panes)
    return { ok: true, activePaneId: activePaneId.value }
  }

  function ensureSinglePane(): string {
    const active = getActivePane()
    for (const pane of panes.value.values()) {
      if (pane.id !== active.id) clearPaneTransientState(pane)
    }
    panes.value = new Map([[active.id, active]])
    splitTree.value = { type: 'pane', paneId: active.id }
    activePaneId.value = active.id
    return active.id
  }

  function resizePane(id: string, width: number, height: number): void {
    const pane = getPane(id)
    if (!pane) return
    pane.viewportWidth = width
    pane.viewportHeight = height
  }

  function updateSplitSizes(splitId: string, sizes: number[]): void {
    logSplitPaneDebug('update-split-sizes', { splitId, sizes, activePaneId: activePaneId.value })
    splitTree.value = updateSplitNodeSizes(splitTree.value, splitId, sizes)
  }

  function sanitizePanes(targetGraph: SceneGraph = graph): void {
    const pages = targetGraph.getPages()
    const fallbackPageId = pages[0]?.id ?? targetGraph.rootId
    for (const pane of panes.value.values()) sanitizePane(targetGraph, pane, fallbackPageId)
    if (!getPane(activePaneId.value)) activePaneId.value = getFirstPaneId()
  }

  function resetPaneViewports(): void {
    for (const pane of panes.value.values()) pane.pageViewports.clear()
  }

  function sanitizePane(
    targetGraph: SceneGraph,
    pane: AppCanvasPaneState,
    fallbackPageId: string
  ): void {
    if (!targetGraph.getNode(pane.currentPageId)) pane.currentPageId = fallbackPageId
    pane.selectedIds = new Set([...pane.selectedIds].filter((id) => targetGraph.getNode(id)))
    if (pane.hoveredNodeId && !targetGraph.getNode(pane.hoveredNodeId)) pane.hoveredNodeId = null
    if (pane.editingTextId && !targetGraph.getNode(pane.editingTextId)) pane.editingTextId = null
    if (pane.dropTargetId && !targetGraph.getNode(pane.dropTargetId)) pane.dropTargetId = null
    if (pane.enteredContainerId && !targetGraph.getNode(pane.enteredContainerId))
      pane.enteredContainerId = null
    if (pane.rotationPreview && !targetGraph.getNode(pane.rotationPreview.nodeId))
      pane.rotationPreview = null
    if (pane.nodeEditState && !targetGraph.getNode(pane.nodeEditState.nodeId))
      pane.nodeEditState = null
    for (const pageId of pane.pageViewports.keys()) {
      if (!targetGraph.getNode(pageId)) pane.pageViewports.delete(pageId)
    }
    clearPaneTransientState(pane)
  }

  return {
    panes,
    splitTree,
    activePaneId,
    splitResizeActive,
    visiblePaneCount,
    getPane,
    getActivePane,
    setActivePane,
    setSplitResizeActive,
    splitPane,
    closePane,
    ensureSinglePane,
    resizePane,
    updateSplitSizes,
    sanitizePanes,
    resetPaneViewports,
    maxVisiblePanes: MAX_VISIBLE_CANVAS_PANES
  }
}

export type CanvasPaneRegistry = ReturnType<typeof createCanvasPaneRegistry>

export function clearPaneTransientState(pane: AppCanvasPaneState): void {
  pane.marquee = null
  pane.snapGuides = []
  pane.rotationPreview = null
  pane.dropTargetId = null
  pane.layoutInsertIndicator = null
  pane.autoLayoutHover = null
  pane.hoveredNodeId = null
  pane.editingTextId = null
  pane.penState = null
  pane.penCursorX = null
  pane.penCursorY = null
  pane.cursorCanvasX = null
  pane.cursorCanvasY = null
  pane.nodeEditState = null
}

export function bindStateToActivePane(state: AppEditorState, panes: CanvasPaneRegistry): void {
  for (const key of APP_PANE_STATE_KEYS) bindPaneKey(state, panes, key)
}

function bindPaneKey(state: AppEditorState, panes: CanvasPaneRegistry, key: AppPaneStateKey): void {
  Object.defineProperty(state, key, {
    enumerable: true,
    configurable: true,
    get: () => panes.getActivePane()[key],
    set: (value) => {
      Reflect.set(panes.getActivePane(), key, value)
    }
  })
}
