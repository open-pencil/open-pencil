/**
 * Tests for world transform computation via getAbsolutePosition and getWorldMatrix.
 *
 * These tests verify the getNodeLocalMatrix chain (coordinate.ts) produces
 * correct world coordinates for rotated, flipped, and nested nodes.
 * The tests exercise the full transform chain through the SceneGraph API.
 */
import { describe, expect, test } from 'bun:test'

import { getWorldMatrix, SceneGraph, TransformMatrix } from '@open-pencil/core'

function pageId(graph: SceneGraph) {
  return graph.getPages()[0].id
}

describe('world transform — getAbsolutePosition', () => {
  test('simple translate: node at (100, 200) has abs pos (100, 200)', () => {
    const graph = new SceneGraph()
    const node = graph.createNode('RECTANGLE', pageId(graph), {
      name: 'R',
      x: 100,
      y: 200,
      width: 50,
      height: 50
    })
    expect(graph.getAbsolutePosition(node.id)).toEqual({ x: 100, y: 200 })
  })

  test('nested translate: child at (10, 20) in frame at (100, 200) = (110, 220)', () => {
    const graph = new SceneGraph()
    const frame = graph.createNode('FRAME', pageId(graph), {
      name: 'F',
      x: 100,
      y: 200,
      width: 300,
      height: 300
    })
    const child = graph.createNode('RECTANGLE', frame.id, {
      name: 'C',
      x: 10,
      y: 20,
      width: 50,
      height: 50
    })
    expect(graph.getAbsolutePosition(child.id)).toEqual({ x: 110, y: 220 })
  })

  test('deeply nested: 3 levels of translation accumulate', () => {
    const graph = new SceneGraph()
    const f1 = graph.createNode('FRAME', pageId(graph), {
      name: 'F1',
      x: 10,
      y: 20,
      width: 200,
      height: 200
    })
    const f2 = graph.createNode('FRAME', f1.id, {
      name: 'F2',
      x: 30,
      y: 40,
      width: 100,
      height: 100
    })
    const leaf = graph.createNode('RECTANGLE', f2.id, {
      name: 'L',
      x: 5,
      y: 5,
      width: 10,
      height: 10
    })
    expect(graph.getAbsolutePosition(leaf.id)).toEqual({ x: 45, y: 65 })
  })

  test('rotated node: 90° rotation of 100x100 at (200, 200)', () => {
    const graph = new SceneGraph()
    const node = graph.createNode('RECTANGLE', pageId(graph), {
      name: 'R',
      x: 200,
      y: 200,
      width: 100,
      height: 100,
      rotation: 90
    })
    const absPos = graph.getAbsolutePosition(node.id)
    // For 90° rotation of 100x100: (0,0) maps through the rotation
    // pivot is (50, 50), rotate 90° around pivot: (0,0) -> (100, 0)
    // Then translate by (200, 200): (300, 200)
    expect(absPos.x).toBeCloseTo(300, 10)
    expect(absPos.y).toBeCloseTo(200, 10)
  })

  test('rotated node: 180° rotation maps origin to opposite corner', () => {
    const graph = new SceneGraph()
    const node = graph.createNode('RECTANGLE', pageId(graph), {
      name: 'R',
      x: 100,
      y: 100,
      width: 80,
      height: 60,
      rotation: 180
    })
    const absPos = graph.getAbsolutePosition(node.id)
    // 180° rotation: (0,0) rotated around (40, 30) → (80, 60)
    // Then translate by (100, 100): (180, 160)
    expect(absPos.x).toBeCloseTo(180, 10)
    expect(absPos.y).toBeCloseTo(160, 10)
  })

  test('flipX node: getAbsolutePosition returns mirrored origin', () => {
    const graph = new SceneGraph()
    const node = graph.createNode('RECTANGLE', pageId(graph), {
      name: 'R',
      x: 100,
      y: 200,
      width: 80,
      height: 60,
      flipX: true
    })
    const absPos = graph.getAbsolutePosition(node.id)
    // flipX at center (40, 30): (0,0) → (80, 0), then translate (100, 200) → (180, 200)
    expect(absPos.x).toBeCloseTo(180, 10)
    expect(absPos.y).toBeCloseTo(200, 10)
  })

  test('flipY node: getAbsolutePosition returns mirrored origin', () => {
    const graph = new SceneGraph()
    const node = graph.createNode('RECTANGLE', pageId(graph), {
      name: 'R',
      x: 100,
      y: 200,
      width: 80,
      height: 60,
      flipY: true
    })
    const absPos = graph.getAbsolutePosition(node.id)
    // flipY at center (40, 30): (0,0) → (0, 60), then translate (100, 200) → (100, 260)
    expect(absPos.x).toBeCloseTo(100, 10)
    expect(absPos.y).toBeCloseTo(260, 10)
  })

  test('child of rotated parent: position is in rotated parent space', () => {
    const graph = new SceneGraph()
    // Parent 100x100 at (0,0), rotated 90°
    const parent = graph.createNode('FRAME', pageId(graph), {
      name: 'P',
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      rotation: 90
    })
    // Child at (50, 0) in parent's local (rotated) space
    const child = graph.createNode('RECTANGLE', parent.id, {
      name: 'C',
      x: 50,
      y: 0,
      width: 10,
      height: 10
    })
    const absPos = graph.getAbsolutePosition(child.id)
    // Parent's world matrix: translate(0,0) * translate(50,50) * rotate(90°) * translate(-50,-50)
    // Child's local: translate(50, 0) * translate(5, 5) * translate(-5, -5) = translate(50, 0)
    // World = parent * child_local
    // Child origin (0,0) in child local → (50, 0) in parent local
    // Then through parent's rotation: (50, 0) → rotated around (50,50) by 90°
    // In parent local, the point is at (50, 0). After parent transform:
    // First translate(-50,-50): (50-50, 0-50) = (0, -50)
    // Then rotate 90°: (-(-50), 0) = (50, 0) ... let me compute properly
    // rot90°: x' = -y, y' = x, so (0, -50) → (50, 0)
    // Then translate(50, 50): (100, 50)
    // Then translate(0, 0): (100, 50)
    expect(absPos.x).toBeCloseTo(100, 8)
    expect(absPos.y).toBeCloseTo(50, 8)
  })
})

