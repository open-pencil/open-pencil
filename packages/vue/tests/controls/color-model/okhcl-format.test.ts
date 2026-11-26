import { describe, expect, test } from 'bun:test'

import { ref } from 'vue'

import { createEditor } from '@open-pencil/core'
import { setNodeFillOkHCL } from '@open-pencil/scene-graph/color'

import type { ColorFieldFormat } from '#vue/controls/color-model/types'
import { createOkHCLFieldFormats } from '#vue/controls/okhcl/helpers'

describe('the default color field format', () => {
  test('is OkHCL only while the OkHCL color still makes the paint', () => {
    const editor = createEditor()
    const node = editor.graph.createNode('RECTANGLE', editor.state.currentPageId, {
      fills: [{ type: 'SOLID', color: { r: 0, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }]
    })
    const current = () => editor.graph.getNode(node.id) ?? node
    editor.graph.updateNode(node.id, setNodeFillOkHCL(current(), 0, { h: 250, c: 0.1, l: 0.6 }))
    const noop = () => undefined
    const { getFieldFormat } = createOkHCLFieldFormats(
      ref(new Map<string, ColorFieldFormat>()),
      noop,
      noop,
      () => editor.graph.documentColorSpace
    )
    expect(getFieldFormat(current(), 0, 'fill')).toBe('okhcl')

    // Edited outside OkHCL: the metadata stays but no longer makes the color.
    editor.graph.updateNode(node.id, {
      fills: [{ ...current().fills[0], color: { r: 1, g: 0, b: 0, a: 1 } }]
    })
    expect(getFieldFormat(current(), 0, 'fill')).toBe('rgb')
    editor.dispose()
  })
})
