import { describe, expect, mock, test } from 'bun:test'

import { asCanvas, asDouble } from '#core-tests/canvas/helpers'

import type { ImageFilter } from '@open-pencil/canvaskit'
import { type Effect, SceneGraph } from '@open-pencil/scene-graph'
import { blurReach } from '@open-pencil/scene-graph/geometry'
import { createDefaultSourceMetadata } from '@open-pencil/scene-graph/node-defaults'
import { expectDefined } from '@open-pencil/test-support/assert'

import { applyClippedBlur } from '#core/canvas/effects'
import { renderNode } from '#core/canvas/scene'
import { renderEffects } from '#core/canvas/shadows/render'

import {
  createMockCanvas,
  createMockRenderer,
  effectNode,
  mockCalls,
  OPAQUE_FILL,
  TEST_GRAPH
} from './helpers'

describe('Renderer handles all effect types (Behavioral)', () => {
  test('handles DROP_SHADOW', () => {
    const r = createMockRenderer()
    const canvas = createMockCanvas()
    const node = effectNode({
      type: 'RECTANGLE',
      width: 100,
      height: 100,
      fills: [OPAQUE_FILL],
      childIds: [],
      strokeGeometry: [],
      effects: [
        {
          type: 'DROP_SHADOW',
          visible: true,
          color: { r: 0, g: 0, b: 0, a: 0.5 },
          offset: { x: 5, y: 5 },
          radius: 10,
          spread: 0
        }
      ]
    })
    renderEffects(r, asCanvas(canvas), node, TEST_GRAPH, 'behind')
    expect(canvas.drawRect).toHaveBeenCalled()
  })

  test('applies effect blend modes to rendered shadow paint', () => {
    const r = createMockRenderer()
    const canvas = createMockCanvas()
    const node = effectNode({
      type: 'RECTANGLE',
      width: 100,
      height: 100,
      fills: [OPAQUE_FILL],
      childIds: [],
      strokeGeometry: [],
      effects: [
        {
          type: 'DROP_SHADOW',
          visible: true,
          color: { r: 0, g: 0, b: 0, a: 0.5 },
          offset: { x: 5, y: 5 },
          radius: 10,
          spread: 0,
          blendMode: 'SCREEN'
        }
      ]
    })

    renderEffects(r, asCanvas(canvas), node, TEST_GRAPH, 'behind')

    expect(r.auxFill.setBlendMode).toHaveBeenCalledWith(r.ck.BlendMode.Screen)
    expect(r.auxFill.setBlendMode).toHaveBeenLastCalledWith(r.ck.BlendMode.SrcOver)
  })

  test('handles INNER_SHADOW', () => {
    const r = createMockRenderer()
    const canvas = createMockCanvas()
    const node = effectNode({
      type: 'RECTANGLE',
      width: 100,
      height: 100,
      fills: [OPAQUE_FILL],
      childIds: [],
      effects: [
        {
          type: 'INNER_SHADOW',
          visible: true,
          color: { r: 0, g: 0, b: 0, a: 0.5 },
          offset: { x: 5, y: 5 },
          radius: 10,
          spread: 0
        }
      ]
    })
    renderEffects(r, asCanvas(canvas), node, TEST_GRAPH, 'inner')
    expect(canvas.drawPath).toHaveBeenCalled()
  })

  test('handles BACKGROUND_BLUR', () => {
    const r = createMockRenderer()
    const canvas = createMockCanvas()
    const node = effectNode({
      type: 'RECTANGLE',
      fills: [],
      childIds: [],
      effects: [
        {
          type: 'BACKGROUND_BLUR',
          visible: true,
          radius: 10,
          color: { r: 0, g: 0, b: 0, a: 0 },
          offset: { x: 0, y: 0 },
          spread: 0
        }
      ]
    })
    renderEffects(r, asCanvas(canvas), node, TEST_GRAPH, 'behind')
    expect(r.applyClippedBlur).toHaveBeenCalled()
  })

  test('background blur uses a backdrop filter instead of a layer content filter', () => {
    const blurFilter = asDouble<ImageFilter>({ kind: 'blur' })
    const r = createMockRenderer({
      clipNodeShape: mock(() => undefined),
      getCachedLayerBlur: mock(() => blurFilter)
    })
    const canvas = createMockCanvas()
    const rect = new Float32Array([0, 0, 100, 100])
    const node = effectNode({
      type: 'RECTANGLE',
      width: 100,
      height: 100,
      fills: [],
      childIds: [],
      effects: []
    })

    const blur = { radius: 5 }
    applyClippedBlur(r, asCanvas(canvas), node, blur)

    expect(r.getCachedLayerBlur).toHaveBeenCalledWith(blur, 100, 100, {
      minX: 0,
      minY: 0,
      maxX: 100,
      maxY: 100
    })

    expect(r.effectLayerPaint.setImageFilter).toHaveBeenCalledWith(null)
    expect(canvas.saveLayer).toHaveBeenCalledWith(
      undefined,
      rect,
      blurFilter,
      undefined,
      r.ck.TileMode.Clamp
    )
  })

  test('handles LAYER_BLUR in renderNode', () => {
    const r = createMockRenderer()
    const canvas = createMockCanvas()
    const node = effectNode({
      type: 'RECTANGLE',
      id: 'n1',
      visible: true,
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      rotation: 0,
      opacity: 1,
      effects: [
        {
          type: 'LAYER_BLUR',
          visible: true,
          radius: 10,
          color: { r: 0, g: 0, b: 0, a: 0 },
          offset: { x: 0, y: 0 },
          spread: 0
        }
      ],
      childIds: [],
      source: createDefaultSourceMetadata()
    })
    const graph: Partial<SceneGraph> = {
      getNode: mock(() => node),
      observeNodeChanges: mock(() => () => true),
      positionPreviewVersion: 0
    }
    renderNode(r, asCanvas(canvas), graph as SceneGraph, 'n1', {})
    expect(r.getCachedLayerBlur).toHaveBeenCalledWith(node.effects[0], 100, 100, null)
    expect(canvas.saveLayer).toHaveBeenCalledWith(r.effectLayerPaint, expect.any(Float32Array))
    expect(r.ck.LTRBRect).toHaveBeenCalledWith(-14, -14, 114, 114)
  })

  test('handles FOREGROUND_BLUR in renderNode', () => {
    const r = createMockRenderer()
    const canvas = createMockCanvas()
    const node = effectNode({
      type: 'RECTANGLE',
      id: 'n1',
      visible: true,
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      rotation: 0,
      opacity: 1,
      effects: [
        {
          type: 'FOREGROUND_BLUR',
          visible: true,
          radius: 20,
          color: { r: 0, g: 0, b: 0, a: 0 },
          offset: { x: 0, y: 0 },
          spread: 0
        }
      ],
      childIds: [],
      source: createDefaultSourceMetadata()
    })
    const graph: Partial<SceneGraph> = {
      getNode: mock(() => node),
      observeNodeChanges: mock(() => () => true),
      positionPreviewVersion: 0
    }
    renderNode(r, asCanvas(canvas), graph as SceneGraph, 'n1', {})
    expect(r.getCachedLayerBlur).toHaveBeenCalledWith(node.effects[0], 100, 100, null)
    expect(canvas.saveLayer).toHaveBeenCalledWith(r.effectLayerPaint, expect.any(Float32Array))
    expect(r.ck.LTRBRect).toHaveBeenCalledWith(-27, -27, 127, 127)
  })
})

