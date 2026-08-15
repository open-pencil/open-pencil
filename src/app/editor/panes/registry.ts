import { computed, ref, shallowRef, triggerRef } from 'vue'

import type { EditorState } from '@open-pencil/core/editor'
import { copyEditorViewState, pickEditorViewState } from '@open-pencil/core/editor'

import {
  closePaneNode,
  containsPane,
  leafPaneIds,
  MAX_VISIBLE_CANVAS_PANES,
  paneCount,
  splitPaneNode,
  updateSplitSizes
} from './split-tree'
import type { CanvasSplitNode, SplitDirection } from './split-tree'
import { cloneCanvasPaneState, createCanvasPaneState } from './state'
import type { CanvasPaneState } from './state'

export function createCanvasPaneRegistry(state: EditorState) {
  let nextPaneIndex = 1
  let nextSplitIndex = 1
  const initialPane = createCanvasPaneState(`pane-${nextPaneIndex++}`, state)
  const panes = shallowRef(new Map([[initialPane.id, initialPane]]))
  const activePaneId = ref(initialPane.id)
  const splitTree = ref<CanvasSplitNode>({ type: 'pane', paneId: initialPane.id })
  const visiblePaneCount = computed(() => paneCount(splitTree.value))

  function getPane(paneId: string): CanvasPaneState | undefined {
    return panes.value.get(paneId)
  }

  function syncPaneFromState(pane: CanvasPaneState): void {
    Object.assign(pane, copyEditorViewState(pickEditorViewState(state)))
  }

  function syncStateFromPane(pane: CanvasPaneState): void {
    Object.assign(state, copyEditorViewState(pane))
  }

  function getPaneRenderState(paneId: string): EditorState {
    const pane = getPane(paneId)
    if (!pane || paneId === activePaneId.value) return state
    return { ...state, ...pane } satisfies EditorState
  }

  function getActivePane(): CanvasPaneState {
    return getPane(activePaneId.value) ?? initialPane
  }

  function setActivePane(paneId: string): boolean {
    if (paneId === activePaneId.value) return true
    const pane = getPane(paneId)
    if (!containsPane(splitTree.value, paneId) || !pane) return false
    const current = getPane(activePaneId.value)
    if (current) syncPaneFromState(current)
    syncStateFromPane(pane)
    activePaneId.value = paneId
    state.renderVersion++
    return true
  }

  function splitPane(paneId: string, direction: SplitDirection) {
    const source = getPane(paneId)
    if (!source || visiblePaneCount.value >= MAX_VISIBLE_CANVAS_PANES) return null
    if (paneId === activePaneId.value) syncPaneFromState(source)
    const pane = cloneCanvasPaneState(`pane-${nextPaneIndex++}`, source)
    splitTree.value = splitPaneNode(
      splitTree.value,
      paneId,
      pane.id,
      `split-${nextSplitIndex++}`,
      direction
    )
    panes.value.set(pane.id, pane)
    setActivePane(pane.id)
    triggerRef(panes)
    return pane
  }

  function closePane(paneId: string): boolean {
    if (visiblePaneCount.value <= 1 || !getPane(paneId)) return false
    const nextTree = closePaneNode(splitTree.value, paneId)
    if (!nextTree) return false
    panes.value.delete(paneId)
    splitTree.value = nextTree
    if (activePaneId.value === paneId) {
      const nextPaneId = leafPaneIds(nextTree)[0] ?? initialPane.id
      const nextPane = getPane(nextPaneId)
      if (nextPane) syncStateFromPane(nextPane)
      activePaneId.value = nextPaneId
      state.renderVersion++
    }
    triggerRef(panes)
    return true
  }

  function resizePane(paneId: string, width: number, height: number): void {
    const pane = getPane(paneId)
    if (!pane) return
    pane.viewportWidth = width
    pane.viewportHeight = height
  }

  function setSplitSizes(splitId: string, sizes: number[]): void {
    splitTree.value = updateSplitSizes(splitTree.value, splitId, sizes)
  }

  return {
    panes,
    activePaneId,
    splitTree,
    visiblePaneCount,
    getPane,
    getPaneRenderState,
    getActivePane,
    setActivePane,
    splitPane,
    closePane,
    resizePane,
    setSplitSizes,
    maxVisiblePanes: MAX_VISIBLE_CANVAS_PANES
  }
}

export type CanvasPaneRegistry = ReturnType<typeof createCanvasPaneRegistry>
