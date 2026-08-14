import { computed, ref, shallowRef, triggerRef } from 'vue'

import type { EditorState } from '@open-pencil/core/editor'

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

  function getActivePane(): CanvasPaneState {
    return getPane(activePaneId.value) ?? initialPane
  }

  function setActivePane(paneId: string): boolean {
    if (!containsPane(splitTree.value, paneId) || !getPane(paneId)) return false
    activePaneId.value = paneId
    return true
  }

  function splitPane(paneId: string, direction: SplitDirection) {
    const source = getPane(paneId)
    if (!source || visiblePaneCount.value >= MAX_VISIBLE_CANVAS_PANES) return null
    const pane = cloneCanvasPaneState(`pane-${nextPaneIndex++}`, source)
    splitTree.value = splitPaneNode(
      splitTree.value,
      paneId,
      pane.id,
      `split-${nextSplitIndex++}`,
      direction
    )
    panes.value.set(pane.id, pane)
    activePaneId.value = pane.id
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
      activePaneId.value = leafPaneIds(nextTree)[0] ?? initialPane.id
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
