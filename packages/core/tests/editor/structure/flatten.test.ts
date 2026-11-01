import { afterEach, describe, expect, test } from 'bun:test'

import { createEditor } from '@open-pencil/core'
import { SkiaRenderer } from '@open-pencil/core/canvas'
import { BLACK, TRANSPARENT } from '@open-pencil/core/constants'
import { initCanvasKit } from '@open-pencil/core/io/formats/raster'
import { fontManager } from '@open-pencil/core/text'
import { vectorNetworkToPath } from '@open-pencil/core/vector'
import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'

import { textNodeToOutlineLayout } from '#core/text/outlines'

const cleanups: (() => void)[] = []

// A renderer installs the shared layout text measurer until its editor is disposed; left
// installed, it measures text in later files without their fonts.
afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup()
})

async function createEditorWithRenderer() {
  const ck = await initCanvasKit()
  const surface = ck.MakeSurface(200, 200)
  if (!surface) throw new Error('Could not create CanvasKit surface')
  const renderer = new SkiaRenderer(ck, surface)
  const editor = createEditor()
  editor.setCanvasKit(ck, renderer)
  cleanups.push(() => {
    editor.dispose()
    renderer.destroy()
  })
  return { editor, renderer }
}

async function loadInterRegular() {
  const data = await Bun.file('packages/core/assets/InterVariable.ttf').arrayBuffer()
  await fontManager.markLoaded('Inter', 'Regular', data)
}

async function loadInterBold() {
  const data = await Bun.file('packages/core/assets/InterVariable.ttf').arrayBuffer()
  await fontManager.markLoaded('Inter', 'Bold', data)
}

async function loadNotoSansSC() {
  const file = Bun.file('tests/fixtures/fonts/NotoSansSC-Regular.ttf')
  const text = await file.slice(0, 32).text()
  if (text.startsWith('version ')) return false
  const data = await file.arrayBuffer()
  await fontManager.markLoaded('Noto Sans SC', 'Regular', data)
  fontManager.setCJKFallbackFamily('Noto Sans SC')
  return true
}

