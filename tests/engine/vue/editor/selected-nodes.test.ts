import { describe, expect, test } from 'bun:test'

import { computed, createApp, effectScope, ref, shallowReactive } from 'vue'

import { createDefaultEditorState, createEditor } from '@open-pencil/core/editor'
import { getSharedStyles, SceneGraph } from '@open-pencil/scene-graph'

import { EDITOR_KEY } from '#vue/editor/context'
import { createSelectedNodeState, useSelectedNodeState } from '#vue/editor/selection-state/nodes'
import { useSceneComputed } from '#vue/internal/scene-computed/use'

function setup() {
  const graph = new SceneGraph()
  const page = graph.getPages()[0]
  const state = shallowReactive(createDefaultEditorState(page.id))
  const editor = createEditor({ graph, state })
  const first = graph.createNode('RECTANGLE', page.id, { x: 10, width: 100 })
  const second = graph.createNode('RECTANGLE', page.id, { x: 30, width: 200 })
  editor.select([first.id])
  const selection = createSelectedNodeState(editor)
  return {
    editor,
    first,
    second,
    selection,
    dispose() {
      selection.dispose()
      editor.dispose()
    }
  }
}

describe('selected-node preview projections', () => {
  test('freezes inactive projections, refreshes on activation and disposes subscriptions', () => {
    const fixture = setup()
    const { editor, first, second } = fixture
    const active = ref(true)
    const selection = createSelectedNodeState(editor, active)
    try {
      const initial = selection.nodes.value
      expect(selection.node.value?.x).toBe(10)

      active.value = false
      editor.graph.updateNodePreview(first.id, { x: 80 })
      editor.select([second.id])
      editor.graph.updateNodePreview(second.id, { x: 130 })
      expect(selection.nodes.value).toBe(initial)
      expect(selection.node.value?.x).toBe(10)

      active.value = true
      expect(selection.node.value?.id).toBe(second.id)
      expect(selection.node.value?.x).toBe(130)
      editor.graph.updateNodePreview(second.id, { x: 160 })
      expect(selection.node.value?.x).toBe(160)

      const last = selection.node.value
      selection.dispose()
      active.value = false
      active.value = true
      editor.graph.updateNodePreview(second.id, { x: 200 })
      expect(last?.x).toBe(160)
    } finally {
      selection.dispose()
      fixture.dispose()
    }
  })

  test('updates only consumers of changed properties, not scene catalogs or the graph object', () => {
    const fixture = setup()
    const { editor, first, second, selection } = fixture
    try {
      const calls = { x: 0, opacity: 0, styles: 0 }
      const x = computed(() => {
        calls.x++
        return selection.node.value?.x
      })
      const opacity = computed(() => {
        calls.opacity++
        return selection.node.value?.opacity
      })
      const app = createApp({ render: () => null })
      app.provide(EDITOR_KEY, editor)
      const styles = app.runWithContext(() =>
        useSceneComputed(() => {
          calls.styles++
          return getSharedStyles(editor.graph, 'fill')
        })
      )
      const selected = selection.node.value
      const selectedNodes = selection.nodes.value
      expect(selected).not.toBe(first)
      expect(x.value).toBe(10)
      expect(opacity.value).toBe(1)
      expect(styles.value).toEqual([])

      editor.graph.updateNodePreview(first.id, { x: 60 })
      expect(x.value).toBe(60)
      expect(opacity.value).toBe(1)
      expect(styles.value).toEqual([])
      expect(selection.node.value).toBe(selected)
      expect(selection.nodes.value).toBe(selectedNodes)
      expect(calls).toEqual({ x: 2, opacity: 1, styles: 1 })

      editor.graph.updateNodePreview(second.id, { x: 90 })
      editor.pan(10, 10)
      expect(x.value).toBe(60)
      expect(opacity.value).toBe(1)
      expect(styles.value).toEqual([])
      expect(calls).toEqual({ x: 2, opacity: 1, styles: 1 })

      editor.graph.updateNodePreview(first.id, { opacity: 0.5 })
      expect(opacity.value).toBe(0.5)
      expect(x.value).toBe(60)
      expect(calls).toEqual({ x: 2, opacity: 2, styles: 1 })
    } finally {
      fixture.dispose()
    }
  })

  test('tracks multi-selection, selection changes and preview cancellation', () => {
    const fixture = setup()
    const { editor, first, second, selection } = fixture
    try {
      editor.select([first.id, second.id])
      const widths = computed(() => selection.nodes.value.map((node) => node.width))
      expect(selection.node.value).toBeNull()
      expect(widths.value).toEqual([100, 200])
      editor.graph.updateNodePreview(second.id, { width: 250 })
      expect(widths.value).toEqual([100, 250])
      editor.graph.updateNodePreview(second.id, { width: 200 })
      expect(widths.value).toEqual([100, 200])
      editor.select([second.id])
      expect(selection.node.value?.id).toBe(second.id)
      editor.graph.updateNodePreview(first.id, { width: 300 })
      expect(widths.value).toEqual([200])
      editor.clearSelection()
      expect(selection.nodes.value).toEqual([])
      expect(selection.node.value).toBeNull()
    } finally {
      fixture.dispose()
    }
  })

  test('refreshes committed edits, undo and deletion', () => {
    const fixture = setup()
    const { editor, first, selection } = fixture
    try {
      expect(selection.node.value?.x).toBe(10)
      editor.updateNodeWithUndo(first.id, { x: 40 }, 'Move')
      expect(selection.node.value?.x).toBe(40)
      editor.undoAction()
      expect(selection.node.value?.x).toBe(10)
      editor.graph.deleteNode(first.id)
      expect(selection.nodes.value).toEqual([])
    } finally {
      fixture.dispose()
    }
  })

  test('follows graph replacement without receiving previews from the discarded graph', () => {
    const fixture = setup()
    const { editor, first, selection } = fixture
    try {
      const previousGraph = editor.graph
      expect(selection.node.value?.x).toBe(10)
      const graph = new SceneGraph()
      const replacement = graph.createNode('RECTANGLE', graph.getPages()[0].id, { x: 50 })
      editor.replaceGraph(graph)
      editor.select([replacement.id])
      expect(selection.node.value?.x).toBe(50)
      previousGraph.updateNodePreview(first.id, { x: 90 })
      expect(selection.node.value?.x).toBe(50)
      graph.updateNodePreview(replacement.id, { x: 60 })
      expect(selection.node.value?.x).toBe(60)
    } finally {
      fixture.dispose()
    }
  })

  test('releases preview subscriptions with the consuming scope', () => {
    const fixture = setup()
    const { editor, first } = fixture
    const scope = effectScope()
    try {
      const selection = scope.run(() => useSelectedNodeState(editor))
      expect(selection?.node.value?.x).toBe(10)
      scope.stop()
      editor.graph.updateNodePreview(first.id, { x: 80 })
      expect(selection?.node.value?.x).toBe(10)
    } finally {
      scope.stop()
      fixture.dispose()
    }
  })
})
