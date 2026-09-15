import { expect, test } from 'bun:test'

import type { Font } from 'canvaskit-wasm'

import { SceneGraph } from '@open-pencil/scene-graph'
import Matrix from '@open-pencil/scene-graph/matrix'

import { hitTestComponentLabel, hitTestFrameTitle } from '#core/canvas/labels/hit-test'
import { labelLayout } from '#core/canvas/labels/layout'
import {
  frameLabelPlacement,
  labelLocalPoint,
  labelScreenMatrix
} from '#core/canvas/labels/transform'
import { createSceneGeometry } from '#core/geometry'

import { expectDefined } from '#tests/helpers/assert'
import { nestedGeometryFixture } from '#tests/helpers/geometry'

const font = {
  getGlyphIDs(text: string) {
    return Uint16Array.from([...text].map((_, i) => i))
  },
  getGlyphWidths(ids: Uint16Array) {
    return new Float32Array(ids.length).fill(8)
  }
} as Font

test('layout bounds include clipped text, padding and the entire component icon', () => {
  const section = expectDefined(
    labelLayout('section', 60, false, { width: 100, height: 14 }),
    'section layout'
  )
  expect(section.bounds).toEqual({ x: 0, y: -30, width: 60, height: 24 })
  expect(section.text).toEqual({ x: 6, y: -25 })
  expect(section.maxTextWidth).toBe(48)
  const nested = expectDefined(
    labelLayout('section', 60, true, { width: 100, height: 14 }),
    'nested section layout'
  )
  expect(nested.bounds).toEqual({ x: 6, y: 6, width: 54, height: 24 })
  expect(nested.text).toEqual({ x: 12, y: 11 })
  expect(nested.maxTextWidth).toBe(42)
  expect(nested.fontWeight).toBe(600)
  const component = expectDefined(
    labelLayout('component', 80, false, { width: 100, height: 11 }),
    'component layout'
  )
  const icon = expectDefined(component.icon, 'icon')
  expect(component.bounds.width).toBe(80)
  expect(component.bounds.y + component.bounds.height).toBeGreaterThanOrEqual(icon.y + icon.height)
  expect(labelLayout('component', 10)).toBeNull()
})

for (const flipX of [false, true]) {
  for (const flipY of [false, true]) {
    test(`label placement stays outside reflected bounds and shares its inverse (flipX=${flipX}, flipY=${flipY})`, () => {
      const graph = new SceneGraph()
      const page = expectDefined(graph.getPages()[0], 'page')
      const { section, frame } = nestedGeometryFixture(graph, page.id, flipX, flipY)
      const preview = { nodeId: section.id, angle: 70 }
      const transform = frameLabelPlacement(frame, graph, preview)
      const screen = Matrix.mapPoint(labelScreenMatrix(transform, { panX: 0, panY: 0, zoom: 2 }), {
        x: 4,
        y: -10
      })
      const world = { x: screen.x / 2, y: screen.y / 2 }
      const local = expectDefined(labelLocalPoint(transform, 2, world), 'label-local point')
      expect(local.x).toBeCloseTo(4, 9)
      expect(local.y).toBeCloseTo(-10, 9)
      const nodeLocal = expectDefined(
        createSceneGeometry(graph, preview).toLocal(frame, world),
        'node-local point'
      )
      expect(
        nodeLocal.x < 0 ||
          nodeLocal.x > frame.width ||
          nodeLocal.y < 0 ||
          nodeLocal.y > frame.height
      ).toBe(true)
      expect(transform.rotation).toBeGreaterThanOrEqual(-45)
      expect(transform.rotation).toBeLessThan(45)
      expect(
        hitTestFrameTitle(graph, world.x, world.y, 2, new Set([frame.id]), font, { preview })?.id
      ).toBe(frame.id)
    })
  }
}

test('hidden component labels and the clipped-away part of long titles are not hit targets', () => {
  const graph = new SceneGraph()
  const page = expectDefined(graph.getPages()[0], 'page')
  const frame = graph.createNode('FRAME', page.id, {
    name: 'A very long title that is clipped',
    x: 100,
    y: 100,
    width: 50,
    height: 100
  })
  expect(hitTestFrameTitle(graph, 140, 90, 1, new Set([frame.id]), font)?.id).toBe(frame.id)
  expect(hitTestFrameTitle(graph, 170, 90, 1, new Set([frame.id]), font)).toBeNull()
  graph.createNode('COMPONENT', frame.id, { name: 'Not drawn here', width: 80, height: 40 })
  expect(hitTestComponentLabel(graph, 104, 90, 1, page.id, font)).toBeNull()
})
