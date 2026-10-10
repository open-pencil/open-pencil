import { describe, expect, test } from 'bun:test'

import {
  cornerRadiusAtPoint,
  cornerRadiusChanges,
  shapeHandleLayout,
  createSceneGeometry,
  dragsSingleCorner,
  hitTestShapeHandles,
  pointCountAtPoint,
  starRatioAtPoint
} from '#core/geometry'
import { SceneGraph, type SceneNode } from '@open-pencil/scene-graph'

// Values measured on a 160 × 232 rectangle in Figma desktop, 2026-10-10.

function rectangle(props: Partial<SceneNode> = {}, type: SceneNode['type'] = 'RECTANGLE') {
  const graph = new SceneGraph()
  const node = graph.createNode(type, graph.getPages()[0].id, {
    x: 0,
    y: 0,
    width: 160,
    height: 232,
    ...props
  })
  return { graph, node }
}

function layout(props: Partial<SceneNode> = {}, zoom = 1, type: SceneNode['type'] = 'RECTANGLE') {
  const { graph, node } = rectangle(props, type)
  const handles = shapeHandleLayout(node, createSceneGeometry(graph), {
    panX: 0,
    panY: 0,
    zoom
  })
  // Positions come from the corner's bisector, so they carry floating-point noise.
  const exact = (value: number) => Math.round(value * 1e6) / 1e6
  return handles?.map(({ handle, point }) => [handle, exact(point.x), exact(point.y)])
}

