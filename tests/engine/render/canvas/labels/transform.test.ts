import { expect, test } from 'bun:test'

import type { Font } from 'canvaskit-wasm'

import { SceneGraph } from '@open-pencil/scene-graph'

import { LabelCache } from '#core/canvas/labels/cache'
import { hitTestSectionTitle, hitTestFrameTitle } from '#core/canvas/labels/hit-test'
import { frameLabelPlacement, labelTransform } from '#core/canvas/labels/transform'
import { createSceneGeometry } from '#core/geometry'

import { expectDefined } from '#tests/helpers/assert'

function fixture() {
  const graph = new SceneGraph()
  const page = expectDefined(graph.getPages()[0], 'page')
  const section = graph.createNode('SECTION', page.id, {
    name: 'Section',
    x: 100,
    y: 100,
    width: 200,
    height: 100
  })
  const frame = graph.createNode('FRAME', section.id, {
    name: 'Frame',
    x: 20,
    y: 30,
    width: 80,
    height: 40
  })
  return { graph, page, section, frame }
}

const font = {
  getGlyphIDs(text: string) {
    return Uint16Array.from([...text].map((_, i) => i))
  },
  getGlyphWidths(ids: Uint16Array) {
    return new Float32Array(ids.length).fill(8)
  }
} as Font

test('label origins and edge anchors include a live ancestor rotation without mutating nodes', () => {
  const { graph, section, frame } = fixture()
  const preview = { nodeId: section.id, angle: 90 }
  const title = labelTransform(frame, graph, preview)
  expect(title.x).toBeCloseTo(220)
  expect(title.y).toBeCloseTo(70)
  expect(title.rotation).toBe(90)
  const bottom = labelTransform(frame, graph, preview, { x: frame.width / 2, y: frame.height })
  expect(bottom.x).toBeCloseTo(180)
  expect(bottom.y).toBeCloseTo(110)
  expect(section.rotation).toBe(0)
  expect(frame.rotation).toBe(0)
  const bounds = createSceneGeometry(graph, preview).bounds(frame)
  graph.updateNode(section.id, { rotation: 90 })
  expect(labelTransform(frame, graph, null)).toEqual(title)
  expect(createSceneGeometry(graph, null).bounds(frame)).toEqual(bounds)
})

for (const [angle, rotation, width, height] of [
  [40, 40, 80, 40],
  [50, -40, 40, 80],
  [140, -40, 80, 40],
  [-145, 35, 80, 40],
  [180, 0, 80, 40]
] as const) {
  test(`frame labels choose readable opposite edges at ${angle} degrees`, () => {
    const { graph, frame } = fixture()
    graph.updateNode(frame.id, { rotation: angle })
    const title = frameLabelPlacement(frame, graph, null)
    const size = frameLabelPlacement(frame, graph, null, { x: 0.5, y: 1 })
    expect(title.rotation).toBeCloseTo(rotation, 9)
    expect(title.width).toBe(width)
    expect(title.height).toBe(height)
    const radians = (rotation * Math.PI) / 180
    const dx = size.x - title.x
    const dy = size.y - title.y
    expect(dx * Math.cos(radians) + dy * Math.sin(radians)).toBeCloseTo(width / 2, 9)
    expect(-dx * Math.sin(radians) + dy * Math.cos(radians)).toBeCloseTo(height, 9)
  })
}

test('readability thresholds use identical edges during preview and after commit', () => {
  for (const angle of [-135, -45, 45, 135]) {
    const { graph, frame } = fixture()
    const preview = frameLabelPlacement(frame, graph, { nodeId: frame.id, angle })
    graph.updateNode(frame.id, { rotation: angle })
    expect(frameLabelPlacement(frame, graph, null)).toEqual(preview)
  }
})

test('section culling uses preview world bounds rather than cached unrotated coordinates', () => {
  const { graph, page, section } = fixture()
  const cache = new LabelCache()
  cache.update(graph, page.id, 1)
  const viewport = { x: 215, y: 65, w: 10, h: 10 }
  expect(cache.getSections(graph, viewport)).toHaveLength(0)
  expect(
    cache.getSections(graph, viewport, { nodeId: section.id, angle: 90 }).map(({ node }) => node.id)
  ).toEqual([section.id])
})

test('section and nested frame hit targets follow their rendered title transforms', () => {
  const { graph, page, section, frame } = fixture()
  graph.updateNode(section.id, { rotation: 90 })
  const cache = new LabelCache()
  cache.update(graph, page.id, 1)
  // Section title local point (4, -10), transformed through its top-left (250, 50).
  for (const catalog of [undefined, cache]) {
    expect(hitTestSectionTitle(graph, 260, 54, 1, page.id, font, catalog)?.id).toBe(section.id)
  }
  // The readable frame title moves to the horizontal edge at (180, 70).
  expect(hitTestFrameTitle(graph, 184, 60, 1, new Set([frame.id]), font)?.id).toBe(frame.id)
  expect(hitTestFrameTitle(graph, 230, 74, 1, new Set([frame.id]), font)).toBeNull()
})
