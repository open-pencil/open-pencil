import { afterEach, describe, expect, test } from 'bun:test'

import { createEditor } from '@open-pencil/core'
import { SkiaRenderer } from '@open-pencil/core/canvas'
import { initCanvasKit } from '@open-pencil/core/io/formats/raster'
import { fontManager } from '@open-pencil/core/text'
import { vectorNetworkToPath } from '@open-pencil/core/vector'
import type { Effect, SceneNode, Stroke } from '@open-pencil/scene-graph'
import type { Color } from '@open-pencil/scene-graph/primitives'

// Figma's Outline stroke (⇧⌘O), measured live: each stroked layer becomes its fill, "<name>", under
// "<name> (Stroke)", painted with the stroke where it is drawn; both keep the layer's turn,
// opacity, and effects.

const cleanups: (() => void)[] = []

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
  return editor
}

const RED: Color = { r: 1, g: 0, b: 0, a: 1 }
const BLUE: Color = { r: 0, g: 0, b: 1, a: 1 }
const solid = (color: Color) => ({ type: 'SOLID' as const, color, opacity: 1, visible: true })
const stroke = (align: Stroke['align'] = 'INSIDE'): Stroke => ({
  ...solid(RED),
  weight: 4,
  align
})

/** Each selected layer's name, type, box, and fill colours, in layer order. */
function selected(editor: Awaited<ReturnType<typeof createEditorWithRenderer>>) {
  return [...editor.state.selectedIds]
    .map((id) => editor.graph.getNode(id))
    .filter((node): node is SceneNode => node !== undefined)
    .map((node) => ({
      name: node.name,
      type: node.type,
      parent: editor.graph.getNode(node.parentId ?? '')?.type,
      box: [node.x, node.y, node.width, node.height].map((n) => Math.round(n * 100) / 100),
      fills: node.fills.map((fill) => (fill.type === 'SOLID' ? fill.color : null))
    }))
}

