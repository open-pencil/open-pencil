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

  test('preserves the viewport after the first visit to a page', async () => {
    const editor = createEditor({ getViewportSize: () => ({ width: 1000, height: 800 }) })
    const firstPage = editor.graph.getPages()[0]
    const page = editor.graph.addPage('Large page')
    editor.graph.createNode('RECTANGLE', page.id, {
      x: 0,
      y: 0,
      width: 10_000,
      height: 5_000
    })

    await editor.switchPage(page.id)
    editor.pan(123, 456)
    editor.zoomToLevel(0.5)
    const expectedViewport = {
      panX: editor.state.panX,
      panY: editor.state.panY,
      zoom: editor.state.zoom
    }

    await editor.switchPage(firstPage.id)
    await editor.switchPage(page.id)

    expect(editor.state.panX).toBe(expectedViewport.panX)
    expect(editor.state.panY).toBe(expectedViewport.panY)
    expect(editor.state.zoom).toBe(expectedViewport.zoom)
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