describe('flattenSelected', () => {
  test('converts selected shapes into a vector path', async () => {
    const { editor } = await createEditorWithRenderer()
    const pageId = editor.state.currentPageId
    const first = editor.graph.createNode('RECTANGLE', pageId, {
      x: 10,
      y: 20,
      width: 50,
      height: 40
    })
    const second = editor.graph.createNode('ELLIPSE', pageId, {
      x: 40,
      y: 30,
      width: 50,
      height: 40
    })

    editor.select([first.id, second.id])
    editor.flattenSelected()

    const [vectorId] = [...editor.state.selectedIds]
    const vector = editor.graph.getNode(vectorId)
    expect(vector?.type).toBe('VECTOR')
    expect(vector?.x).toBe(10)
    expect(vector?.y).toBe(20)
    expect(vector?.width).toBe(80)
    expect(vector?.height).toBe(50)
    expect(vector?.vectorNetwork?.vertices.length).toBeGreaterThan(0)
    expect(editor.graph.getNode(first.id)).toBeUndefined()
    expect(editor.graph.getNode(second.id)).toBeUndefined()
  })

  // The shape only: Figma keeps each layer's fill on its own region, which needs region fills.
  test("shapes a flattened frame by its children, leaving the frame's own area out", async () => {
    const { editor } = await createEditorWithRenderer()
    const pageId = editor.state.currentPageId
    const solid = { type: 'SOLID' as const, color: BLACK, opacity: 1, visible: true }
    const frame = editor.graph.createNode('FRAME', pageId, {
      x: 20,
      y: 20,
      width: 40,
      height: 40,
      fills: [solid],
      strokes: [{ ...solid, weight: 4, align: 'INSIDE' as const }]
    })
    editor.graph.createNode('RECTANGLE', frame.id, { x: 30, y: 2, width: 8, height: 8 })

    editor.select([frame.id])
    editor.flattenSelected()

    const vector = editor.graph.getNode([...editor.state.selectedIds][0])
    expect([vector?.x, vector?.y, vector?.width, vector?.height]).toEqual([50, 22, 8, 8])
  })

  // Figma keeps a flattened layer's stroke a stroke: the shape is the ellipse alone.
  test('keeps an outside stroke a stroke, around the bare shape', async () => {
    const { editor } = await createEditorWithRenderer()
    const solid = { type: 'SOLID' as const, color: BLACK, opacity: 1, visible: true }
    const ellipse = editor.graph.createNode('ELLIPSE', editor.state.currentPageId, {
      width: 120,
      height: 70,
      fills: [{ ...solid, visible: false }],
      strokes: [{ ...solid, weight: 4, align: 'OUTSIDE' as const }],
      strokeWeight: 4,
      strokeAlign: 'OUTSIDE'
    })

    editor.select([ellipse.id])
    editor.flattenSelected()

    const vector = editor.graph.getNode([...editor.state.selectedIds][0])
    const network = vector?.vectorNetwork
    if (!vector || !network) throw new Error('Expected a flattened vector')
    expect([vector.x, vector.y, vector.width, vector.height]).toEqual([0, 0, 120, 70])
    expect([vector.strokeWeight, vector.strokeAlign, vector.strokes.length]).toEqual([4, 'OUTSIDE', 1])
    expect(vector.fills.map((fill) => fill.visible)).toEqual([false])
    const [path] = vectorNetworkToPath(await initCanvasKit(), network)
    expect(path?.contains(60, 35)).toBe(true)
    expect(path?.contains(60, -2)).toBe(false)
    path?.delete()
  })

  test('outlines loaded text through the shared text outline path', async () => {
    await loadInterRegular()
    const { editor } = await createEditorWithRenderer()
    const pageId = editor.state.currentPageId
    const text = editor.graph.createNode('TEXT', pageId, {
      text: 'Hi',
      fontFamily: 'Inter',
      fontWeight: 400,
      fontSize: 32,
      width: 80,
      height: 40
    })

    editor.select([text.id])
    editor.outlineTextSelected()

    const [vectorId] = [...editor.state.selectedIds]
    const vector = editor.graph.getNode(vectorId)
    expect(vector?.type).toBe('VECTOR')
    expect(vector?.name).toBe('Outline text')
    expect(vector?.vectorNetwork?.vertices.length).toBeGreaterThan(0)
    expect(editor.graph.getNode(text.id)).toBeUndefined()
  })

  test('flattens loaded text as outlines', async () => {
    await loadInterRegular()
    const { editor } = await createEditorWithRenderer()
    const pageId = editor.state.currentPageId
    const text = editor.graph.createNode('TEXT', pageId, {
      text: 'Hi',
      fontFamily: 'Inter',
      fontWeight: 400,
      fontSize: 32,
      width: 80,
      height: 40
    })

    editor.select([text.id])
    editor.flattenSelected()

    const [vectorId] = [...editor.state.selectedIds]
    const vector = editor.graph.getNode(vectorId)
    expect(vector?.type).toBe('VECTOR')
    expect(vector?.vectorNetwork?.vertices.length).toBeGreaterThan(0)
    expect(editor.graph.getNode(text.id)).toBeUndefined()
  })

  // Saved glyphs draw a decoration on one baseline; outlines carry none, so lines don't matter.
  test.each(['NONE', 'UNDERLINE'] as const)(
    'flattens a list with its bullets, as the canvas draws it (%s)',
    async (textDecoration) => {
      await loadInterRegular()
      const { editor, renderer } = await createEditorWithRenderer()
      await renderer.loadFonts()
      const pageId = editor.state.currentPageId
      const text = editor.graph.createNode('TEXT', pageId, {
        x: 100,
        text: 'One\nTwo',
        fontFamily: 'Inter',
        fontWeight: 400,
        fontSize: 16,
        width: 120,
        height: 40,
        textDecoration,
        textParagraphs: [
          { listType: 'UNORDERED', indentation: 1 },
          { listType: 'UNORDERED', indentation: 1 }
        ]
      })

      editor.select([text.id])
      editor.flattenSelected()

      const [vectorId] = [...editor.state.selectedIds]
      const vector = editor.graph.getNode(vectorId)
      // The bullets sit in the first 24px of indent, left of the items' text.
      expect(vector?.x).toBeGreaterThan(106)
      expect(vector?.x).toBeLessThan(112)
    }
  )

  test('wraps loaded text style runs as outlines', async () => {
    await loadInterRegular()
    await loadInterBold()
    const editor = createEditor()
    const pageId = editor.state.currentPageId
    const text = editor.graph.createNode('TEXT', pageId, {
      text: 'Hello world',
      fontFamily: 'Inter',
      fontWeight: 400,
      fontSize: 32,
      width: 100,
      height: 100,
      styleRuns: [{ start: 6, length: 5, style: { fontWeight: 700 } }]
    })

    const layout = textNodeToOutlineLayout(text)

    expect(layout).not.toBeNull()
    expect(layout?.height).toBeGreaterThan(40)
  })

  test('flattens loaded text style runs as outlines', async () => {
    await loadInterRegular()
    await loadInterBold()
    const { editor } = await createEditorWithRenderer()
    const pageId = editor.state.currentPageId
    const text = editor.graph.createNode('TEXT', pageId, {
      text: 'Hi',
      fontFamily: 'Inter',
      fontWeight: 400,
      fontSize: 32,
      width: 80,
      height: 40,
      styleRuns: [{ start: 1, length: 1, style: { fontWeight: 700, fontSize: 40 } }]
    })

    editor.select([text.id])
    editor.flattenSelected()

    const [vectorId] = [...editor.state.selectedIds]
    const vector = editor.graph.getNode(vectorId)
    expect(vector?.type).toBe('VECTOR')
    expect(vector?.vectorNetwork?.vertices.length).toBeGreaterThan(0)
  })

  test('flattens mixed Latin and CJK text with loaded fallback outlines', async () => {
    await loadInterRegular()
    const hasCJKFallback = await loadNotoSansSC()
    if (!hasCJKFallback) return
    const { editor } = await createEditorWithRenderer()
    const pageId = editor.state.currentPageId
    const text = editor.graph.createNode('TEXT', pageId, {
      text: 'Hi你',
      fontFamily: 'Inter',
      fontWeight: 400,
      fontSize: 32,
      width: 120,
      height: 40
    })

    editor.select([text.id])
    editor.flattenSelected()

    const [vectorId] = [...editor.state.selectedIds]
    const vector = editor.graph.getNode(vectorId)
    expect(vector?.type).toBe('VECTOR')
    expect(vector?.vectorNetwork?.vertices.length).toBeGreaterThan(0)
  })

  test('does not flatten complex script text without shaping support', async () => {
    await loadInterRegular()
    const { editor } = await createEditorWithRenderer()
    const pageId = editor.state.currentPageId
    const text = editor.graph.createNode('TEXT', pageId, {
      text: 'مرحبا',
      fontFamily: 'Inter',
      fontWeight: 400,
      fontSize: 32,
      width: 120,
      height: 40
    })

    editor.select([text.id])
    const result = editor.flattenSelected()

    expect(result).toBeNull()
    expect(editor.graph.getNode(text.id)?.type).toBe('TEXT')
  })

  test('does not flatten unsupported text nodes', async () => {
    const { editor } = await createEditorWithRenderer()
    const pageId = editor.state.currentPageId
    const text = editor.graph.createNode('TEXT', pageId, {
      text: 'Nope',
      fontFamily: 'Definitely Missing Font'
    })
    const rect = editor.graph.createNode('RECTANGLE', pageId)

    editor.select([text.id, rect.id])
    const result = editor.flattenSelected()

    expect(result).toBeNull()
    expect(editor.graph.getNode(pageId)?.childIds).toEqual([text.id, rect.id])
    expect(editor.state.selectedIds).toEqual(new Set([text.id, rect.id]))
  })

  test('does not flatten containers with unsupported descendants', async () => {
    const { editor } = await createEditorWithRenderer()
    const pageId = editor.state.currentPageId
    const rect = editor.graph.createNode('RECTANGLE', pageId)
    const image = editor.graph.createNode('RECTANGLE', pageId, {
      fills: [
        {
          type: 'IMAGE',
          imageHash: 'image',
          imageScaleMode: 'FILL',
          color: TRANSPARENT,
          opacity: 1,
          visible: true
        }
      ]
    })
    editor.select([rect.id, image.id])
    editor.groupSelected()
    const [groupId] = [...editor.state.selectedIds]

    const result = editor.flattenSelected()

    expect(result).toBeNull()
    expect(editor.graph.getNode(groupId)?.type).toBe('GROUP')
  })

  test('flattens visual descendants from groups', async () => {
    const { editor } = await createEditorWithRenderer()
    const pageId = editor.state.currentPageId
    const rect = editor.graph.createNode('RECTANGLE', pageId, {
      x: 10,
      y: 20,
      width: 50,
      height: 40
    })
    const ellipse = editor.graph.createNode('ELLIPSE', pageId, {
      x: 70,
      y: 20,
      width: 30,
      height: 30
    })
    editor.select([rect.id, ellipse.id])
    editor.groupSelected()
    const [groupId] = [...editor.state.selectedIds]

    editor.flattenSelected()

    const [vectorId] = [...editor.state.selectedIds]
    const vector = editor.graph.getNode(vectorId)
    expect(vector?.type).toBe('VECTOR')
    expect(vector?.vectorNetwork?.vertices.length).toBeGreaterThan(0)
    expect(editor.graph.getNode(groupId)).toBeUndefined()
  })

  test('flattens a stroke-only rectangle to its outline, its stroke kept a stroke', async () => {
    const { editor } = await createEditorWithRenderer()
    const pageId = editor.state.currentPageId
    const rect = editor.graph.createNode('RECTANGLE', pageId, {
      x: 10,
      y: 20,
      width: 50,
      height: 40,
      fills: [],
      strokes: [
        { type: 'SOLID', color: BLACK, opacity: 1, visible: true, weight: 8, align: 'CENTER' }
      ]
    })

    editor.select([rect.id])
    editor.flattenSelected()

    const [vectorId] = [...editor.state.selectedIds]
    const vector = editor.graph.getNode(vectorId)
    expect(vector?.type).toBe('VECTOR')
    expect([vector?.width, vector?.height]).toEqual([50, 40])
    expect(vector?.strokes.map((stroke) => stroke.weight)).toEqual([8])
  })

  // Live-verified in Figma: each shape fills its own regions, stacked in layer order whatever
  // the selection's; the vector takes the topmost shape's stroke.
  describe("as Figma's Flatten", () => {
    const paint = (r: number, g: number, b: number) => ({
      type: 'SOLID' as const,
      color: { r, g, b, a: 1 },
      opacity: 1,
      visible: true
    })
    const RED = paint(1, 0, 0)
    const BLUE = paint(0, 0, 1)
    const regionColors = (vector: SceneNode | undefined) =>
      vector?.vectorNetwork?.regions.map((region) => region.fills?.map((fill) => fill.color))

    async function flattened(build: (graph: SceneGraph, pageId: string) => SceneNode[]) {
      const { editor } = await createEditorWithRenderer()
      editor.select(build(editor.graph, editor.state.currentPageId).map((node) => node.id))
      editor.flattenSelected()
      return editor.graph.getNode([...editor.state.selectedIds][0])
    }

    test("fills each shape's region with its fills and takes the top shape's stroke", async () => {
      const vector = await flattened((graph, pageId) => {
        const red = graph.createNode('RECTANGLE', pageId, {
          width: 20,
          height: 20,
          fills: [RED],
          strokes: [{ ...paint(1, 1, 0), weight: 2, align: 'CENTER' }],
          strokeWeight: 2
        })
        const blue = graph.createNode('RECTANGLE', pageId, {
          x: 40,
          width: 20,
          height: 20,
          fills: [BLUE],
          strokes: [{ ...paint(0, 1, 1), weight: 6, align: 'OUTSIDE' }],
          strokeWeight: 6,
          strokeAlign: 'OUTSIDE'
        })
        return [blue, red]
      })
      expect(regionColors(vector)).toEqual([[RED.color], [BLUE.color]])
      expect(vector?.strokes.map((stroke) => stroke.color)).toEqual([paint(0, 1, 1).color])
      expect([vector?.strokeWeight, vector?.strokeAlign]).toEqual([6, 'OUTSIDE'])
    })

    test('leaves the regions to the layer fill when every shape fills alike', async () => {
      const vector = await flattened((graph, pageId) => [
        graph.createNode('RECTANGLE', pageId, { width: 20, height: 20, fills: [RED] }),
        graph.createNode('RECTANGLE', pageId, { x: 40, width: 20, height: 20, fills: [RED] })
      ])
      expect(regionColors(vector)).toEqual([undefined, undefined])
      expect(vector?.fills.map((fill) => fill.color)).toEqual([RED.color])
    })

    test("takes a frame's shapes with their fills, never the frames' own", async () => {
      const vector = await flattened((graph, pageId) => {
        const frame = graph.createNode('FRAME', pageId, { width: 80, height: 60, fills: [paint(0, 1, 0)] })
        const inner = graph.createNode('FRAME', frame.id, { width: 40, height: 40, fills: [paint(1, 1, 0)] })
        graph.createNode('RECTANGLE', inner.id, { width: 20, height: 20, fills: [RED] })
        graph.createNode('RECTANGLE', frame.id, { x: 50, width: 20, height: 20, fills: [BLUE] })
        return [frame]
      })
      expect(regionColors(vector)).toEqual([[RED.color], [BLUE.color]])
    })

    // Figma: a 40 px line at (50, 20) with an 8 px stroke flattens to the segment its stroke is
    // drawn along, half a weight up, and inside a round cap: (54, 16), 32 long.
    test.each([
      ['NONE', 50, 40],
      ['ROUND', 54, 32]
    ] as const)('keeps a line where its %s-capped stroke lay', async (cap, x, width) => {
      const vector = await flattened((graph, pageId) => [
        graph.createNode('LINE', pageId, {
          x: 50,
          y: 20,
          width: 40,
          height: 0,
          strokes: [{ ...RED, weight: 8, align: 'CENTER', cap }],
          strokeWeight: 8,
          strokeCap: cap
        })
      ])
      expect([vector?.x, vector?.y, vector?.width, vector?.height]).toEqual([x, 16, width, 0])
    })

    test('keeps a line that runs down its height', async () => {
      const vector = await flattened((graph, pageId) => [
        graph.createNode('LINE', pageId, {
          width: 0,
          height: 40,
          strokes: [{ ...RED, weight: 2, align: 'CENTER' }]
        })
      ])
      expect(vector?.type).toBe('VECTOR')
      expect([vector?.width, vector?.height]).toEqual([0, 40])
      expect(vector?.vectorNetwork?.segments).toHaveLength(1)
    })

    // Figma insets each end by half the weight even past the middle: a 6 px line under an 8 px
    // round cap flattens to a 2 px segment from x 54 back to 52.
    test('reverses a round-capped line shorter than its weight, as Figma does', async () => {
      const vector = await flattened((graph, pageId) => [
        graph.createNode('LINE', pageId, {
          x: 50,
          y: 20,
          width: 6,
          height: 0,
          strokes: [{ ...RED, weight: 8, align: 'CENTER', cap: 'ROUND' }],
          strokeWeight: 8,
          strokeCap: 'ROUND'
        })
      ])
      expect([vector?.x, vector?.y, vector?.width, vector?.height]).toEqual([52, 16, 2, 0])
      expect(vector?.vectorNetwork?.vertices.map(({ x, y }) => [x, y])).toEqual([
        [2, 0],
        [0, 0]
      ])
      expect(vector?.strokeCap).toBe('ROUND')
    })

    test("keeps a line as an open segment, under the top shape's stroke", async () => {
      const vector = await flattened((graph, pageId) => [
        graph.createNode('LINE', pageId, {
          width: 40,
          height: 0,
          strokes: [{ ...RED, weight: 4, align: 'CENTER' }],
          strokeWeight: 4
        }),
        graph.createNode('RECTANGLE', pageId, { x: 60, width: 20, height: 20, fills: [BLUE] })
      ])
      expect(vector?.vectorNetwork?.regions).toHaveLength(1)
      expect(vector?.vectorNetwork?.segments).toHaveLength(5)
      expect(vector?.fills.map((fill) => fill.color)).toEqual([BLUE.color])
      expect(vector?.strokes).toEqual([])
    })
  })

  test('undo and redo restore flattened children and vector', async () => {
    const { editor } = await createEditorWithRenderer()
    const pageId = editor.state.currentPageId
    const before = editor.graph.createNode('RECTANGLE', pageId, { name: 'Before' })
    const first = editor.graph.createNode('RECTANGLE', pageId, { name: 'First' })
    const second = editor.graph.createNode('ELLIPSE', pageId, { name: 'Second', x: 50 })
    const after = editor.graph.createNode('RECTANGLE', pageId, { name: 'After' })

    editor.select([first.id, second.id])
    editor.flattenSelected()
    const [vectorId] = [...editor.state.selectedIds]
    expect(editor.graph.getNode(pageId)?.childIds).toEqual([before.id, vectorId, after.id])

    editor.undo.undo()
    expect(editor.graph.getNode(pageId)?.childIds).toEqual([
      before.id,
      first.id,
      second.id,
      after.id
    ])
    expect(editor.state.selectedIds).toEqual(new Set([first.id, second.id]))

    editor.undo.redo()
    expect(editor.graph.getNode(pageId)?.childIds).toEqual([before.id, vectorId, after.id])
    expect(editor.graph.getNode(vectorId)?.type).toBe('VECTOR')
  })
})
