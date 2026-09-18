import { describe, expect, test } from 'bun:test'

import { createEditor } from '@open-pencil/core/editor'
import { FigmaAPI } from '@open-pencil/core/figma-api'
import { exportFigFile, parseFigFile } from '@open-pencil/core/io'
import { SceneGraph } from '@open-pencil/scene-graph'
import type { Color } from '@open-pencil/scene-graph'

// Exact float32 backgroundColor from the reported finance FIG canvas 0:4.
const navy: Color = {
  r: 0.027450980618596077,
  g: 0.13725490868091583,
  b: 0.3529411852359772,
  a: 1
}
const red: Color = { r: 1, g: 0, b: 0, a: 1 }

function importedGraph() {
  const graph = new SceneGraph()
  const page = graph.getPages()[0]
  page.source.fig.rawNodeFields.backgroundColor = { ...navy }
  return graph
}

describe('editor page backgrounds', () => {
  test('initializes and replaces graphs using imported canvas backgroundColor', () => {
    const editor = createEditor({ graph: importedGraph() })
    try {
      expect(editor.state.pageColor).toEqual(navy)
      editor.replaceGraph(new SceneGraph())
      expect(editor.state.pageColor).toEqual({ r: 0.96, g: 0.96, b: 0.96, a: 1 })
      editor.replaceGraph(importedGraph())
      expect(editor.state.pageColor).toEqual(navy)
    } finally {
      editor.dispose()
    }
  })

  test('switches using graph paint state rather than stale viewport colors', async () => {
    const graph = importedGraph()
    const first = graph.getPages()[0]
    const second = graph.addPage('Second')
    const editor = createEditor({ graph })
    const api = new FigmaAPI(graph)
    try {
      editor.state.panX = 42
      await editor.switchPage(second.id)
      editor.setPageColor(red)
      api.currentPage.backgrounds = [
        { type: 'SOLID', color: { ...navy, a: 0.5 }, opacity: 0.5, visible: true }
      ]
      expect(editor.state.pageColor).toEqual(red)
      await editor.switchPage(first.id)
      expect(editor.state.panX).toBe(42)
      expect(editor.state.pageColor).toEqual({ ...navy, a: 0.25 })
      api.currentPage.backgrounds = []
      expect(editor.state.pageColor).toEqual({ r: 0.96, g: 0.96, b: 0.96, a: 1 })
      api.currentPage.backgrounds = [{ type: 'SOLID', color: red, opacity: 1, visible: false }]
      expect(editor.state.pageColor).toEqual({ r: 0.96, g: 0.96, b: 0.96, a: 1 })
    } finally {
      editor.dispose()
    }
  })

  test('imports legacy canvas color from FIG bytes without inventing background paints', async () => {
    const bytes = await exportFigFile(importedGraph())
    const graph = await parseFigFile(bytes.buffer as ArrayBuffer)
    const editor = createEditor({ graph })
    try {
      expect(graph.getPages()[0].source.fig.rawNodeFields.backgroundPaints).toBeUndefined()
      expect(editor.state.pageColor).toEqual(navy)
      expect(new FigmaAPI(graph).currentPage.backgrounds[0]?.color).toEqual(navy)
    } finally {
      editor.dispose()
    }
  })

  test('editor edits update API paints and survive FIG export/import', async () => {
    const editor = createEditor({ graph: importedGraph() })
    try {
      const color = { ...red, a: 0.5 }
      editor.setPageColor(color)
      color.r = 0
      expect(editor.state.pageColor).toEqual({ ...red, a: 0.5 })
      const api = new FigmaAPI(editor.graph)
      expect(api.currentPage.backgrounds[0]?.color).toEqual({ ...red, a: 0.5 })
      const bytes = await exportFigFile(editor.graph)
      const reloaded = await parseFigFile(bytes.buffer as ArrayBuffer)
      editor.replaceGraph(reloaded)
      expect(editor.state.pageColor).toEqual({ ...red, a: 0.5 })
      expect(new FigmaAPI(reloaded).currentPage.backgrounds[0]?.color).toEqual({ ...red, a: 0.5 })
    } finally {
      editor.dispose()
    }
  })
})
