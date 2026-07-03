import { describe, expect, mock, test } from 'bun:test'

import type { Canvas } from 'canvaskit-wasm'

import type { SceneNode } from '@open-pencil/scene-graph'

import { renderEffects } from '#core/canvas/shadows'

import { createMockCanvas, createMockRenderer, mockCalls } from './helpers'

const requiredNodeFields = { childIds: [] as string[], strokeGeometry: [] }

describe('path shape shadows', () => {
  test('drop shadow for a star without imported geometry uses the star path', () => {
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

    renderEffects(r, canvas as Canvas, node as SceneNode, new Float32Array(4), false, 'behind')

    expect(r.makePolygonPath).toHaveBeenCalled()
    expect(canvas.drawPath).toHaveBeenCalled()
    expect(canvas.drawRect).not.toHaveBeenCalled()
  })

  test('drop shadow spread copies imported geometry instead of mutating cache paths', () => {
    const r = createMockRenderer()
    const canvas = createMockCanvas()
    const cachedPath = new r.ck.Path()
    const spreadPath = new r.ck.Path()
    cachedPath.copy = mock(() => spreadPath)
    r.getFillGeometry = mock(() => [cachedPath])

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

    renderEffects(r, canvas as Canvas, node as SceneNode, new Float32Array(4), false, 'behind')

    expect(cachedPath.copy).toHaveBeenCalled()
    expect(cachedPath.op).not.toHaveBeenCalled()
    expect(spreadPath.op).toHaveBeenCalledWith(expect.anything(), r.ck.PathOp.Union)
    expect(spreadPath.delete).toHaveBeenCalled()
  })

  test('inner shadow for a polygon clips and cuts out with polygon paths', () => {
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

    renderEffects(
      r,
      canvas as Canvas,
      node as SceneNode,
      new Float32Array([0, 0, 100, 100]),
      false,
      'front'
    )

    expect(mockCalls(r.makePolygonPath).length).toBeGreaterThanOrEqual(2)
    expect(canvas.clipPath).toHaveBeenCalled()
    expect(canvas.drawPath).toHaveBeenCalled()
    expect(canvas.clipRect).not.toHaveBeenCalled()
  })
})
