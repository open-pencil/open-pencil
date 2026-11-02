import { describe, expect, test } from 'bun:test'

import {
  arcAtPoint,
  arcChanges,
  createSceneGeometry,
  shapeHandleLayout,
  shapeHandleValue
} from '#core/geometry'
import { SceneGraph, type ArcData, type SceneNode } from '@open-pencil/scene-graph'

// Values measured on ellipses in Figma desktop, 2026-10-21.

const DEGREE = Math.PI / 180

function ellipse(props: Partial<SceneNode> = {}) {
  const graph = new SceneGraph()
  const node = graph.createNode('ELLIPSE', graph.getPages()[0].id, {
    x: 0,
    y: 0,
    width: 300,
    height: 300,
    ...props
  })
  return { graph, node }
}

function arc(startDegrees: number, endDegrees: number, innerRadius = 0): ArcData {
  return { startingAngle: startDegrees * DEGREE, endingAngle: endDegrees * DEGREE, innerRadius }
}

function layout(props: Partial<SceneNode> = {}, zoom = 1) {
  const { graph, node } = ellipse(props)
  const handles = shapeHandleLayout(node, createSceneGeometry(graph), { panX: 0, panY: 0, zoom })
  const exact = (value: number) => Math.round(value * 1e6) / 1e6
  return handles?.map(({ handle, point }) => [handle, exact(point.x), exact(point.y)])
}

/** A node-local point at an angle and a distance from the centre of a 300 × 300 ellipse. */
function at(degrees: number, distance: number) {
  return {
    x: 150 + distance * Math.cos(degrees * DEGREE),
    y: 150 + distance * Math.sin(degrees * DEGREE)
  }
}

function degrees(value: ArcData) {
  const round = (angle: number) => Math.round((angle / DEGREE) * 1000) / 1000
  return [round(value.startingAngle), round(value.endingAngle), value.innerRadius]
}

describe('arc handles', () => {
  test('put one handle 10 screen pixels inside a whole ellipse at its start', () => {
    expect(layout()).toEqual([['arcEnd', 290, 150]])
    expect(layout({ arcData: arc(90, 450) })).toEqual([['arcEnd', 150, 290]])
    expect(layout({}, 2)).toEqual([['arcEnd', 590, 300]])
  })

  test('put a whole ring’s end halfway across it and its ratio on the inner edge opposite', () => {
    expect(layout({ arcData: arc(0, 360, 0.5) })).toEqual([
      ['arcEnd', 262.5, 150],
      ['arcRatio', 75, 150]
    ])
  })

  test('put an arc’s start and end halfway across their edges and its ratio mid-sweep', () => {
    expect(layout({ arcData: arc(0, 270) })).toEqual([
      ['arcEnd', 150, 75],
      ['arcStart', 225, 150],
      ['arcRatio', 150, 150]
    ])
    const ring = layout({ arcData: arc(0, 180, 0.5) })
    expect(ring?.[2]).toEqual(['arcRatio', 150, 225])
  })

  test('scale positions with the ellipse on a wide one', () => {
    expect(layout({ width: 300, height: 150, arcData: arc(0, 90) })).toEqual([
      ['arcEnd', 150, 112.5],
      ['arcStart', 225, 75],
      ['arcRatio', 150, 75]
    ])
  })

  test('hide while the shorter side is under 75 screen pixels', () => {
    expect(layout({ width: 75, height: 300 })).toHaveLength(1)
    expect(layout({ width: 74, height: 300 })).toBeUndefined()
    expect(layout({ width: 40, height: 40 }, 2)).toHaveLength(1)
  })

  test('turn the whole arc with the start, keeping it within one turn', () => {
    const { node } = ellipse({ arcData: arc(0, 270) })
    expect(degrees(arcAtPoint(node, 'arcStart', at(-90, 75), false))).toEqual([270, 540, 0])
    expect(degrees(arcAtPoint(node, 'arcStart', at(160, 75), false))).toEqual([160, 430, 0])
    expect(degrees(arcAtPoint(node, 'arcStart', at(40, 75), false))).toEqual([40, 310, 0])
  })

  test('cut the slice the end crosses from a whole ellipse', () => {
    const { node } = ellipse()
    expect(degrees(arcAtPoint(node, 'arcEnd', at(90, 140), false))).toEqual([0, -270, 0])
    expect(degrees(arcAtPoint(node, 'arcEnd', at(-90, 140), false))).toEqual([0, 270, 0])
  })

  test('keep the end continuous and wrap it past a full turn', () => {
    const { node } = ellipse({ arcData: arc(0, 270) })
    expect(degrees(arcAtPoint(node, 'arcEnd', at(20, 75), false))).toEqual([0, -340, 0])
    node.arcData = arc(0, 350)
    expect(degrees(arcAtPoint(node, 'arcEnd', at(5, 75), false))).toEqual([0, 365 - 720, 0])
    node.arcData = arc(0, -340)
    expect(degrees(arcAtPoint(node, 'arcEnd', at(30, 75), false))).toEqual([0, -330, 0])
  })

  test('treat a sweep within 0.01° of a full turn as a whole ellipse, as it is drawn', () => {
    expect(layout({ arcData: arc(0, 359.995) })).toHaveLength(1)
    expect(layout({ arcData: arc(0, 359.98) })).toHaveLength(3)
  })

  test('drop the outline a .fig stored for the old arc', () => {
    const outline = [{ commandsBlob: new Uint8Array([1]), windingRule: 'NONZERO' as const }]
    const { node } = ellipse({ fillGeometry: outline, strokeGeometry: outline })
    expect(arcChanges(node, 'arcEnd', at(-90, 140), false)).toEqual({
      arcData: arc(0, 270),
      fillGeometry: [],
      strokeGeometry: []
    })
  })

  test('take the angle in the ellipse’s own space', () => {
    const { node } = ellipse({ width: 300, height: 150, arcData: arc(0, 90) })
    const corner = arcAtPoint(node, 'arcStart', { x: 300, y: 150 }, false)
    expect(corner.startingAngle).toBeCloseTo(45 * DEGREE, 6)
  })

  test('set the ratio from the distance in any direction, up to 1', () => {
    const { node } = ellipse({ arcData: arc(0, 270) })
    expect(arcAtPoint(node, 'arcRatio', at(200, 60), false).innerRadius).toBeCloseTo(0.4, 6)
    expect(arcAtPoint(node, 'arcRatio', at(10, 400), false).innerRadius).toBe(1)
  })

  test('round angles to 15° and the ratio to tenths with Shift', () => {
    const { node } = ellipse({ arcData: arc(0, 270) })
    expect(degrees(arcAtPoint(node, 'arcStart', at(52, 75), true))).toEqual([45, 315, 0])
    expect(degrees(arcAtPoint(node, 'arcEnd', at(-62, 75), true))).toEqual([0, 300, 0])
    expect(arcAtPoint(node, 'arcRatio', at(0, 59), true).innerRadius).toBeCloseTo(0.4, 6)
  })

  test('label the start in degrees and the sweep and ratio in percent', () => {
    const { node } = ellipse({ arcData: arc(45, 45 - 270, 0.396) })
    expect(shapeHandleValue(node, 'arcStart')).toBe('45°')
    expect(shapeHandleValue(node, 'arcEnd')).toBe('-75%')
    expect(shapeHandleValue(node, 'arcRatio')).toBe('39.6%')
  })
})
