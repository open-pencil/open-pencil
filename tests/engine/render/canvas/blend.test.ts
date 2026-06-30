import { describe, expect, mock, test } from 'bun:test'

import type { Canvas } from 'canvaskit-wasm'

import { SceneGraph } from '@open-pencil/scene-graph'
import type { BlendMode, Fill, SceneNode } from '@open-pencil/scene-graph'

import { figmaBlendModeToSkia } from '#core/canvas/blend'
import type { SkiaRenderer } from '#core/canvas/renderer'
import { renderNode, renderSection } from '#core/canvas/scene'

function pageId(graph: SceneGraph) {
  return graph.getPages()[0].id
}

const blendModes = {
  SrcOver: 'SrcOver',
  Darken: 'Darken',
  Multiply: 'Multiply',
  ColorBurn: 'ColorBurn',
  Lighten: 'Lighten',
  Screen: 'Screen',
  ColorDodge: 'ColorDodge',
  Overlay: 'Overlay',
  SoftLight: 'SoftLight',
  HardLight: 'HardLight',
  Difference: 'Difference',
  Exclusion: 'Exclusion',
  Hue: 'Hue',
  Saturation: 'Saturation',
  Color: 'Color',
  Luminosity: 'Luminosity'
}

function createCanvas() {
  return {
    save: mock(() => undefined),
    restore: mock(() => undefined),
    translate: mock(() => undefined),
    saveLayer: mock(() => undefined),
    drawRRect: mock(() => undefined)
  }
}

function createRenderer(overrides: Partial<SkiaRenderer> = {}) {
  return {
    _nodeCount: 0,
    _culledCount: 0,
    worldViewport: { x: -100, y: -100, w: 1000, h: 1000 },
    ck: {
      BlendMode: blendModes,
      LTRBRect: mock(() => new Float32Array(4)),
      RRectXY: mock(() => new Float32Array(12))
    },
    opacityPaint: {
      setAlphaf: mock(() => undefined),
      setBlendMode: mock(() => undefined)
    },
    effectLayerPaint: {
      setImageFilter: mock(() => undefined),
      setColorFilter: mock(() => undefined),
      setBlendMode: mock(() => undefined)
    },
    fillPaint: {
      setAlphaf: mock(() => undefined),
      setBlendMode: mock(() => undefined),
      setShader: mock(() => undefined)
    },
    getCachedBlur: mock(() => null),
    applyFill: mock(() => true),
    makeRRect: mock(() => new Float32Array(12)),
    renderShape: mock(() => undefined),
    renderSection: mock(() => undefined),
    renderComponentSet: mock(() => undefined),
    renderNode(canvas, graph, nodeId, overlays, parentAbsX, parentAbsY) {
      renderNode(this as SkiaRenderer, canvas, graph, nodeId, overlays, parentAbsX, parentAbsY)
    },
    ...overrides
  } as SkiaRenderer
}

function calls(fn: ReturnType<typeof mock>): unknown[][] {
  return (fn as { mock: { calls: unknown[][] } }).mock.calls
}

describe('canvas blend modes', () => {
  test('maps Figma blend modes to CanvasKit blend modes', () => {
    const ck = { BlendMode: blendModes } as SkiaRenderer['ck']
    const cases: Array<[BlendMode, string]> = [
      ['NORMAL', 'SrcOver'],
      ['PASS_THROUGH', 'SrcOver'],
      ['DARKEN', 'Darken'],
      ['MULTIPLY', 'Multiply'],
      ['COLOR_BURN', 'ColorBurn'],
      ['LIGHTEN', 'Lighten'],
      ['SCREEN', 'Screen'],
      ['COLOR_DODGE', 'ColorDodge'],
      ['OVERLAY', 'Overlay'],
      ['SOFT_LIGHT', 'SoftLight'],
      ['HARD_LIGHT', 'HardLight'],
      ['DIFFERENCE', 'Difference'],
      ['EXCLUSION', 'Exclusion'],
      ['HUE', 'Hue'],
      ['SATURATION', 'Saturation'],
      ['COLOR', 'Color'],
      ['LUMINOSITY', 'Luminosity']
    ]

    for (const [figmaMode, skiaMode] of cases) {
      expect(figmaBlendModeToSkia(ck, figmaMode)).toBe(skiaMode)
    }
  })

  test('isolates node content when node blend mode needs compositing', () => {
    const graph = new SceneGraph()
    const node = graph.createNode('RECTANGLE', pageId(graph), {
      width: 100,
      height: 100,
      blendMode: 'MULTIPLY'
    })
    const renderer = createRenderer()
    const canvas = createCanvas()

    renderNode(renderer, canvas as Canvas, graph, node.id, {})

    expect(renderer.opacityPaint.setAlphaf).toHaveBeenCalledWith(1)
    expect(renderer.opacityPaint.setBlendMode).toHaveBeenCalledWith('Multiply')
    expect(canvas.saveLayer).toHaveBeenCalledWith(renderer.opacityPaint, expect.any(Float32Array))
    expect(renderer.ck.LTRBRect).toHaveBeenCalledWith(0, 0, 100, 100)
    expect(renderer.renderShape).toHaveBeenCalled()
    expect(renderer.opacityPaint.setBlendMode).toHaveBeenLastCalledWith('SrcOver')
  })

  test('applies fill blend modes per fill and resets shared paint', () => {
    const graph = new SceneGraph()
    const fill: Fill = {
      type: 'SOLID',
      color: { r: 1, g: 0, b: 0, a: 1 },
      opacity: 1,
      visible: true,
      blendMode: 'SCREEN'
    }
    const node = graph.createNode('SECTION', pageId(graph), {
      width: 100,
      height: 100,
      fills: [fill]
    }) as Extract<SceneNode, { type: 'SECTION' }>
    const renderer = createRenderer()
    const canvas = createCanvas()

    renderSection(renderer, canvas as Canvas, node, graph)

    expect(calls(renderer.fillPaint.setBlendMode as ReturnType<typeof mock>)).toEqual([
      ['Screen'],
      ['SrcOver']
    ])
  })
})
