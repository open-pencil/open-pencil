import { afterAll, beforeAll, describe, expect, test } from 'bun:test'

import { expectDefined, getNodeOrThrow } from '#core-tests/helpers/assert'
import type { CanvasKit } from 'canvaskit-wasm'

import type { Fill, SceneNode } from '@open-pencil/scene-graph'
import type { Color } from '@open-pencil/scene-graph/primitives'

import { SkiaRenderer } from '#core/canvas/renderer'
import { createEditor } from '#core/editor/create'
import { applySampledColor, eyedropperChanges, sampleSceneColor } from '#core/editor/eyedropper'
import { TOOL_SHORTCUTS } from '#core/editor/tool-registry'
import { getPageColor } from '#core/figma-api/page-backgrounds'
import { initCanvasKit } from '#core/io/formats/raster/headless'

function solid(color: Color): Fill {
  return { type: 'SOLID', color, opacity: 1, visible: true }
}

const RED = { r: 1, g: 0, b: 0, a: 1 }
const GREEN = { r: 0, g: 1, b: 0, a: 1 }
const BLUE = { r: 0, g: 0, b: 1, a: 1 }
const WHITE = { r: 1, g: 1, b: 1, a: 1 }

describe('sampleSceneColor', () => {
  let ck: CanvasKit
  let renderer: SkiaRenderer

  beforeAll(async () => {
    ck = await initCanvasKit()
    renderer = new SkiaRenderer(ck, expectDefined(ck.MakeSurface(1, 1)))
  })
  afterAll(() => renderer.destroy())

  function scene() {
    const editor = createEditor()
    const pageId = editor.graph.getPages()[0].id
    const cells: Array<[number, number, Color]> = [
      [0, 0, RED],
      [1, 0, GREEN],
      [0, 1, BLUE],
      [1, 1, WHITE]
    ]
    for (const [x, y, color] of cells) {
      editor.graph.createNode('RECTANGLE', pageId, {
        x,
        y,
        width: 1,
        height: 1,
        fills: [solid(color)]
      })
    }
    return { graph: editor.graph, pageId }
  }

  function bytes(color: Color | null) {
    const c = expectDefined(color)
    return [c.r, c.g, c.b, c.a].map((v) => Math.round(v * 255))
  }

  test('reads the exact RGBA of each pixel of a rendered 2x2 scene', () => {
    const { graph, pageId } = scene()
    expect(bytes(sampleSceneColor(ck, renderer, graph, pageId, 0.5, 0.5))).toEqual([255, 0, 0, 255])
    expect(bytes(sampleSceneColor(ck, renderer, graph, pageId, 1.5, 0.5))).toEqual([0, 255, 0, 255])
    expect(bytes(sampleSceneColor(ck, renderer, graph, pageId, 0.5, 1.5))).toEqual([0, 0, 255, 255])
    expect(bytes(sampleSceneColor(ck, renderer, graph, pageId, 1.5, 1.5))).toEqual([
      255, 255, 255, 255
    ])
  })

  test('outside every layer it returns the page background', () => {
    const { graph, pageId } = scene()
    const background = getPageColor(getNodeOrThrow(graph, pageId))
    expect(bytes(sampleSceneColor(ck, renderer, graph, pageId, 50, 50))).toEqual(
      bytes({ ...background, a: 1 })
    )
  })

  test('composites translucent layers over what is below', () => {
    const { graph, pageId } = scene()
    graph.createNode('RECTANGLE', pageId, {
      x: 0,
      y: 0,
      width: 1,
      height: 1,
      fills: [{ ...solid(BLUE), opacity: 0.5 }]
    })
    const [r, g, b] = bytes(sampleSceneColor(ck, renderer, graph, pageId, 0.5, 0.5))
    expect(Math.abs(r - 128)).toBeLessThanOrEqual(1)
    expect(g).toBe(0)
    expect(Math.abs(b - 128)).toBeLessThanOrEqual(1)
  })

  test('restores the renderer viewport it borrowed', () => {
    const { graph, pageId } = scene()
    renderer.worldViewport = { x: 10, y: 20, w: 30, h: 40 }
    sampleSceneColor(ck, renderer, graph, pageId, 0.5, 0.5)
    expect(renderer.worldViewport).toEqual({ x: 10, y: 20, w: 30, h: 40 })
  })

  test('rejects non-finite points and unknown pages', () => {
    const { graph, pageId } = scene()
    expect(sampleSceneColor(ck, renderer, graph, pageId, Number.NaN, 0)).toBeNull()
    expect(sampleSceneColor(ck, renderer, graph, 'missing', 0, 0)).toBeNull()
  })
})

