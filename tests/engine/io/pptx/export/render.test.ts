import { describe, expect, test } from 'bun:test'

import { unzipSync } from 'fflate'

import { SceneGraph, renderNodesToPPTX, type PPTXExportStats } from '@open-pencil/core'

// 1x1 transparent PNG — stub rasterizer output so unit tests avoid CanvasKit.
const TINY_PNG = Uint8Array.from(
  atob(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
  ),
  (c) => c.charCodeAt(0)
)

const stubRasterize = () => Promise.resolve(TINY_PNG)

function makeGraph() {
  const graph = new SceneGraph()
  graph.createNode('CANVAS', graph.rootId, { name: 'Page 1' })
  return graph
}

function pageId(graph: SceneGraph) {
  return graph.getPages()[0].id
}

function makeSlideFrame(graph: SceneGraph, name: string) {
  return graph.createNode('FRAME', pageId(graph), {
    name,
    width: 1280,
    height: 720,
    fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 }, opacity: 1, visible: true }]
  })
}

function unzipPptx(data: Uint8Array): Record<string, Uint8Array> {
  return unzipSync(data)
}

function slideXml(files: Record<string, Uint8Array>, index: number): string {
  const entry = files[`ppt/slides/slide${index}.xml`]
  expect(entry).toBeDefined()
  return new TextDecoder().decode(entry)
}

describe('renderNodesToPPTX()', () => {
  test('returns null for empty or hidden selection', async () => {
    const graph = makeGraph()
    expect(
      await renderNodesToPPTX(graph, pageId(graph), [], { rasterize: stubRasterize })
    ).toBeNull()

    const hidden = graph.createNode('FRAME', pageId(graph), {
      width: 100,
      height: 100,
      visible: false
    })
    expect(
      await renderNodesToPPTX(graph, pageId(graph), [hidden.id], { rasterize: stubRasterize })
    ).toBeNull()
  })

  test('one slide per top-level frame', async () => {
    const graph = makeGraph()
    const a = makeSlideFrame(graph, 'Slide A')
    const b = makeSlideFrame(graph, 'Slide B')
    const data = await renderNodesToPPTX(graph, pageId(graph), [a.id, b.id], {
      rasterize: stubRasterize
    })
    expect(data).not.toBeNull()
    if (!data) return
    const files = unzipPptx(data)
    expect(files['ppt/presentation.xml']).toBeDefined()
    expect(files['ppt/slides/slide1.xml']).toBeDefined()
    expect(files['ppt/slides/slide2.xml']).toBeDefined()
    expect(files['ppt/slides/slide3.xml']).toBeUndefined()
  })

  test('text becomes a native run with styles preserved', async () => {
    const graph = makeGraph()
    const frame = makeSlideFrame(graph, 'Slide')
    graph.createNode('TEXT', frame.id, {
      text: 'Hello PPTX',
      width: 400,
      height: 60,
      x: 100,
      y: 100,
      fontSize: 32,
      fontFamily: 'Inter',
      fills: [{ type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }],
      styleRuns: [{ start: 0, length: 5, style: { fontWeight: 700 } }]
    })
    const data = await renderNodesToPPTX(graph, pageId(graph), [frame.id], {
      rasterize: stubRasterize
    })
    expect(data).not.toBeNull()
    if (!data) return
    const xml = slideXml(unzipPptx(data), 1)
    expect(xml).toContain('Hello')
    expect(xml).toContain('PPTX')
    // Bold partial run survives as its own <a:r> with b="1".
    expect(xml).toContain('b="1"')
    expect(xml).toContain('FF0000')
    expect(xml).toContain('Inter')
  })

  test('solid shapes become native shapes, gradients fall back to images', async () => {
    const graph = makeGraph()
    const frame = makeSlideFrame(graph, 'Slide')
    graph.createNode('RECTANGLE', frame.id, {
      width: 200,
      height: 100,
      x: 40,
      y: 40,
      fills: [{ type: 'SOLID', color: { r: 0, g: 0, b: 1, a: 1 }, opacity: 1, visible: true }]
    })
    graph.createNode('RECTANGLE', frame.id, {
      width: 200,
      height: 100,
      x: 40,
      y: 200,
      fills: [
        {
          type: 'GRADIENT_LINEAR',
          color: { r: 0, g: 0, b: 0, a: 1 },
          opacity: 1,
          visible: true,
          gradientStops: [
            { position: 0, color: { r: 1, g: 0, b: 0, a: 1 } },
            { position: 1, color: { r: 0, g: 0, b: 1, a: 1 } }
          ]
        }
      ]
    })

    let stats: PPTXExportStats | null = null
    const data = await renderNodesToPPTX(graph, pageId(graph), [frame.id], {
      rasterize: stubRasterize,
      onStats: (s) => {
        stats = s
      }
    })
    expect(data).not.toBeNull()
    if (!data) return
    const files = unzipPptx(data)
    const xml = slideXml(files, 1)
    expect(xml).toContain('0000FF')
    // Gradient rect got rasterized into a media image.
    const media = Object.keys(files).filter((f) => f.startsWith('ppt/media/') && !f.endsWith('/'))
    expect(media.length).toBeGreaterThan(0)
    expect(stats).not.toBeNull()
    if (!stats) return
    const reported: PPTXExportStats = stats
    expect(reported.editable).toBeGreaterThan(0)
    expect(reported.fallback).toBe(1)
    expect(reported.fallbackReasons['gradient fill']).toBe(1)
  })

  test('vector-only container (icon) rasterizes as one image, not per path', async () => {
    const graph = makeGraph()
    const frame = makeSlideFrame(graph, 'Slide')
    const iconFrame = graph.createNode('FRAME', frame.id, {
      name: 'Icon / lucide:heart',
      x: 40,
      y: 40,
      width: 48,
      height: 48,
      fills: []
    })
    for (let i = 0; i < 3; i++) {
      graph.createNode('VECTOR', iconFrame.id, {
        name: 'path',
        width: 48,
        height: 48,
        fills: [{ type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }]
      })
    }

    let stats: PPTXExportStats | null = null
    const rasterCalls: string[][] = []
    const data = await renderNodesToPPTX(graph, pageId(graph), [frame.id], {
      rasterize: (ids) => {
        rasterCalls.push(ids)
        return Promise.resolve(TINY_PNG)
      },
      onStats: (s) => {
        stats = s
      }
    })
    expect(data).not.toBeNull()
    if (!data) return
    // The icon frame rasterized once (whole container), not once per path.
    expect(rasterCalls).toEqual([[iconFrame.id]])
    const media = Object.keys(unzipPptx(data)).filter((f) => f.startsWith('ppt/media/') && !f.endsWith('/'))
    expect(media).toHaveLength(1)
    expect(stats).not.toBeNull()
    if (!stats) return
    const reported: PPTXExportStats = stats
    expect(reported.fallbackReasons['vector graphics']).toBe(1)
  })

  test('solid frame background maps to slide background color', async () => {
    const graph = makeGraph()
    const frame = graph.createNode('FRAME', pageId(graph), {
      width: 1280,
      height: 720,
      fills: [{ type: 'SOLID', color: { r: 0.2, g: 0.4, b: 0.6, a: 1 }, opacity: 1, visible: true }]
    })
    const data = await renderNodesToPPTX(graph, pageId(graph), [frame.id], {
      rasterize: stubRasterize
    })
    expect(data).not.toBeNull()
    if (!data) return
    const xml = slideXml(unzipPptx(data), 1)
    expect(xml.toUpperCase()).toContain('336699')
  })
})
