import { describe, expect, mock, test } from 'bun:test'

import type { Canvas } from 'canvaskit-wasm'

import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'

import { applyClippedBlur } from '#core/canvas/effects'
import { renderNode } from '#core/canvas/scene'
import { renderEffects } from '#core/canvas/shadows'

import { createMockCanvas, createMockRenderer, mockCalls } from './helpers'

describe('Renderer handles all effect types (Behavioral)', () => {
  test('handles DROP_SHADOW', () => {
    const r = createMockRenderer()
    const canvas = createMockCanvas()
    const node: Partial<SceneNode> = {
      type: 'RECTANGLE',
      width: 100,
      height: 100,
      fills: [],
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
    }
    renderEffects(r, canvas as Canvas, node as SceneNode, new Float32Array(4), false, 'behind')
    expect(canvas.drawRect).toHaveBeenCalled()
  })

  test('drop shadow follows stroke geometry and hides shadow behind unfilled nodes', () => {
    const strokePath = { kind: 'stroke' }
    const fillPath = { kind: 'fill' }
    const r = createMockRenderer({
      getFillGeometry: mock(() => [fillPath]),
      getStrokeGeometry: mock(() => [strokePath])
    })
    const canvas = createMockCanvas()
    const node: Partial<SceneNode> = {
      type: 'RECTANGLE',
      width: 100,
      height: 100,
      fills: [],
      childIds: [],
      strokeGeometry: [{ commandsBlob: new Uint8Array([0]) }],
      effects: [
        {
          type: 'DROP_SHADOW',
          visible: true,
          color: { r: 0, g: 0, b: 0, a: 0.5 },
          offset: { x: 0, y: 3 },
          radius: 3,
          spread: 0,
          showShadowBehindNode: false
        }
      ]
    }

    renderEffects(r, canvas as Canvas, node as SceneNode, new Float32Array(4), false, 'behind')

    expect(r.getStrokeGeometry).toHaveBeenCalledWith(node)
    expect(r.getFillGeometry).toHaveBeenCalledWith(node)
    expect(canvas.drawPath).toHaveBeenCalledWith(strokePath, r.auxFill)
    expect(canvas.drawPath).toHaveBeenCalledWith(fillPath, r.auxFill)
    expect(r.auxFill.setBlendMode).toHaveBeenCalledWith(r.ck.BlendMode.DstOut)
  })

  test('applies effect blend modes to rendered shadow paint', () => {
    const r = createMockRenderer()
    const canvas = createMockCanvas()
    const node: Partial<SceneNode> = {
      type: 'RECTANGLE',
      width: 100,
      height: 100,
      fills: [],
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
    }

    renderEffects(r, canvas as Canvas, node as SceneNode, new Float32Array(4), false, 'behind')

    expect(r.auxFill.setBlendMode).toHaveBeenCalledWith(r.ck.BlendMode.Screen)
    expect(r.auxFill.setBlendMode).toHaveBeenLastCalledWith(r.ck.BlendMode.SrcOver)
  })

  test('handles INNER_SHADOW', () => {
    const r = createMockRenderer()
    const canvas = createMockCanvas()
    const node: Partial<SceneNode> = {
      type: 'RECTANGLE',
      width: 100,
      height: 100,
      fills: [],
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
    }
    renderEffects(
      r,
      canvas as Canvas,
      node as SceneNode,
      new Float32Array([0, 0, 100, 100]),
      false,
      'front'
    )
    expect(canvas.drawPath).toHaveBeenCalled()
  })

  test('renders raw Figma noise effects as a bounded visual fallback', () => {
    const r = createMockRenderer()
    const canvas = createMockCanvas()
    const node: Partial<SceneNode> = {
      type: 'RECTANGLE',
      width: 20,
      height: 20,
      fills: [],
      childIds: [],
      effects: [],
      source: {
        format: 'fig',
        id: '1:1',
        orderKey: null,
        fig: {
          rawSize: null,
          rawTransform: null,
          rawNodeFields: {
            effects: [
              {
                type: 'NOISE',
                visible: true,
                color: { r: 0, g: 0, b: 0, a: 1 },
                density: 1,
                noiseSize: { x: 0.25, y: 0.25 },
                noiseType: 'MONOTONE'
              }
            ]
          },
          layout: null,
          symbolOverrides: [],
          componentPropAssignments: [],
          derivedSymbolData: [],
          derivedSymbolDataLayoutVersion: null,
          uniformScaleFactor: null
        }
      }
    }

    renderEffects(
      r,
      canvas as Canvas,
      node as SceneNode,
      new Float32Array([0, 0, 20, 20]),
      false,
      'front'
    )

    expect(r.clipNodeShape).toHaveBeenCalled()
    expect(canvas.drawRect).toHaveBeenCalled()
  })

  test('bounds raw noise effect draw calls for large nodes', () => {
    const r = createMockRenderer()
    const canvas = createMockCanvas()
    const node: Partial<SceneNode> = {
      type: 'RECTANGLE',
      width: 1000,
      height: 1000,
      fills: [],
      childIds: [],
      effects: [],
      source: {
        format: 'fig',
        id: '1:1',
        orderKey: null,
        fig: {
          rawSize: null,
          rawTransform: null,
          rawNodeFields: {
            effects: [
              {
                type: 'NOISE',
                visible: true,
                color: { r: 0, g: 0, b: 0, a: 1 },
                density: 1,
                noiseSize: { x: 0.1, y: 0.1 }
              }
            ]
          },
          layout: null,
          symbolOverrides: [],
          componentPropAssignments: [],
          derivedSymbolData: [],
          derivedSymbolDataLayoutVersion: null,
          uniformScaleFactor: null
        }
      }
    }

    renderEffects(
      r,
      canvas as Canvas,
      node as SceneNode,
      new Float32Array([0, 0, 1000, 1000]),
      false,
      'front'
    )

    expect(mockCalls(canvas.drawRect).length).toBeLessThanOrEqual(12_000)
  })

  test('handles BACKGROUND_BLUR', () => {
    const r = createMockRenderer()
    const canvas = createMockCanvas()
    const node: Partial<SceneNode> = {
      fills: [],
      childIds: [],
      effects: [{ type: 'BACKGROUND_BLUR', visible: true, radius: 10 }]
    }
    renderEffects(r, canvas as Canvas, node as SceneNode, new Float32Array(4), false, 'behind')
    expect(r.applyClippedBlur).toHaveBeenCalled()
  })

  test('background blur uses a backdrop filter instead of a layer content filter', () => {
    const blurFilter = { kind: 'blur' }
    const r = createMockRenderer({
      clipNodeShape: mock(() => undefined),
      getCachedBlur: mock(() => blurFilter)
    })
    const canvas = createMockCanvas()
    const rect = new Float32Array([0, 0, 100, 100])
    const node: Partial<SceneNode> = {
      type: 'RECTANGLE',
      width: 100,
      height: 100,
      fills: [],
      childIds: [],
      effects: []
    }

    applyClippedBlur(r, canvas as Canvas, node as SceneNode, rect, false, 5)

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
    const node: Partial<SceneNode> = {
      id: 'n1',
      visible: true,
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      rotation: 0,
      opacity: 1,
      effects: [{ type: 'LAYER_BLUR', visible: true, radius: 10 }],
      childIds: []
    }
    const graph: Partial<SceneGraph> = {
      getNode: mock(() => node as SceneNode)
    }
    renderNode(r, canvas as Canvas, graph as SceneGraph, 'n1', {})
    expect(r.getCachedBlur).toHaveBeenCalledWith(5)
    expect(canvas.saveLayer).toHaveBeenCalledWith(r.effectLayerPaint, expect.any(Float32Array))
    expect(r.ck.LTRBRect).toHaveBeenCalledWith(-20, -20, 120, 120)
  })

  test('handles FOREGROUND_BLUR in renderNode', () => {
    const r = createMockRenderer()
    const canvas = createMockCanvas()
    const node: Partial<SceneNode> = {
      id: 'n1',
      visible: true,
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      rotation: 0,
      opacity: 1,
      effects: [{ type: 'FOREGROUND_BLUR', visible: true, radius: 20 }],
      childIds: []
    }
    const graph: Partial<SceneGraph> = {
      getNode: mock(() => node as SceneNode)
    }
    renderNode(r, canvas as Canvas, graph as SceneGraph, 'n1', {})
    expect(r.getCachedBlur).toHaveBeenCalledWith(10)
    expect(canvas.saveLayer).toHaveBeenCalledWith(r.effectLayerPaint, expect.any(Float32Array))
    expect(r.ck.LTRBRect).toHaveBeenCalledWith(-40, -40, 140, 140)
  })
})