describe('outlineStrokeSelected', () => {
  test('replaces a stroked shape with its fill under its stroke, both selected', async () => {
    const editor = await createEditorWithRenderer()
    const pageId = editor.state.currentPageId
    const box = editor.graph.createNode('RECTANGLE', pageId, {
      name: 'Box',
      x: 50,
      y: 50,
      width: 100,
      height: 100,
      fills: [solid(BLUE)],
      strokes: [stroke()]
    })
    editor.select([box.id])
    editor.outlineStrokeSelected()

    expect(editor.graph.getNode(box.id)).toBeUndefined()
    expect(selected(editor)).toEqual([
      { name: 'Box', type: 'VECTOR', parent: 'CANVAS', box: [50, 50, 100, 100], fills: [BLUE] },
      {
        name: 'Box (Stroke)',
        type: 'VECTOR',
        parent: 'CANVAS',
        box: [50, 50, 100, 100],
        fills: [RED]
      }
    ])
    // The fill sits under the stroke, where the shape was.
    const children = editor.graph.getChildren(pageId).map((node) => node.name)
    expect(children).toEqual(['Box', 'Box (Stroke)'])
  })

  test('outlines a stroke where it is drawn: inside, centred, or outside the box', async () => {
    const outlined = async (align: Stroke['align']) => {
      const editor = await createEditorWithRenderer()
      const rect = editor.graph.createNode('RECTANGLE', editor.state.currentPageId, {
        x: 50,
        y: 50,
        width: 100,
        height: 100,
        fills: [],
        strokes: [stroke(align)]
      })
      editor.select([rect.id])
      editor.outlineStrokeSelected()
      return selected(editor).map((layer) => layer.box)
    }
    expect(await outlined('INSIDE')).toEqual([[50, 50, 100, 100]])
    expect(await outlined('CENTER')).toEqual([[48, 48, 104, 104]])
    expect(await outlined('OUTSIDE')).toEqual([[46, 46, 108, 108]])
  })

  test('leaves the shape uncovered by an outside stroke’s outline', async () => {
    const editor = await createEditorWithRenderer()
    const ellipse = editor.graph.createNode('ELLIPSE', editor.state.currentPageId, {
      width: 120,
      height: 70,
      fills: [],
      strokes: [stroke('OUTSIDE')]
    })
    editor.select([ellipse.id])
    editor.outlineStrokeSelected()
    const outline = editor.graph.getNode([...editor.state.selectedIds][0] ?? '')
    const network = outline?.vectorNetwork
    if (!outline || !network) throw new Error('Expected an outline')
    const ck = await initCanvasKit()
    const [path] = vectorNetworkToPath(ck, network)
    // The ellipse's centre and a point on the ring, in the outline's own box.
    expect(path?.contains(60 - outline.x, 35 - outline.y)).toBe(false)
    expect(path?.contains(60 - outline.x, -2 - outline.y)).toBe(true)
    path?.delete()
  })

  test('keeps the layer’s turn, opacity, and effects on both outlines', async () => {
    const editor = await createEditorWithRenderer()
    const shadow: Effect = {
      type: 'DROP_SHADOW',
      color: { r: 0, g: 0, b: 0, a: 0.5 },
      offset: { x: 2, y: 2 },
      radius: 4,
      spread: 0,
      visible: true
    }
    const ellipse = editor.graph.createNode('ELLIPSE', editor.state.currentPageId, {
      name: 'Dot',
      width: 100,
      height: 60,
      rotation: 30,
      opacity: 0.5,
      effects: [shadow],
      fills: [solid(BLUE)],
      strokes: [stroke('OUTSIDE')]
    })
    editor.select([ellipse.id])
    editor.outlineStrokeSelected()
    const [fill, outline] = [...editor.state.selectedIds].map((id) => editor.graph.getNode(id))
    for (const layer of [fill, outline]) {
      expect(layer?.rotation).toBeCloseTo(30)
      expect(layer?.opacity).toBe(0.5)
      expect(layer?.effects).toEqual([shadow])
    }
    // Figma's outline of this stroke is 108 × 68, turned with the ellipse.
    expect([outline?.width ?? 0, outline?.height ?? 0].map(Math.round)).toEqual([108, 68])
  })

  test('outlines each layer of a selection and inside a group or frame in place', async () => {
    const editor = await createEditorWithRenderer()
    const pageId = editor.state.currentPageId
    const loose = editor.graph.createNode('RECTANGLE', pageId, {
      name: 'Loose',
      fills: [],
      strokes: [stroke()]
    })
    const inGroup = editor.graph.createNode('RECTANGLE', pageId, {
      name: 'Grouped',
      fills: [solid(BLUE)],
      strokes: [stroke()]
    })
    editor.select([inGroup.id])
    editor.groupSelected()
    const group = editor.graph.getNode(inGroup.parentId ?? '')
    const frame = editor.graph.createNode('FRAME', pageId, {
      name: 'Card',
      width: 160,
      height: 100,
      fills: [solid(BLUE)],
      strokes: [stroke()]
    })
    editor.graph.createNode('RECTANGLE', frame.id, {
      name: 'Inner',
      fills: [],
      strokes: [stroke()]
    })

    editor.select([loose.id, group?.id ?? '', frame.id])
    editor.outlineStrokeSelected()

    // A stroke-only layer leaves only its stroke; the group stays; the frame keeps its own stroke.
    expect(selected(editor).map((layer) => `${layer.name} in ${layer.parent}`)).toEqual([
      'Loose (Stroke) in CANVAS',
      'Grouped in GROUP',
      'Grouped (Stroke) in GROUP',
      'Inner (Stroke) in FRAME'
    ])
    expect(editor.graph.getNode(frame.id)?.strokes).toHaveLength(1)
  })

  test('turns stroked text into a group of glyph outlines for its fill and its stroke', async () => {
    const inter = await fontManager.fetchBundledFont('/InterVariable.ttf')
    if (!inter) throw new Error('Expected the bundled Inter')
    await fontManager.markLoaded('Inter', 'Regular', inter)
    const editor = await createEditorWithRenderer()
    const text = editor.graph.createNode('TEXT', editor.state.currentPageId, {
      name: 'Hi',
      text: 'Hi',
      fontFamily: 'Inter',
      fontSize: 40,
      width: 40,
      height: 48,
      fills: [solid(BLUE)],
      strokes: [{ ...stroke('CENTER'), weight: 2 }]
    })
    editor.select([text.id])
    editor.outlineStrokeSelected()

    const groups = [...editor.state.selectedIds].map((id) => editor.graph.getNode(id))
    expect(groups.map((group) => [group?.type, group?.name])).toEqual([
      ['GROUP', 'Hi'],
      ['GROUP', 'Hi (Stroke)']
    ])
    const glyphs = groups.map((group) =>
      editor.graph.getChildren(group?.id ?? '').map((glyph) => glyph.name)
    )
    expect(glyphs).toEqual([
      ['Vector', 'Vector'],
      ['Stroke', 'Stroke']
    ])
  })

  test('outlines a boolean’s combined shape, not its box', async () => {
    const editor = await createEditorWithRenderer()
    const pageId = editor.state.currentPageId
    const boolean = editor.graph.createNode('BOOLEAN_OPERATION', pageId, {
      name: 'Overlap',
      booleanOperation: 'INTERSECT',
      width: 150,
      height: 150,
      fills: [solid(BLUE)],
      strokes: [stroke()]
    })
    for (const at of [0, 50]) {
      editor.graph.createNode('RECTANGLE', boolean.id, {
        x: at,
        y: at,
        width: 100,
        height: 100,
        fills: [solid(BLUE)]
      })
    }
    editor.select([boolean.id])
    editor.outlineStrokeSelected()
    // The two squares meet in 50 × 50, which an inside stroke stays within.
    expect(selected(editor).map((layer) => layer.box)).toEqual([
      [50, 50, 50, 50],
      [50, 50, 50, 50]
    ])
  })

  test('fits the group around outlines that reach past the layer, and undo refits it back', async () => {
    const editor = await createEditorWithRenderer()
    const pageId = editor.state.currentPageId
    const rect = editor.graph.createNode('RECTANGLE', pageId, {
      x: 50,
      y: 50,
      width: 100,
      height: 100,
      fills: [],
      strokes: [stroke('OUTSIDE')]
    })
    editor.select([rect.id])
    editor.groupSelected()
    const groupId = rect.parentId ?? ''
    const box = () => {
      const group = editor.graph.getNode(groupId)
      return [group?.x, group?.y, group?.width, group?.height]
    }
    expect(box()).toEqual([50, 50, 100, 100])

    editor.outlineStrokeSelected()
    expect(box()).toEqual([46, 46, 108, 108])

    editor.undo.undo()
    expect(box()).toEqual([50, 50, 100, 100])
    editor.undo.redo()
    expect(box()).toEqual([46, 46, 108, 108])
  })

  test('leaves fill-only shapes alone', async () => {
    const editor = await createEditorWithRenderer()
    const rect = editor.graph.createNode('RECTANGLE', editor.state.currentPageId, {
      fills: [solid(BLUE)],
      strokes: []
    })
    editor.select([rect.id])
    expect(editor.outlineStrokeSelected()).toBeNull()
    expect(editor.graph.getNode(rect.id)?.type).toBe('RECTANGLE')
  })

  test('undo puts the layers back and redo outlines them again', async () => {
    const editor = await createEditorWithRenderer()
    const pageId = editor.state.currentPageId
    const before = editor.graph.createNode('RECTANGLE', pageId, { name: 'Before' })
    const first = editor.graph.createNode('RECTANGLE', pageId, {
      name: 'First',
      fills: [solid(BLUE)],
      strokes: [stroke()]
    })
    const second = editor.graph.createNode('ELLIPSE', pageId, {
      name: 'Second',
      fills: [],
      strokes: [stroke()]
    })
    const after = editor.graph.createNode('RECTANGLE', pageId, { name: 'After' })
    const names = () => editor.graph.getChildren(pageId).map((node) => node.name)

    editor.select([first.id, second.id])
    editor.outlineStrokeSelected()
    const outlined = ['Before', 'First', 'First (Stroke)', 'Second (Stroke)', 'After']
    expect(names()).toEqual(outlined)

    editor.undo.undo()
    expect(editor.graph.getNode(pageId)?.childIds).toEqual([
      before.id,
      first.id,
      second.id,
      after.id
    ])
    expect(editor.state.selectedIds).toEqual(new Set([first.id, second.id]))

    editor.undo.redo()
    expect(names()).toEqual(outlined)
  })
})
