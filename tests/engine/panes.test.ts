import { describe, expect, test } from 'bun:test'

import { SceneGraph } from '@open-pencil/core/scene-graph'

import { createCanvasPaneState } from '@/app/editor/panes/create'
import {
  clearPanePageViewports,
  deletePanePageViewport,
  restorePanePageViewport,
  savePanePageViewport
} from '@/app/editor/panes/page-viewports'
import { composePaneRenderState } from '@/app/editor/panes/render-state'
import {
  closePaneNode,
  isValidLayoutSizes,
  leafPaneIds,
  normalizeSizes,
  paneCount,
  splitPaneNode,
  updateSplitSizes
} from '@/app/editor/panes/split-tree'
import { createCanvasPaneRegistry } from '@/app/editor/panes/store'
import type { CanvasSplitNode } from '@/app/editor/panes/types'
import { createInitialAppEditorState } from '@/app/editor/session/types'

describe('canvas pane split tree', () => {
  test('splits a pane into a stable split node', () => {
    const tree: CanvasSplitNode = { type: 'pane', paneId: 'pane-1' }
    const next = splitPaneNode(tree, 'pane-1', 'pane-2', 'split-1', 'horizontal')

    expect(paneCount(next)).toBe(2)
    expect(leafPaneIds(next)).toEqual(['pane-1', 'pane-2'])
    expect(next.type).toBe('split')
    if (next.type === 'split') {
      expect(next.sizes).toEqual([50, 50])
      expect(next.direction).toBe('horizontal')
    }
  })

  test('closes a pane and collapses single-child parents', () => {
    const tree = splitPaneNode(
      { type: 'pane', paneId: 'pane-1' },
      'pane-1',
      'pane-2',
      'split-1',
      'vertical'
    )

    const next = closePaneNode(tree, 'pane-2')
    expect(next).toEqual({ type: 'pane', paneId: 'pane-1' })
  })

  test('normalizes and rejects layout sizes', () => {
    expect(normalizeSizes(2, [10, 30])).toEqual([25, 75])
    expect(normalizeSizes(2, [0, 30])).toEqual([50, 50])
    expect(isValidLayoutSizes([40, 60], 2)).toBe(true)
    expect(isValidLayoutSizes([40], 2)).toBe(false)

    const tree = splitPaneNode(
      { type: 'pane', paneId: 'pane-1' },
      'pane-1',
      'pane-2',
      'split-1',
      'horizontal'
    )
    const updated = updateSplitSizes(tree, 'split-1', [25, 75])
    const ignored = updateSplitSizes(updated, 'split-1', [100])
    expect(ignored).toEqual(updated)
  })
})

describe('canvas pane registry', () => {
  test('refuses to close the last pane and enforces the visible pane cap', () => {
    const graph = new SceneGraph()
    const registry = createCanvasPaneRegistry({
      graph,
      state: createInitialAppEditorState(graph.getPages()[0].id)
    })

    expect(registry.closePane(registry.activePaneId.value)).toEqual({
      ok: false,
      reason: 'last-pane'
    })

    const sourcePane = registry.getActivePane()
    sourcePane.panX = 42
    sourcePane.zoom = 3
    sourcePane.selectedIds = new Set(['node-1'])

    let currentPaneId = registry.activePaneId.value
    for (let i = 1; i < registry.maxVisiblePanes; i++) {
      const result = registry.splitPane(currentPaneId, 'horizontal')
      expect(result.ok).toBe(true)
      if (result.ok) {
        const pane = registry.getPane(result.paneId)
        expect(pane?.panX).toBe(42)
        expect(pane?.zoom).toBe(3)
        expect([...(pane?.selectedIds ?? [])]).toEqual([])
        currentPaneId = result.paneId
      }
    }

    const capped = registry.splitPane(currentPaneId, 'horizontal')
    expect(capped).toEqual({ ok: false, reason: 'pane-cap' })
    expect(registry.visiblePaneCount.value).toBe(registry.maxVisiblePanes)

    const activePaneId = registry.activePaneId.value
    expect(registry.ensureSinglePane()).toBe(activePaneId)
    expect(registry.visiblePaneCount.value).toBe(1)
    expect(leafPaneIds(registry.splitTree.value)).toEqual([activePaneId])
  })
})

describe('canvas pane render state', () => {
  test('combines shared fields and hides remote cursors for inactive panes', () => {
    const shared = createInitialAppEditorState('page-1')
    shared.documentName = 'Shared document'
    shared.sceneVersion = 7
    shared.remoteCursors = [
      {
        name: 'A',
        color: { r: 1, g: 0, b: 0, a: 1 },
        x: 10,
        y: 20,
        pageId: 'page-1'
      },
      {
        name: 'B',
        color: { r: 0, g: 1, b: 0, a: 1 },
        x: 30,
        y: 40,
        pageId: 'page-2'
      }
    ]

    const pane = createCanvasPaneState('pane-1', 'page-2')
    pane.panX = 11
    pane.zoom = 2
    pane.selectedIds = new Set(['node-1'])
    pane.cursorCanvasX = 21
    pane.cursorCanvasY = 34
    pane.nodeEditState = {
      nodeId: 'node-1',
      origNetwork: { vertices: [], segments: [], regions: [] },
      origBounds: { x: 0, y: 0, width: 10, height: 10 },
      vertices: [],
      segments: [],
      regions: [],
      selectedVertexIndices: new Set(),
      draggedHandleInfo: null,
      selectedHandles: new Set(),
      hoveredHandleInfo: null
    }

    const activeRenderState = composePaneRenderState(shared, pane, { isActivePane: true })
    const inactiveRenderState = composePaneRenderState(shared, pane)
    expect(activeRenderState.documentName).toBe('Shared document')
    expect(activeRenderState.sceneVersion).toBe(7)
    expect(activeRenderState.currentPageId).toBe('page-2')
    expect(activeRenderState.panX).toBe(11)
    expect(activeRenderState.zoom).toBe(2)
    expect([...activeRenderState.selectedIds]).toEqual(['node-1'])
    expect(activeRenderState.cursorCanvasX).toBe(21)
    expect(activeRenderState.cursorCanvasY).toBe(34)
    expect(activeRenderState.nodeEditState?.nodeId).toBe('node-1')
    expect(activeRenderState.remoteCursors.map((cursor) => cursor.name)).toEqual(['B'])
    expect(inactiveRenderState.remoteCursors.map((cursor) => cursor.name)).toEqual(['B'])
  })
})

describe('canvas pane page viewports', () => {
  test('saves, restores, deletes, and clears pane page viewports', () => {
    const pane = createCanvasPaneState('pane-1', 'page-1')
    pane.panX = 12
    pane.panY = 24
    pane.zoom = 2
    savePanePageViewport(pane)

    pane.panX = 0
    pane.panY = 0
    pane.zoom = 1
    restorePanePageViewport(pane, 'page-1')
    expect(pane.panX).toBe(12)
    expect(pane.panY).toBe(24)
    expect(pane.zoom).toBe(2)

    deletePanePageViewport(pane, 'page-1')
    pane.panX = 5
    restorePanePageViewport(pane, 'page-1')
    expect(pane.panX).toBe(0)
    expect(pane.zoom).toBe(1)

    savePanePageViewport(pane)
    clearPanePageViewports(pane)
    expect(pane.pageViewports.size).toBe(0)
  })
})
