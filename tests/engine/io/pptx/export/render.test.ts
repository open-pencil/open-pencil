import { describe, expect, test } from 'bun:test'

import { renderNodesToPPTX, type PPTXExportStats } from '@open-pencil/core'
import { BUILTIN_IO_FORMATS } from '@open-pencil/core/io'

import {
  SLIDE_WIDTH_IN,
  TINY_PNG,
  inches,
  makeGraph,
  makeSlideFrame,
  pageId,
  placements,
  slideXML,
  solidFill,
  solidStroke,
  stubRasterize,
  unzipPPTX
} from './helpers'

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
    const files = unzipPPTX(data)
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
    const xml = slideXML(unzipPPTX(data), 1)
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
    const files = unzipPPTX(data)
    const xml = slideXML(files, 1)
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
    const media = Object.keys(unzipPPTX(data)).filter(
      (f) => f.startsWith('ppt/media/') && !f.endsWith('/')
    )
    expect(media).toHaveLength(1)
    expect(stats).not.toBeNull()
    if (!stats) return
    const reported: PPTXExportStats = stats
    expect(reported.fallbackReasons['vector graphics']).toBe(1)
  })

  test('a child of a rotated frame keeps the inherited rotation and stays centered', async () => {
    const graph = makeGraph()
    const frame = makeSlideFrame(graph, 'Slide')
    const rotated = graph.createNode('FRAME', frame.id, {
      name: 'Rotated',
      x: 400,
      y: 200,
      width: 200,
      height: 100,
      rotation: 90,
      fills: []
    })
    graph.createNode('RECTANGLE', rotated.id, {
      width: 200,
      height: 100,
      fills: [solidFill(0, 0, 1)]
    })

    const data = await renderNodesToPPTX(graph, pageId(graph), [frame.id], {
      rasterize: stubRasterize
    })
    expect(data).not.toBeNull()
    if (!data) return
    const [rect, ...rest] = placements(slideXML(unzipPPTX(data), 1))
    expect(rest).toHaveLength(0)
    // Rotation comes from the parent frame, and the rect is centered on it —
    // the unrotated box origin, not the rotated corner at (550, 150).
    expect(rect.rot).toBeCloseTo(90, 3)
    expect(rect.centerX).toBeCloseTo(inches(500), 3)
    expect(rect.centerY).toBeCloseTo(inches(250), 3)
    expect(rect.width).toBeCloseTo(inches(200), 3)
    expect(rect.height).toBeCloseTo(inches(100), 3)
  })

  test('a root frame with overflowing clipped content rasterizes as one image', async () => {
    const graph = makeGraph()
    const frame = makeSlideFrame(graph, 'Clipped slide')
    frame.clipsContent = true
    graph.createNode('RECTANGLE', frame.id, {
      x: 1200,
      y: 40,
      width: 200,
      height: 100,
      fills: [solidFill(1, 0, 0)]
    })

    let stats: PPTXExportStats | null = null
    const rasterCalls: string[][] = []
    const data = await renderNodesToPPTX(graph, pageId(graph), [frame.id], {
      rasterize: (ids) => {
        rasterCalls.push(ids)
        return Promise.resolve(TINY_PNG)
      },
      onStats: (value) => {
        stats = value
      }
    })
    expect(data).not.toBeNull()
    if (!data) return
    expect(rasterCalls).toEqual([[frame.id]])
    expect(slideXML(unzipPPTX(data), 1)).not.toContain('FF0000')
    expect(stats).not.toBeNull()
    if (!stats) return
    const reported: PPTXExportStats = stats
    expect(reported.fallbackReasons['clipped content']).toBe(1)
  })

  test('a root frame containing a mask rasterizes as one image', async () => {
    const graph = makeGraph()
    const frame = makeSlideFrame(graph, 'Masked slide')
    graph.createNode('RECTANGLE', frame.id, {
      width: 200,
      height: 200,
      isMask: true,
      fills: [solidFill(0, 0, 0)]
    })
    graph.createNode('RECTANGLE', frame.id, {
      x: 100,
      y: 100,
      width: 300,
      height: 300,
      fills: [solidFill(1, 0, 0)]
    })

    let stats: PPTXExportStats | null = null
    const rasterCalls: string[][] = []
    const data = await renderNodesToPPTX(graph, pageId(graph), [frame.id], {
      rasterize: (ids) => {
        rasterCalls.push(ids)
        return Promise.resolve(TINY_PNG)
      },
      onStats: (value) => {
        stats = value
      }
    })
    expect(data).not.toBeNull()
    if (!data) return
    expect(rasterCalls).toEqual([[frame.id]])
    expect(slideXML(unzipPPTX(data), 1)).not.toContain('FF0000')
    expect(stats).not.toBeNull()
    if (!stats) return
    const reported: PPTXExportStats = stats
    expect(reported.fallbackReasons['contains mask']).toBe(1)
  })

  test('an invisible mask does not flatten an otherwise editable root frame', async () => {
    const graph = makeGraph()
    const frame = makeSlideFrame(graph, 'Slide with hidden mask')
    graph.createNode('RECTANGLE', frame.id, {
      width: 200,
      height: 200,
      isMask: true,
      visible: false,
      fills: [solidFill(0, 0, 0)]
    })
    graph.createNode('RECTANGLE', frame.id, {
      x: 100,
      y: 100,
      width: 300,
      height: 300,
      fills: [solidFill(1, 0, 0)]
    })

    const rasterCalls: string[][] = []
    const data = await renderNodesToPPTX(graph, pageId(graph), [frame.id], {
      rasterize: (ids) => {
        rasterCalls.push(ids)
        return Promise.resolve(TINY_PNG)
      }
    })
    expect(data).not.toBeNull()
    if (!data) return
    expect(rasterCalls).toEqual([])
    expect(slideXML(unzipPPTX(data), 1)).toContain('FF0000')
  })

  test('a clipped frame with an overflowing child rasterizes as one image', async () => {
    const graph = makeGraph()
    const frame = makeSlideFrame(graph, 'Slide')
    const clipped = graph.createNode('FRAME', frame.id, {
      name: 'Clipped',
      x: 100,
      y: 100,
      width: 200,
      height: 200,
      clipsContent: true,
      fills: [solidFill(0, 0, 1)]
    })
    graph.createNode('RECTANGLE', clipped.id, {
      x: 150,
      y: 20,
      width: 200,
      height: 100,
      fills: [solidFill(1, 0, 0)]
    })

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
    // The frame rasterized once, so the cropped part of the child cannot leak
    // back in as a separate native shape.
    expect(rasterCalls).toEqual([[clipped.id]])
    expect(slideXML(unzipPPTX(data), 1)).not.toContain('FF0000')
    expect(stats).not.toBeNull()
    if (!stats) return
    const reported: PPTXExportStats = stats
    expect(reported.fallbackReasons['clipped content']).toBe(1)
  })

  test('a clipped frame whose children fit stays native', async () => {
    const graph = makeGraph()
    const frame = makeSlideFrame(graph, 'Slide')
    const clipped = graph.createNode('FRAME', frame.id, {
      name: 'Clipped',
      x: 100,
      y: 100,
      width: 200,
      height: 200,
      clipsContent: true,
      fills: [solidFill(0, 0, 1)]
    })
    graph.createNode('RECTANGLE', clipped.id, {
      x: 20,
      y: 20,
      width: 100,
      height: 100,
      fills: [solidFill(1, 0, 0)]
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
    const xml = slideXML(unzipPPTX(data), 1)
    expect(xml).toContain('FF0000')
    expect(stats).not.toBeNull()
    if (!stats) return
    const reported: PPTXExportStats = stats
    expect(reported.fallback).toBe(0)
  })

  test('line transparency includes the stroke paint alpha', async () => {
    const graph = makeGraph()
    const frame = makeSlideFrame(graph, 'Slide')
    graph.createNode('LINE', frame.id, {
      x: 40,
      y: 40,
      width: 200,
      height: 2,
      strokes: [solidStroke(1, 0, 0, 0.5)]
    })
    const data = await renderNodesToPPTX(graph, pageId(graph), [frame.id], {
      rasterize: stubRasterize
    })
    expect(data).not.toBeNull()
    if (!data) return
    const xml = slideXML(unzipPPTX(data), 1)
    expect(xml).toContain('FF0000')
    // 50% alpha survives instead of rendering fully opaque.
    expect(xml).toContain('<a:alpha val="50000"/>')
  })

  test('a stroked slide frame becomes a native shape, not an image', async () => {
    const graph = makeGraph()
    const frame = graph.createNode('FRAME', pageId(graph), {
      width: 1280,
      height: 720,
      fills: [solidFill(1, 1, 1)],
      strokes: [solidStroke(0, 0, 0, 1, 4)]
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
    const files = unzipPPTX(data)
    // A slide-sized shape carries the border instead of a flattened image.
    const [border, ...rest] = placements(slideXML(files, 1))
    expect(rest).toHaveLength(0)
    expect(border.width).toBeCloseTo(SLIDE_WIDTH_IN, 2)
    expect(
      Object.keys(files).filter((f) => f.startsWith('ppt/media/') && !f.endsWith('/'))
    ).toHaveLength(0)
    expect(stats).not.toBeNull()
    if (!stats) return
    const reported: PPTXExportStats = stats
    expect(reported.fallback).toBe(0)
  })

  test('a non-solid slide background rasterizes without its children', async () => {
    const graph = makeGraph()
    const frame = graph.createNode('FRAME', pageId(graph), {
      width: 1280,
      height: 720,
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
    graph.createNode('TEXT', frame.id, {
      text: 'On the gradient',
      x: 100,
      y: 100,
      width: 400,
      height: 60,
      fontSize: 32,
      fills: [solidFill(1, 1, 1)]
    })

    const calls: { ids: string[]; paintOnly?: boolean }[] = []
    const data = await renderNodesToPPTX(graph, pageId(graph), [frame.id], {
      rasterize: (ids, _scale, options) => {
        calls.push({ ids, paintOnly: options?.paintOnly })
        return Promise.resolve(TINY_PNG)
      }
    })
    expect(data).not.toBeNull()
    if (!data) return
    // Baking the children into the background image would draw them twice —
    // once flattened, once as the native text added right after.
    expect(calls).toEqual([{ ids: [frame.id], paintOnly: true }])
    expect(slideXML(unzipPPTX(data), 1)).toContain('On the gradient')
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
    const xml = slideXML(unzipPPTX(data), 1)
    expect(xml.toUpperCase()).toContain('336699')
  })

  test('a translucent frame background keeps its alpha', async () => {
    const graph = makeGraph()
    const frame = graph.createNode('FRAME', pageId(graph), {
      width: 1280,
      height: 720,
      fills: [solidFill(0.2, 0.4, 0.6, 0.5)]
    })
    const data = await renderNodesToPPTX(graph, pageId(graph), [frame.id], {
      rasterize: stubRasterize
    })
    expect(data).not.toBeNull()
    if (!data) return
    const xml = slideXML(unzipPPTX(data), 1)
    expect(xml).toContain('<a:alpha val="50000"/>')
  })

  test('document export covers frames on every page', async () => {
    const graph = makeGraph()
    makeSlideFrame(graph, 'Page 1 slide')
    const second = graph.addPage('Page 2')
    graph.createNode('FRAME', second.id, {
      name: 'Page 2 slide',
      width: 1280,
      height: 720,
      fills: [solidFill(1, 1, 1)]
    })

    const pptx = BUILTIN_IO_FORMATS.find((format) => format.id === 'pptx')
    expect(pptx).toBeDefined()
    if (!pptx) return
    const result = await pptx.exportContent(
      { graph, target: { scope: 'document' } },
      { rasterize: stubRasterize }
    )
    const files = unzipPPTX(result.data as Uint8Array)
    expect(files['ppt/slides/slide1.xml']).toBeDefined()
    expect(files['ppt/slides/slide2.xml']).toBeDefined()
  })
})
