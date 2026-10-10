import { describe, expect, test } from 'bun:test'

import {
  cornerRadiusAtPoint,
  cornerRadiusChanges,
  cornerRadiusHandleLayout,
  createSceneGeometry,
  dragsSingleCorner,
  hitTestCornerRadiusHandles
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
  const handles = cornerRadiusHandleLayout(node, createSceneGeometry(graph), {
    panX: 0,
    panY: 0,
    zoom
  })
  return handles?.map(({ corner, point }) => [corner, point.x, point.y])
}

describe('corner radius handles', () => {
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

  test('take the pointer within their ring and a little beyond', () => {
    const handles = [{ corner: 'topLeft' as const, point: { x: 12.5, y: 12.5 } }]
    expect(hitTestCornerRadiusHandles(handles, { x: 18, y: 16 })).toBe('topLeft')
    expect(hitTestCornerRadiusHandles(handles, { x: 22, y: 12.5 })).toBeNull()
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
