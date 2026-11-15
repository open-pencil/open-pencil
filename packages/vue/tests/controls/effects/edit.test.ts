import { describe, expect, test } from 'bun:test'

import { shallowRef } from 'vue'

import { createEditor } from '@open-pencil/core'

import {
  createDefaultEffect,
  createEffectEditActions,
  type EffectEditSnapshot
} from '#vue/controls/effects/helpers'

const shadow = { ...createDefaultEffect(), radius: 12 }

describe('effect edits', () => {
  test('a change made in one step, such as a checkbox, is its own undo step', () => {
    const editor = createEditor()
    try {
      const node = editor.graph.createNode('RECTANGLE', editor.state.currentPageId, {
        effects: [shadow]
      })
      const actions = createEffectEditActions(
        editor,
        shallowRef<Map<string, EffectEditSnapshot> | null>(null)
      )
      actions.commitEffect([node], 0, { showShadowBehindNode: false })
      expect(editor.graph.getNode(node.id)?.effects[0].showShadowBehindNode).toBe(false)
      editor.undo.undo()
      expect(editor.graph.getNode(node.id)?.effects[0].showShadowBehindNode).toBeUndefined()
    } finally {
      editor.dispose()
    }
  })

  test('a scrub commits once, from the value before it began', () => {
    const editor = createEditor()
    try {
      const node = editor.graph.createNode('RECTANGLE', editor.state.currentPageId, {
        effects: [shadow]
      })
      const actions = createEffectEditActions(
        editor,
        shallowRef<Map<string, EffectEditSnapshot> | null>(null)
      )
      actions.scrubEffect([node], 0, { radius: 16 })
      actions.scrubEffect([node], 0, { radius: 20 })
      actions.commitEffect([node], 0, { radius: 24 })
      expect(editor.graph.getNode(node.id)?.effects[0].radius).toBe(24)
      editor.undo.undo()
      expect(editor.graph.getNode(node.id)?.effects[0].radius).toBe(12)
    } finally {
      editor.dispose()
    }
  })
})
