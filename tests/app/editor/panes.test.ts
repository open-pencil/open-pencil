import { describe, expect, test } from 'bun:test'

import { createDefaultEditorState } from '@open-pencil/core'

import { createCanvasPaneRegistry } from '@/app/editor/panes/registry'
import {
  closePaneNode,
  leafPaneIds,
  MAX_VISIBLE_CANVAS_PANES,
  normalizeSplitSizes,
  paneCount,
  splitPaneNode,
  updateSplitSizes
} from '@/app/editor/panes/split-tree'
import type { CanvasSplitNode } from '@/app/editor/panes/split-tree'

describe('canvas split tree', () => {
  test('splits panes and collapses one-child parents', () => {
    const initial: CanvasSplitNode = { type: 'pane', paneId: 'a' }
    const split = splitPaneNode(initial, 'a', 'b', 'split-1', 'horizontal')

    expect(paneCount(split)).toBe(2)
    expect(leafPaneIds(split)).toEqual(['a', 'b'])
    expect(closePaneNode(split, 'a')).toEqual({ type: 'pane', paneId: 'b' })
  })

  test('normalizes valid sizes and rejects invalid updates', () => {
    const split = splitPaneNode({ type: 'pane', paneId: 'a' }, 'a', 'b', 'split-1', 'vertical')
    expect(normalizeSplitSizes(2, [1, 3])).toEqual([25, 75])
    expect(updateSplitSizes(split, 'split-1', [30, 70])).toMatchObject({ sizes: [30, 70] })
    expect(updateSplitSizes(split, 'split-1', [100])).toEqual(split)
  })
})

describe('canvas pane registry', () => {
  test('clones view state without cloning selection or transient interaction state', () => {
    const state = createDefaultEditorState('page')
    state.selectedIds = new Set(['selected'])
    state.hoveredNodeId = 'hovered'
    const registry = createCanvasPaneRegistry(state)
    const first = registry.getActivePane()
    const second = registry.splitPane(first.id, 'horizontal')

    expect(second?.currentPageId).toBe('page')
    expect(second?.selectedIds.size).toBe(0)
    expect(second?.hoveredNodeId).toBeNull()
    expect(registry.visiblePaneCount.value).toBe(2)
    expect(state.selectedIds.size).toBe(0)

    state.panX = 120
    expect(registry.setActivePane(first.id)).toBe(true)
    expect(second?.panX).toBe(120)
    expect(state.selectedIds).toEqual(new Set(['selected']))
    expect(state.panX).toBe(0)
  })

  test('reports the active pane from the editor state and others from their own records', () => {
    const state = createDefaultEditorState('page')
    const registry = createCanvasPaneRegistry(state)
    const first = registry.getActivePane()
    const second = registry.splitPane(first.id, 'horizontal')
    if (!second) throw new Error('Expected a second pane')

    state.zoom = 2
    expect(registry.getPaneView(second.id)?.zoom).toBe(2)
    expect(registry.getPaneView(first.id)?.zoom).toBe(1)

    registry.setActivePane(first.id)
    state.zoom = 0.5
    expect(registry.getPaneView(first.id)?.zoom).toBe(0.5)
    expect(registry.getPaneView(second.id)?.zoom).toBe(2)
  })

  test('refuses the last close and enforces the pane cap', () => {
    const registry = createCanvasPaneRegistry(createDefaultEditorState('page'))
    expect(registry.closePane(registry.activePaneId.value)).toBe(false)

    while (registry.visiblePaneCount.value < MAX_VISIBLE_CANVAS_PANES) {
      expect(registry.splitPane(registry.activePaneId.value, 'horizontal')).not.toBeNull()
    }
    expect(registry.splitPane(registry.activePaneId.value, 'vertical')).toBeNull()
  })

  test('shifts the active view through the editor state and others through their own records', () => {
    const state = createDefaultEditorState('page')
    const registry = createCanvasPaneRegistry(state)
    const first = registry.getActivePane()
    const second = registry.splitPane(first.id, 'horizontal')
    if (!second) throw new Error('Expected a second pane')
    registry.setActivePane(first.id)
    Object.assign(state, { panX: 40, panY: 30 })
    const inactive = { panX: second.panX, panY: second.panY }
    const renderVersion = state.renderVersion

    registry.shiftPane(first.id, 230, 0)
    expect(state).toMatchObject({ panX: 270, panY: 30 })
    registry.shiftPane(second.id, -12, 8)
    expect(registry.getPaneView(second.id)).toMatchObject({
      panX: inactive.panX - 12,
      panY: inactive.panY + 8
    })
    expect(state).toMatchObject({ panX: 270, panY: 30 })
    expect(state.renderVersion).toBe(renderVersion + 2)
  })

  test('shifts nothing for a pane that closed', () => {
    const state = createDefaultEditorState('page')
    const registry = createCanvasPaneRegistry(state)
    const second = registry.splitPane(registry.activePaneId.value, 'horizontal')
    if (!second) throw new Error('Expected a second pane')
    registry.closePane(second.id)
    const before = { panX: state.panX, panY: state.panY }

    registry.shiftPane(second.id, 230, 0)
    expect(state).toMatchObject(before)
  })
})
