import { describe, expect, test } from 'bun:test'

import { createEditor } from '@open-pencil/core/editor'

describe('page switching viewport', () => {
  test('fits page content after switching pages', async () => {
    const editor = createEditor({ getViewportSize: () => ({ width: 1000, height: 800 }) })
    const page = editor.graph.addPage('Large page')
    editor.graph.createNode('RECTANGLE', page.id, {
      x: 0,
      y: 0,
      width: 10_000,
      height: 5_000
    })

    await editor.switchPage(page.id)

    expect(editor.state.zoom).toBeCloseTo(1000 / 10_160)
  })

  test('keeps the default viewport for empty pages', async () => {
    const editor = createEditor({ getViewportSize: () => ({ width: 1000, height: 800 }) })
    const page = editor.graph.addPage('Empty page')

    await editor.switchPage(page.id)

    expect(editor.state.zoom).toBe(1)
    expect(editor.state.panX).toBe(0)
    expect(editor.state.panY).toBe(0)
  })

  test('does not zoom out below two percent', async () => {
    const editor = createEditor({ getViewportSize: () => ({ width: 1000, height: 800 }) })
    const page = editor.graph.addPage('Huge page')
    editor.graph.createNode('RECTANGLE', page.id, {
      x: 0,
      y: 0,
      width: 1_000_000,
      height: 1_000_000
    })

    await editor.switchPage(page.id)

    expect(editor.state.zoom).toBe(0.02)
  })
})