describe('applySampledColor', () => {
  function setup(overrides: Partial<SceneNode> = {}) {
    const editor = createEditor()
    const pageId = editor.graph.getPages()[0].id
    const rect = editor.graph.createNode('RECTANGLE', pageId, {
      width: 10,
      height: 10,
      fills: [solid(BLUE)],
      ...overrides
    })
    editor.select([rect.id])
    return { editor, rect }
  }

  test('replaces the top solid fill and undo reverts in one step', () => {
    const { editor, rect } = setup()
    expect(applySampledColor(editor, RED)).toBe(1)
    expect(getNodeOrThrow(editor.graph, rect.id).fills[0].color).toEqual(RED)
    editor.undoAction()
    expect(getNodeOrThrow(editor.graph, rect.id).fills[0].color).toEqual(BLUE)
  })

  test('keeps the fill opacity and drops a colour variable binding', () => {
    const { editor, rect } = setup({
      fills: [{ ...solid(BLUE), opacity: 0.4 }],
      boundVariables: { 'fills/0/color': 'VariableID:1:2' }
    })
    applySampledColor(editor, RED)
    const node = getNodeOrThrow(editor.graph, rect.id)
    expect(node.fills[0].opacity).toBe(0.4)
    expect(node.boundVariables['fills/0/color']).toBeUndefined()
  })

  test('adds a solid fill above a gradient', () => {
    const { editor, rect } = setup({
      fills: [{ ...solid(BLUE), type: 'GRADIENT_LINEAR', gradientStops: [] }]
    })
    applySampledColor(editor, GREEN)
    const fills = getNodeOrThrow(editor.graph, rect.id).fills
    expect(fills).toHaveLength(2)
    expect(fills[1]).toMatchObject({ type: 'SOLID', color: GREEN })
  })

  test('Alt target paints the stroke, adding one when there is none', () => {
    const { editor, rect } = setup()
    applySampledColor(editor, RED, 'stroke')
    const node = getNodeOrThrow(editor.graph, rect.id)
    expect(node.strokes).toHaveLength(1)
    expect(node.strokes[0]).toMatchObject({ type: 'SOLID', color: RED, weight: 1 })
    expect(node.fills[0].color).toEqual(BLUE)
  })

  test('text drops per-character fills so the whole text takes the colour', () => {
    const editor = createEditor()
    const pageId = editor.graph.getPages()[0].id
    const text = editor.graph.createNode('TEXT', pageId, {
      text: 'Hello',
      fills: [solid(BLUE)],
      styleRuns: [{ start: 0, length: 2, style: { fills: [solid(GREEN)], fontWeight: 700 } }]
    })
    const changes = eyedropperChanges(text, RED, 'fill')
    expect(changes.styleRuns?.[0].style).toEqual({ fontWeight: 700 })
    expect(changes.fills?.[0].color).toEqual(RED)
  })

  test('does nothing without a selection', () => {
    const { editor } = setup()
    editor.clearSelection()
    expect(applySampledColor(editor, RED)).toBe(0)
  })
})

describe('tool registry', () => {
  test('I selects the eyedropper and no other key does', () => {
    const keys = Object.entries(TOOL_SHORTCUTS)
      .filter(([, tool]) => tool === 'EYEDROPPER')
      .map(([key]) => key)
    expect(keys).toEqual(['KeyI'])
  })
})
