import { describe, expect, test } from 'bun:test'

import { shallowRef } from 'vue'

import { createEditor } from '@open-pencil/core'

import {
  createDefaultEffect,
  createEffectEditActions,
  grainSizeChange,
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

  test('a grain edit changes only its value on every selected layer, each keeping the rest', () => {
    const editor = createEditor()
    try {
      const noise = (density: number, seed: number) => ({
        ...createDefaultEffect(),
        type: 'NOISE' as const,
        noise: { noiseType: 'MONOTONE' as const, noiseSize: { x: 1, y: 1 }, density, seed }
      })
      const page = editor.state.currentPageId
      const first = editor.graph.createNode('RECTANGLE', page, { effects: [noise(0.2, 1)] })
      const second = editor.graph.createNode('RECTANGLE', page, { effects: [noise(0.8, 2)] })
      const actions = createEffectEditActions(
        editor,
        shallowRef<Map<string, EffectEditSnapshot> | null>(null)
      )
      actions.commitEffect([first, second], 0, grainSizeChange(3))
      expect(editor.graph.getNode(first.id)?.effects[0].noise).toEqual({
        noiseType: 'MONOTONE',
        noiseSize: { x: 3, y: 3 },
        density: 0.2,
        seed: 1
      })
      expect(editor.graph.getNode(second.id)?.effects[0].noise?.density).toBe(0.8)
      expect(editor.graph.getNode(second.id)?.effects[0].noise?.seed).toBe(2)
    } finally {
      editor.dispose()
    }
  })

  test('a size edit keeps the clipping of a texture that stores none', () => {
    const texture = { ...createDefaultEffect(), type: 'TEXTURE' as const }
    const change = grainSizeChange(6)
    const patched = typeof change === 'function' ? change(texture) : change
    expect(patched.texture).toEqual({ noiseSize: { x: 6, y: 6 }, clipToShape: true })
  })
})
