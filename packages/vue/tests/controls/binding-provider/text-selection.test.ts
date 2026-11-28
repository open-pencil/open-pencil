import { afterEach, describe, expect, test } from 'bun:test'

import { createEditor } from '@open-pencil/core'
import { SkiaRenderer } from '@open-pencil/core/canvas'
import { getCanvasKit } from '@open-pencil/core/canvaskit'
import { expectDefined } from '@open-pencil/test-support/assert'

import { createOpenPencilBindingProvider } from '#vue/controls/binding-provider/open-pencil'

const cleanups: (() => void)[] = []

afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup()
})

describe('open-pencil binding provider while editing text', () => {
  test('surfaces bound, mixed, and unbound states for selected character fill bindings', async () => {
    const ck = await getCanvasKit()
    const surface = expectDefined(ck.MakeSurface(200, 200), 'surface')
    const renderer = new SkiaRenderer(ck, surface)
    const editor = createEditor()
    editor.setCanvasKit(ck, renderer)
    cleanups.push(() => {
      editor.dispose()
      renderer.destroy()
    })
    await renderer.loadFonts()

    const page = editor.state.currentPageId
    const text = editor.graph.createNode('TEXT', page, {
      text: 'Hello world',
      width: 200,
      height: 20
    })
    const colors = editor.graph.createCollection('Colors')
    const primary = editor.graph.createVariable('Primary', 'COLOR', colors.id, {
      r: 0.1,
      g: 0.1,
      b: 0.1,
      a: 1
    })
    const accent = editor.graph.createVariable('Accent', 'COLOR', colors.id, {
      r: 0.9,
      g: 0.2,
      b: 0.3,
      a: 1
    })

    editor.graph.bindVariable(text.id, 'fills/0/color', primary.id)
    editor.startTextEditing(text.id)
    const state = expectDefined(editor.textEditor?.state, 'text editor state')
    state.selectionAnchor = 6
    state.cursor = 11 // "world"

    const provider = createOpenPencilBindingProvider(editor, {
      types: ['COLOR'],
      resolve: (ed, variableId, target) =>
        target ? ed.graph.resolveColorVariableForNode(target.nodeId, variableId) : undefined
    })
    const target = { nodeId: text.id, path: 'fills/0/color' }

    provider.bind(target, accent.id)
    expect(provider.getBindingId(target)).toBe(accent.id)
    expect(provider.getBound(target)?.id).toBe(accent.id)
    expect(provider.getState([target])).toBe('bound')

    // Spanning "Hello" (primary) and "world" (accent) reports mixed.
    state.selectionAnchor = 4
    state.cursor = 8
    expect(provider.getBindingId(target)).toBeUndefined()
    expect(provider.getBound(target)).toBeUndefined()
    expect(provider.getState([target])).toBe('mixed')

    // Unbinding "world" clears the range binding without unbinding the text layer.
    state.selectionAnchor = 6
    state.cursor = 11
    provider.unbind(target)
    expect(provider.getBindingId(target)).toBeUndefined()
    expect(provider.getState([target])).toBe('unbound')
    expect(editor.graph.getNode(text.id)?.boundVariables['fills/0/color']).toBe(primary.id)
  })
})