describe('shape handles', () => {
  test('sit 12.5 screen pixels inside corners whose radius is smaller', () => {
    expect(layout()).toEqual([
      ['topLeft', 12.5, 12.5],
      ['topRight', 147.5, 12.5],
      ['bottomRight', 147.5, 219.5],
      ['bottomLeft', 12.5, 219.5]
    ])
  })

  test('sit at the centre of each corner arc, at any zoom', () => {
    expect(layout({ cornerRadius: 20 }, 2)?.[0]).toEqual(['topLeft', 40, 40])
    expect(
      layout({
        independentCorners: true,
        topLeftRadius: 10,
        topRightRadius: 40,
        bottomRightRadius: 0,
        bottomLeftRadius: 20
      })
    ).toEqual([
      ['topLeft', 12.5, 12.5],
      ['topRight', 120, 40],
      ['bottomRight', 147.5, 219.5],
      ['bottomLeft', 20, 212]
    ])
  })

  test('hide while the shorter side is under 108 screen pixels, and on other layer types', () => {
    expect(layout({ width: 108, height: 108 })).toHaveLength(4)
    expect(layout({ width: 107, height: 300 })).toBeUndefined()
    expect(layout({ width: 216, height: 216 }, 0.5)).toHaveLength(4)
    expect(layout({ width: 212, height: 212 }, 0.5)).toBeUndefined()
    expect(layout({}, 1, 'FRAME')).toBeUndefined()
    expect(layout({}, 1, 'ELLIPSE')).toBeUndefined()
  })

  // Figma desktop, 2026-10-10: a 160 × 160 triangle's one handle sits below its top point, at the
  // centre of the arc, or 12.5√2 px down while that is closer; dragging it to 48 px sets 24.
  test('sit below the top point of a polygon or star', () => {
    const triangle = { width: 160, height: 160, pointCount: 3 }
    const [handle] = layout({ ...triangle, cornerRadius: 24 }, 1, 'POLYGON') ?? []
    expect(handle?.[0]).toBe('point')
    expect(handle).toEqual(['point', 80, 48])
    expect(layout(triangle, 1, 'POLYGON')?.[0][2]).toBeCloseTo(12.5 * Math.SQRT2, 5)
    expect(layout({ ...triangle, pointCount: 5 }, 1, 'STAR')).toHaveLength(3)
  })

  test('set a polygon radius from the distance below its top point, up to what fits', () => {
    const { node } = rectangle({ width: 160, height: 160, pointCount: 3 }, 'POLYGON')
    expect(cornerRadiusAtPoint(node, 'point', { x: 80, y: 48 }, false)).toBe(24)
    expect(cornerRadiusAtPoint(node, 'point', { x: 80, y: 400 }, false)).toBeCloseTo(40, 6)
    expect(cornerRadiusChanges(node, 'point', 24, false)).toEqual({ cornerRadius: 24 })
    expect(dragsSingleCorner(node, true)).toBe(false)
  })

  // Figma desktop, 2026-10-10: a star's ratio handle sits on its first inner point and its count
  // handle on its next outer point, a polygon's count handle on its second point; rounded corners
  // move them to the middle of the rounding.
  test('put the count and ratio on the points they change', () => {
    const star = { width: 160, height: 160, pointCount: 5, starInnerRadius: 0.382 }
    const at = (props: Partial<SceneNode>, type: SceneNode['type']) =>
      Object.fromEntries(
        (layout(props, 1, type) ?? []).map(([handle, x, y]) => [
          handle,
          [Math.round(Number(x) * 10) / 10, Math.round(Number(y) * 10) / 10]
        ])
      )
    expect(at(star, 'STAR')).toMatchObject({ ratio: [98, 55.3], count: [156.1, 55.3] })
    expect(at({ ...star, cornerRadius: 12 }, 'STAR')).toMatchObject({
      ratio: [99.6, 53],
      count: [130.6, 63.6]
    })
    expect(at({ width: 160, height: 160, pointCount: 3 }, 'POLYGON')).toMatchObject({
      count: [149.3, 120]
    })
  })

  // Figma desktop, 2026-10-10, dragging a 160 × 160 star's handles to points 80 px from its centre
  // at angles clockwise from its top point, and along its inner points' rays.
  test('set the point count from the angle and the ratio from the distance', () => {
    const { node } = rectangle({ width: 160, height: 160, pointCount: 5 }, 'STAR')
    const at = (degrees: number, distance: number) => ({
      x: 80 + distance * Math.sin((degrees * Math.PI) / 180),
      y: 80 - distance * Math.cos((degrees * Math.PI) / 180)
    })
    const counts = [140, 100, 60, 50, 40, 30, 20, 5].map((angle) =>
      pointCountAtPoint(node, at(angle, 80))
    )
    expect(counts).toEqual([3, 4, 6, 7, 9, 12, 18, 60])
    const ratios = [5, 40, 60, 100].map((distance) => starRatioAtPoint(node, at(36, distance)))
    expect(ratios).toEqual([0.06, 0.5, 0.75, 1])
    expect(starRatioAtPoint(node, at(20, 40))).toBe(0.5)
  })

  test('take the pointer within their ring and a little beyond', () => {
    const handles = [{ handle: 'topLeft' as const, point: { x: 12.5, y: 12.5 } }]
    expect(hitTestShapeHandles(handles, { x: 18, y: 16 })).toBe('topLeft')
    expect(hitTestShapeHandles(handles, { x: 22, y: 12.5 })).toBeNull()
  })

  test('set the radius whose arc centre is under the pointer', () => {
    const { node } = rectangle()
    expect(cornerRadiusAtPoint(node, 'topLeft', { x: 32.5, y: 32.5 }, false)).toBe(33)
    expect(cornerRadiusAtPoint(node, 'topLeft', { x: 32.5, y: 12.5 }, false)).toBe(23)
    expect(cornerRadiusAtPoint(node, 'topLeft', { x: 32.5, y: -7.5 }, false)).toBe(13)
    expect(cornerRadiusAtPoint(node, 'bottomRight', { x: 127.5, y: 199.5 }, false)).toBe(33)
    expect(cornerRadiusAtPoint(node, 'topLeft', { x: -10, y: -10 }, false)).toBe(0)
    expect(cornerRadiusAtPoint(node, 'topLeft', { x: 220, y: 220 }, false)).toBe(80)
  })

  test('round to tens with Shift', () => {
    const { node } = rectangle()
    const snapped = [20.5, 26.5, 33.5, 39.5, 52.5].map((at) =>
      cornerRadiusAtPoint(node, 'topLeft', { x: at, y: at }, true)
    )
    expect(snapped).toEqual([20, 30, 30, 40, 50])
  })

  test('drag equal corners together and differing ones alone, Alt reversing either', () => {
    const uniform = rectangle({ cornerRadius: 20 }).node
    const mixed = rectangle({ independentCorners: true, topLeftRadius: 10, topRightRadius: 40 }).node
    expect(dragsSingleCorner(uniform, false)).toBe(false)
    expect(dragsSingleCorner(uniform, true)).toBe(true)
    expect(dragsSingleCorner(mixed, false)).toBe(true)
    expect(dragsSingleCorner(mixed, true)).toBe(false)

    expect(cornerRadiusChanges(uniform, 'bottomRight', 30, true)).toEqual({
      independentCorners: true,
      topLeftRadius: 20,
      topRightRadius: 20,
      bottomRightRadius: 30,
      bottomLeftRadius: 20
    })
    expect(cornerRadiusChanges(mixed, 'topRight', 50, false)).toEqual({
      cornerRadius: 50,
      independentCorners: false,
      topLeftRadius: 50,
      topRightRadius: 50,
      bottomRightRadius: 50,
      bottomLeftRadius: 50
    })
  })
})