describe('world transform — getWorldMatrix center invariance', () => {
  test('center of node is invariant under rotation', () => {
    const graph = new SceneGraph()
    const node = graph.createNode('RECTANGLE', pageId(graph), {
      name: 'R',
      x: 100,
      y: 200,
      width: 80,
      height: 60,
      rotation: 45
    })
    const wmx = getWorldMatrix(node, graph)
    const center = TransformMatrix.mapPoints(wmx, [40, 30])
    // Center should always be at (100+40, 200+30) = (140, 230) regardless of rotation
    expect(center[0]).toBeCloseTo(140, 8)
    expect(center[1]).toBeCloseTo(230, 8)
  })

  test('center of flipX node is invariant', () => {
    const graph = new SceneGraph()
    const node = graph.createNode('RECTANGLE', pageId(graph), {
      name: 'R',
      x: 100,
      y: 200,
      width: 80,
      height: 60,
      flipX: true
    })
    const wmx = getWorldMatrix(node, graph)
    const center = TransformMatrix.mapPoints(wmx, [40, 30])
    expect(center[0]).toBeCloseTo(140, 8)
    expect(center[1]).toBeCloseTo(230, 8)
  })

  test('center of rotated+flipped node is invariant', () => {
    const graph = new SceneGraph()
    const node = graph.createNode('RECTANGLE', pageId(graph), {
      name: 'R',
      x: 300,
      y: 400,
      width: 100,
      height: 50,
      rotation: 30,
      flipX: true
    })
    const wmx = getWorldMatrix(node, graph)
    const center = TransformMatrix.mapPoints(wmx, [50, 25])
    expect(center[0]).toBeCloseTo(350, 8)
    expect(center[1]).toBeCloseTo(425, 8)
  })

  test('nested rotation: child center invariant through parent rotation', () => {
    const graph = new SceneGraph()
    const parent = graph.createNode('FRAME', pageId(graph), {
      name: 'P',
      x: 0,
      y: 0,
      width: 200,
      height: 200,
      rotation: 45
    })
    const child = graph.createNode('RECTANGLE', parent.id, {
      name: 'C',
      x: 50,
      y: 50,
      width: 60,
      height: 40
    })
    // Child center in parent local space: (50+30, 50+20) = (80, 70)
    // Parent center: (100, 100)
    // Through parent rotation of 45° around (100, 100):
    // Point (80, 70) relative to parent center: (-20, -30)
    // Rotated 45°: x' = -20*cos45 - (-30)*sin45 = -20*0.707 + 30*0.707 = 10*0.707 = 7.07
    //              y' = -20*sin45 + (-30)*cos45 = -20*0.707 - 30*0.707 = -50*0.707 = -35.35
    // Back to world: (100 + 7.07, 100 - 35.35) = (107.07, 64.65)
    const wmx = getWorldMatrix(child, graph)
    const childCenter = TransformMatrix.mapPoints(wmx, [30, 20])
    expect(childCenter[0]).toBeCloseTo(107.07, 1)
    expect(childCenter[1]).toBeCloseTo(64.65, 1)
  })
})

