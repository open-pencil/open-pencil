import { describe, expect, mock, test } from 'bun:test'

import type { Canvas } from 'canvaskit-wasm'

import { renderEffects } from '#core/canvas/shadows'
import type { SceneNode } from '#core/scene-graph'

import { createMockCanvas, createMockRenderer, mockCalls } from './helpers'

/** Common fields missing from Partial<SceneNode> that shadows.ts accesses. */
const requiredNodeFields = { childIds: [] as string[], strokeGeometry: [] as unknown[] }

describe('Path shape shadow rendering (POLYGON/STAR/VECTOR)', () => {
  test('drop shadow on STAR with no geometryShadow uses isPathShape branch', () => {
    const r = createMockRenderer()
    const canvas = createMockCanvas()
    const node: Partial<SceneNode> = {
      ...requiredNodeFields,
      type: 'STAR',
      width: 100,
      height: 100,
      fills: [],
      effects: [
        {
          type: 'DROP_SHADOW',
          visible: true,
          color: { r: 0, g: 0, b: 0, a: 1 },
          offset: { x: 0, y: 0 },
          radius: 10,
          spread: 5
        }
      ]
    }

    r.getFillGeometry = mock(() => null)
    r.getStrokeGeometry = mock(() => null)

    renderEffects(r, canvas as Canvas, node as SceneNode, new Float32Array(4), false, 'behind')

    // STAR without fill/stroke uses isPathShape branch → r.makePolygonPath is called
    expect(r.makePolygonPath).toHaveBeenCalled()
    expect(canvas.drawPath).toHaveBeenCalled()
  })

  test('drop shadow on filled STAR copies geometryShadow paths and applies spread', () => {
    const r = createMockRenderer()
    const canvas = createMockCanvas()
    const node: Partial<SceneNode> = {
      ...requiredNodeFields,
      type: 'STAR',
      width: 100,
      height: 100,
      fills: [{ visible: true, type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 }, opacity: 1 }],
      effects: [
        {
          type: 'DROP_SHADOW',
          visible: true,
          color: { r: 0, g: 0, b: 0, a: 1 },
          offset: { x: 0, y: 0 },
          radius: 10,
          spread: 10
        }
      ]
    }

    const fillPath = new r.ck.Path()
    r.getFillGeometry = mock(() => [fillPath])
    r.getStrokeGeometry = mock(() => null)

    renderEffects(r, canvas as Canvas, node as SceneNode, new Float32Array(4), false, 'behind')

    expect(r.getFillGeometry).toHaveBeenCalledWith(node)
    expect(canvas.drawPath).toHaveBeenCalled()
    // Spread is applied to copies via PathOp (since spread > 0, Union is used)
    expect(fillPath.op).toHaveBeenCalled()
  })

  test('drop shadow on POLYGON with negative spread contracts the path', () => {
    const r = createMockRenderer()
    const canvas = createMockCanvas()
    const node: Partial<SceneNode> = {
      ...requiredNodeFields,
      type: 'POLYGON',
      width: 80,
      height: 80,
      fills: [],
      effects: [
        {
          type: 'DROP_SHADOW',
          visible: true,
          color: { r: 0, g: 0, b: 0, a: 1 },
          offset: { x: 0, y: 0 },
          radius: 5,
          spread: -3
        }
      ]
    }

    r.getFillGeometry = mock(() => null)
    r.getStrokeGeometry = mock(() => null)

    renderEffects(r, canvas as Canvas, node as SceneNode, new Float32Array(4), false, 'behind')

    // POLYGON without fill/stroke uses isPathShape branch
    expect(r.makePolygonPath).toHaveBeenCalled()
    expect(canvas.drawPath).toHaveBeenCalled()
  })

  test('drop shadow on VECTOR with spread=0 does not apply PathOp', () => {
    const r = createMockRenderer()
    const canvas = createMockCanvas()
    const node: Partial<SceneNode> = {
      ...requiredNodeFields,
      type: 'VECTOR',
      width: 120,
      height: 60,
      fills: [],
      effects: [
        {
          type: 'DROP_SHADOW',
          visible: true,
          color: { r: 0, g: 0, b: 0, a: 1 },
          offset: { x: 2, y: 2 },
          radius: 8,
          spread: 0
        }
      ]
    }

    r.getFillGeometry = mock(() => null)
    r.getStrokeGeometry = mock(() => null)

    renderEffects(r, canvas as Canvas, node as SceneNode, new Float32Array(4), false, 'behind')

    // VECTOR without fill/stroke uses isPathShape branch, spread=0 → no PathOp
    expect(r.getVectorPaths).toHaveBeenCalled()
    expect(canvas.drawPath).toHaveBeenCalled()
  })

  test('inner shadow on POLYGON uses shape path for clipping and inner path', () => {
    const r = createMockRenderer()
    const canvas = createMockCanvas()
    const node: Partial<SceneNode> = {
      ...requiredNodeFields,
      type: 'POLYGON',
      width: 100,
      height: 100,
      fills: [],
      effects: [
        {
          type: 'INNER_SHADOW',
          visible: true,
          color: { r: 0, g: 0, b: 0, a: 1 },
          offset: { x: 5, y: 5 },
          radius: 10,
          spread: 3
        }
      ]
    }

    r.getFillGeometry = mock(() => null)
    r.getStrokeGeometry = mock(() => null)

    renderEffects(
      r,
      canvas as Canvas,
      node as SceneNode,
      new Float32Array([0, 0, 100, 100]),
      false,
      'front'
    )

    // makeNodeShapePath calls r.makePolygonPath for POLYGON — called for clipPath and innerPath
    const callCount = mockCalls(r.makePolygonPath).length
    expect(callCount).toBeGreaterThanOrEqual(2)
    expect(canvas.clipPath).toHaveBeenCalled()
    expect(canvas.drawPath).toHaveBeenCalled()
  })

  test('showShadowBehindNode=false for STAR uses punch-out pass', () => {
    const r = createMockRenderer()
    const canvas = createMockCanvas()
    const node: Partial<SceneNode> = {
      ...requiredNodeFields,
      type: 'STAR',
      width: 100,
      height: 100,
      fills: [],
      effects: [
        {
          type: 'DROP_SHADOW',
          visible: true,
          color: { r: 0, g: 0, b: 0, a: 1 },
          offset: { x: 0, y: 0 },
          radius: 10,
          spread: 0,
          showShadowBehindNode: false
        }
      ]
    }

    r.getFillGeometry = mock(() => null)
    r.getStrokeGeometry = mock(() => null)

    renderEffects(r, canvas as Canvas, node as SceneNode, new Float32Array(4), false, 'behind')

    expect(r.auxFill.setBlendMode).toHaveBeenCalledWith(r.ck.BlendMode.DstOut)
    // Punch-out pass draws the node shape (via drawPath for STAR) to carve out shadow behind
    expect(canvas.drawPath).toHaveBeenCalled()
    expect(canvas.saveLayer).toHaveBeenCalled()
  })

  test('showShadowBehindNode=false for ELLIPSE uses punch-out pass', () => {
    const r = createMockRenderer()
    const canvas = createMockCanvas()
    const node: Partial<SceneNode> = {
      ...requiredNodeFields,
      type: 'ELLIPSE',
      width: 80,
      height: 60,
      fills: [],
      effects: [
        {
          type: 'DROP_SHADOW',
          visible: true,
          color: { r: 0, g: 0, b: 0, a: 1 },
          offset: { x: 0, y: 0 },
          radius: 10,
          spread: 0,
          showShadowBehindNode: false
        }
      ]
    }

    r.getFillGeometry = mock(() => null)
    r.getStrokeGeometry = mock(() => null)

    renderEffects(r, canvas as Canvas, node as SceneNode, new Float32Array(4), false, 'behind')

    expect(r.auxFill.setBlendMode).toHaveBeenCalledWith(r.ck.BlendMode.DstOut)
    expect(canvas.drawOval).toHaveBeenCalled()
    expect(canvas.saveLayer).toHaveBeenCalled()
  })

  test('showShadowBehindNode=false for RECT with no fill uses punch-out pass', () => {
    const r = createMockRenderer()
    const canvas = createMockCanvas()
    const node: Partial<SceneNode> = {
      ...requiredNodeFields,
      type: 'RECTANGLE',
      width: 100,
      height: 80,
      fills: [],
      effects: [
        {
          type: 'DROP_SHADOW',
          visible: true,
          color: { r: 0, g: 0, b: 0, a: 1 },
          offset: { x: 0, y: 0 },
          radius: 10,
          spread: 0,
          showShadowBehindNode: false
        }
      ]
    }

    r.getFillGeometry = mock(() => null)
    r.getStrokeGeometry = mock(() => null)

    renderEffects(r, canvas as Canvas, node as SceneNode, new Float32Array(4), false, 'behind')

    expect(r.auxFill.setBlendMode).toHaveBeenCalledWith(r.ck.BlendMode.DstOut)
    expect(canvas.drawRect).toHaveBeenCalled()
    expect(canvas.saveLayer).toHaveBeenCalled()
  })
})