describe('progressive layer blur', () => {
  test('blurs what a turned layer and its overflowing children draw, its ramp turned with it', () => {
    // Children draw through the renderer, which this test only watches.
    const r = createMockRenderer({ renderNode: mock(() => undefined) })
    const canvas = createMockCanvas()
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const blur: Effect = {
      type: 'LAYER_BLUR',
      visible: true,
      radius: 16,
      color: { r: 0, g: 0, b: 0, a: 0 },
      offset: { x: 0, y: 0 },
      spread: 0,
      progressive: { startRadius: 0, startOffset: { x: 0, y: 0.5 }, endOffset: { x: 1, y: 0.5 } }
    }
    const frame = graph.createNode('FRAME', page.id, {
      x: 0,
      y: 0,
      width: 100,
      height: 50,
      rotation: 90,
      clipsContent: false,
      effects: [blur]
    })
    graph.createNode('RECTANGLE', frame.id, { x: 80, y: 0, width: 60, height: 20 })
    renderNode(r, asCanvas(canvas), graph, frame.id, {})

    const [, width, height, bounds, toFilter] = expectDefined(
      mockCalls(r.getCachedLayerBlur)[0],
      'layer blur call'
    )
    expect([width, height]).toEqual([100, 50])
    // Turned about its centre, the frame's right side faces down: the child, reaching 40 past it,
    // ends at y = 115, and the blur's kernel ends further out.
    const reach = blurReach(16)
    expect(bounds).toEqual({
      minX: 25 - reach,
      minY: -25 - reach,
      maxX: 75 + reach,
      maxY: 115 + reach
    })
    if (typeof toFilter !== 'function') throw new Error('expected the ramp mapping')
    const end: unknown = toFilter({ x: 100, y: 25 })
    // The ramp ends at the middle of the right side, which the turn carries below the centre.
    expect(end).toMatchObject({ x: expect.closeTo(50, 6), y: expect.closeTo(75, 6) })
  })
})
