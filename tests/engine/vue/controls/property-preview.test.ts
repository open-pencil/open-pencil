import { describe, expect, test } from 'bun:test'

import { computed, effectScope } from 'vue'

import { createEditor } from '@open-pencil/core/editor'

import { createLayoutActions } from '#vue/controls/layout/helpers'
import { usePropScrub } from '#vue/controls/prop-scrub/use'

describe('property previews', () => {
  test('pins targets through selection changes and releases previews on scope disposal', () => {
    const editor = createEditor()
    const scope = effectScope()
    try {
      const first = editor.graph.createNode('RECTANGLE', editor.state.currentPageId, { x: 10 })
      const second = editor.graph.createNode('RECTANGLE', editor.state.currentPageId, { x: 30 })
      editor.select([first.id])
      const scrub = scope.run(() => usePropScrub(editor))
      if (!scrub) throw new Error('Scrub scope unavailable')
      scrub.updateProp([first], 'x', 50)
      editor.select([second.id])
      scrub.updateProp([second], 'x', 80)
      scrub.commitProp([second], 'x', 80, 30)
      expect([first.x, second.x]).toEqual([10, 30])
      expect(editor.undo.canUndo).toBe(false)
      scrub.updateProp([second], 'x', 90)
      scope.stop()
      expect(second.x).toBe(30)
      expect(editor.isInteractiveEditing()).toBe(false)
    } finally {
      scope.stop()
      editor.dispose()
    }
  })

  test('size preview owns the Hug-to-Fixed change and cancels or undoes it with the value', () => {
    const editor = createEditor()
    try {
      const frame = editor.graph.createNode('FRAME', editor.state.currentPageId, {
        width: 100,
        height: 40,
        layoutMode: 'HORIZONTAL',
        primaryAxisSizing: 'HUG',
        counterAxisSizing: 'FIXED'
      })
      editor.graph.createNode('RECTANGLE', frame.id, { width: 100, height: 20 })
      editor.runLayoutForNode(frame.id)
      const original = frame.width
      const actions = createLayoutActions({
        editor,
        node: computed(() => frame),
        isInAutoLayout: computed(() => false)
      })
      actions.updateAxisSize('width', 200)
      expect(frame.primaryAxisSizing).toBe('FIXED')
      expect(editor.undo.canUndo).toBe(false)
      actions.cancelPreview()
      expect(frame.primaryAxisSizing).toBe('HUG')
      expect(frame.width).toBe(original)
      actions.updateAxisSize('width', 200)
      actions.commitAxisSize('width', 200, original)
      editor.undoAction()
      expect(frame.primaryAxisSizing).toBe('HUG')
      expect(frame.width).toBe(original)
      expect(editor.undo.canUndo).toBe(false)
    } finally {
      editor.dispose()
    }
  })

  test('updates layout live without committed events, then commits and undoes the whole result', () => {
    const editor = createEditor()
    try {
      const frame = editor.graph.createNode('FRAME', editor.state.currentPageId, {
        width: 200,
        height: 100,
        layoutMode: 'HORIZONTAL',
        primaryAxisSizing: 'FIXED',
        counterAxisSizing: 'FIXED'
      })
      const child = editor.graph.createNode('RECTANGLE', frame.id, {
        width: 100,
        height: 20,
        layoutGrow: 1
      })
      editor.updateNode(frame.id, { width: 200 })
      expect(child.width).toBe(200)
      const sceneVersion = editor.state.sceneVersion
      let committed = 0
      editor.onEditorEvent('node:updated', () => {
        committed++
      })
      const preview = editor.beginNodePreview('Resize')
      preview.update(frame.id, { width: 320 })
      expect(child.width).toBe(320)
      expect(editor.state.sceneVersion).toBe(sceneVersion)
      expect(committed).toBe(0)
      expect(editor.undo.canUndo).toBe(false)
      preview.commit()
      expect(committed).toBeGreaterThan(0)
      editor.undoAction()
      expect(frame.width).toBe(200)
      expect(child.width).toBe(200)
      expect(editor.undo.canUndo).toBe(false)
      editor.redoAction()
      expect(frame.width).toBe(320)
      expect(child.width).toBe(320)
    } finally {
      editor.dispose()
    }
  })

  test('restores different multi-selection values on cancel and groups a completed scrub in one undo', () => {
    const editor = createEditor()
    try {
      const first = editor.graph.createNode('RECTANGLE', editor.state.currentPageId, { x: 10 })
      const second = editor.graph.createNode('RECTANGLE', editor.state.currentPageId, { x: 30 })
      const nodes = [first, second]
      const scrub = usePropScrub(editor)
      const version = editor.state.sceneVersion
      scrub.updateProp(nodes, 'x', 50)
      expect(nodes.map((n) => n.x)).toEqual([50, 50])
      scrub.cancelProp(nodes, 'x')
      expect(nodes.map((n) => n.x)).toEqual([10, 30])
      // Cancel restores through preview events, then reconciles the scene once.
      expect(editor.state.sceneVersion).toBe(version + 1)
      expect(editor.undo.canUndo).toBe(false)
      scrub.updateProp(nodes, 'x', 60)
      scrub.commitProp(nodes, 'x', 60, 0)
      editor.undoAction()
      expect(nodes.map((n) => n.x)).toEqual([10, 30])
      expect(editor.undo.canUndo).toBe(false)
      editor.redoAction()
      expect(nodes.map((n) => n.x)).toEqual([60, 60])
    } finally {
      editor.dispose()
    }
  })
})
