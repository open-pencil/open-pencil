/**
 * Rotated nodes must survive an export → reimport with their world position
 * intact. computeExportTransform (serialize.ts) encodes the .fig transform and
 * must be the exact inverse of the import decode (convert.ts), which treats an
 * unflipped rotation as about the node CENTER. A prior AABB-min-corner encode
 * only matched the rotation==0 / flipped branch, so every rotated node drifted
 * on reimport (and a rotated text-on-path sticker slid out of its frame clip).
 */
import { describe, expect, test } from 'bun:test'

import { SceneGraph } from '@open-pencil/scene-graph'
import type { SceneNode } from '@open-pencil/scene-graph'
import { getWorldMatrix } from '@open-pencil/scene-graph/coordinate'
import Matrix from '@open-pencil/scene-graph/matrix'

import { exportFigFile } from '#core/io/formats/fig/export'
import { parseFigFile } from '#core/io/formats/fig/read'

import { loadFigFixture, readFigFixture } from '#tests/helpers/fig-fixtures'

function worldCorners(graph: SceneGraph, name: string) {
  const node = [...graph.getAllNodes()].find((n) => n.name === name)
  if (!node) throw new Error(`node ${name} not found`)
  const m = getWorldMatrix(node, graph)
  return Matrix.mapPoints(m, [0, 0, node.width, 0, node.width, node.height, 0, node.height])
}

async function roundTrip(graph: SceneGraph) {
  const out = await exportFigFile(graph)
  const ab = out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength) as ArrayBuffer
  return parseFigFile(ab)
}

describe('rotated node transform round-trip', () => {
  test.each([0, 30, -45, 90, 137])('rotation %i° keeps world corners', async (rotation) => {
    const graph = new SceneGraph()
    graph.createNode('RECTANGLE', graph.getPages()[0].id, {
      name: 'R',
      x: 100,
      y: 200,
      width: 300,
      height: 150,
      rotation
    })
    const before = worldCorners(graph, 'R')
    const after = worldCorners(await roundTrip(graph), 'R')
    for (let i = 0; i < before.length; i++) {
      expect(after[i]).toBeCloseTo(before[i], 2)
    }
  })

  test('rotated + off-origin node round-trips', async () => {
    const graph = new SceneGraph()
    graph.createNode('RECTANGLE', graph.getPages()[0].id, {
      name: 'R',
      x: -37.5,
      y: 412.9,
      width: 88,
      height: 220,
      rotation: 62
    })
    const before = worldCorners(graph, 'R')
    const after = worldCorners(await roundTrip(graph), 'R')
    for (let i = 0; i < before.length; i++) {
      expect(after[i]).toBeCloseTo(before[i], 2)
    }
  })
})

// Real imported text-on-path (with stroke silhouettes + an expanded layout box)
// exercises all three coupled fixes: the transform pivot, size/transform pairing
// (exportNodeSize), and the edited-path-text strip (raw glyphs/silhouettes are
// rebuilt from the shifted graph glyphs). Editing one — rotate OR move — used to
// slide it out of its frame clip on reimport.
const CIRCLE_TEXT = 'tests/fixtures/circle-text.fig'
// Skip *visibly* when the LFS fixture isn't fetched (contributor checkout). A
// helper early-return would let Bun report these as passed with 0 assertions.
const describeWithFixture = readFigFixture(CIRCLE_TEXT) ? describe : describe.skip

function glyphWorld(graph: SceneGraph) {
  const node = [...graph.getAllNodes()].find((n) => n.name === 'ArnoCoenen.art')
  if (!node?.figmaDerivedTextGlyphs) throw new Error('path-text node not found')
  const m = getWorldMatrix(node, graph)
  return node.figmaDerivedTextGlyphs.map((g) => Matrix.mapPoints(m, [g.x, g.y]))
}

async function assertEditKeepsGlyphs(edit: (node: SceneNode) => Partial<SceneNode>) {
  const graph = await loadFigFixture(CIRCLE_TEXT)
  if (!graph) throw new Error('circle-text.fig fixture unavailable')
  const node = [...graph.getAllNodes()].find((n) => n.name === 'ArnoCoenen.art')
  if (!node) throw new Error('node missing')
  graph.updateNode(node.id, edit(node))
  const before = glyphWorld(graph)
  const after = glyphWorld(await roundTrip(graph))
  let maxDrift = 0
  for (let i = 0; i < before.length; i++) {
    maxDrift = Math.max(
      maxDrift,
      Math.hypot(after[i][0] - before[i][0], after[i][1] - before[i][1])
    )
  }
  expect(maxDrift).toBeLessThan(0.05)
}

describeWithFixture('edited imported text-on-path round-trip', () => {
  test.each([0, 30, -55, 90])('rotation %i° keeps glyph world positions', async (rotation) => {
    await assertEditKeepsGlyphs(() => ({ rotation }))
  })

  test('move (rotation 0) keeps glyph world positions', async () => {
    await assertEditKeepsGlyphs((node) => ({ x: node.x + 120, y: node.y - 45 }))
  })
})