describe('world transform — corner mapping', () => {
  test('all four corners of unrotated node map correctly', () => {
    const graph = new SceneGraph()
    const node = graph.createNode('RECTANGLE', pageId(graph), {
      name: 'R',
      x: 100,
      y: 200,
      width: 80,
      height: 60
    })
    const wmx = getWorldMatrix(node, graph)
    const corners = TransformMatrix.mapPoints(wmx, [0, 0, 80, 0, 80, 60, 0, 60])
    // TL: (100, 200), TR: (180, 200), BR: (180, 260), BL: (100, 260)
    expect(corners[0]).toBeCloseTo(100, 10)
    expect(corners[1]).toBeCloseTo(200, 10)
    expect(corners[2]).toBeCloseTo(180, 10)
    expect(corners[3]).toBeCloseTo(200, 10)
    expect(corners[4]).toBeCloseTo(180, 10)
    expect(corners[5]).toBeCloseTo(260, 10)
    expect(corners[6]).toBeCloseTo(100, 10)
    expect(corners[7]).toBeCloseTo(260, 10)
  })

  test('all four corners of 90° rotated node map correctly', () => {
    const graph = new SceneGraph()
    // 80x60 node at (100, 100), rotated 90° around center (40, 30)
    const node = graph.createNode('RECTANGLE', pageId(graph), {
      name: 'R',
      x: 100,
      y: 100,
      width: 80,
      height: 60,
      rotation: 90
    })
    const wmx = getWorldMatrix(node, graph)

    // Origin (0,0) through 90° rotation around (40,30):
    // translate(-40,-30): (-40, -30), rotate 90°: (30, -40), translate(40,30): (70, -10)
    // then translate(100, 100): (170, 90)
    const origin = TransformMatrix.mapPoints(wmx, [0, 0])
    expect(origin[0]).toBeCloseTo(170, 8)
    expect(origin[1]).toBeCloseTo(90, 8)

    // (80, 60) through same rotation around (40,30):
    // translate(-40,-30): (40, 30), rotate 90°: (-30, 40), translate(40,30): (10, 70)
    // then translate(100, 100): (110, 170)
    const opposite = TransformMatrix.mapPoints(wmx, [80, 60])
    expect(opposite[0]).toBeCloseTo(110, 8)
    expect(opposite[1]).toBeCloseTo(170, 8)
  })
})
