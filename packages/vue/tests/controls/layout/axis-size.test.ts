import { describe, expect, test } from 'bun:test'

import { computed, effectScope } from 'vue'

import { createEditor } from '@open-pencil/core'
import type { SceneNode } from '@open-pencil/scene-graph'

import { createLayoutActions } from '#vue/controls/layout/helpers'

// Figma (desktop, 2026-11-07): typing W into the panel places the layers inside by their
// constraints, as a handle drag or resize() does.
describe('a typed width or height', () => {
  function setup() {
    const editor = createEditor()
    const page = editor.state.currentPageId
    const frame = editor.graph.createNode('FRAME', page, { width: 100, height: 100 })
    const stretched = editor.graph.createNode('RECTANGLE', frame.id, {
      x: 0.7,
      y: 3.75,
      width: 22.6,
      height: 16.5,
      horizontalConstraint: 'STRETCH'
    })
    const scaled = editor.graph.createNode('RECTANGLE', frame.id, {
      x: 60,
      y: 50,
      width: 20,
      height: 10,
      horizontalConstraint: 'SCALE'
    })
    const scope = effectScope()
    const actions = scope.run(() =>
      createLayoutActions({ editor, node: computed<SceneNode | null>(() => frame) })
    )
    if (!actions) throw new Error('Expected layout actions')
    const box = (node: SceneNode) => [node.x, node.y, node.width, node.height]
    return { editor, frame, stretched, scaled, actions, box, scope }
  }

  test('places the layers inside by their constraints, from where the edit began', () => {
    const { editor, frame, stretched, scaled, actions, box, scope } = setup()
    try {
      // Scrubbing passes through other widths; each step places from the start, not the last step.
      actions.updateAxisSize('width', 300)
      actions.updateAxisSize('width', 120.4)
      expect(box(frame)).toEqual([0, 0, 120.4, 100])
      expect(box(stretched)).toEqual([0.7, 3.75, 42.6, 16.5])
      expect(scaled.x).toBeCloseTo(72.24, 6)
      expect(scaled.width).toBeCloseTo(24.08, 6)
      actions.commitAxisSize('width', 120.4, 100)

      editor.undoAction()
      expect([box(frame), box(stretched), box(scaled)]).toEqual([
        [0, 0, 100, 100],
        [0.7, 3.75, 22.6, 16.5],
        [60, 50, 20, 10]
      ])
      expect(editor.undo.canUndo).toBe(false)
    } finally {
      scope.stop()
      editor.dispose()
    }
  })

  test('cancelling puts the layers inside back', () => {
    const { editor, frame, stretched, actions, box, scope } = setup()
    try {
      actions.updateAxisSize('width', 70)
      expect(stretched.x).toBeCloseTo(-6.7, 6)
      expect(stretched.width).toBeCloseTo(7.4, 6)
      expect(stretched.flipX).toBe(true)
      actions.cancelPreview()
      expect([box(frame), box(stretched), stretched.flipX]).toEqual([
        [0, 0, 100, 100],
        [0.7, 3.75, 22.6, 16.5],
        false
      ])
      expect(editor.undo.canUndo).toBe(false)
    } finally {
      scope.stop()
      editor.dispose()
    }
  })

  test('an instance turns its Left & right layer over past zero, as in Figma', () => {
    const editor = createEditor()
    const scope = effectScope()
    try {
      const page = editor.state.currentPageId
      const card = editor.graph.createNode('COMPONENT', page, { width: 100, height: 50 })
      editor.graph.createNode('RECTANGLE', card.id, {
        x: 10,
        y: 30,
        width: 20,
        height: 10,
        horizontalConstraint: 'STRETCH'
      })
      const instance = editor.graph.createInstance(card.id, page)
      if (!instance) throw new Error('Expected an instance')
      const actions = scope.run(() =>
        createLayoutActions({ editor, node: computed<SceneNode | null>(() => instance) })
      )
      actions?.updateAxisSize('width', 70)
      actions?.commitAxisSize('width', 70, 100)
      const bar = editor.graph.getChildren(instance.id)[0]
      expect(bar).toMatchObject({ x: 0, width: 10, flipX: true })
    } finally {
      scope.stop()
      editor.dispose()
    }
  })
})
