import { expect, test } from 'bun:test'

import { SceneGraph } from '@open-pencil/scene-graph'
import Matrix from '@open-pencil/scene-graph/matrix'

import { createSceneGeometry, nodeOrientationMatrix } from '#core/geometry'

import { expectDefined } from '#tests/helpers/assert'
import { applyFixtureTransform, nestedGeometryFixture } from '#tests/helpers/geometry'

for (const flipX of [false, true]) {
  for (const flipY of [false, true]) {
    test(`nested world, screen and inverse transforms agree (flipX=${flipX}, flipY=${flipY})`, () => {
      const graph = new SceneGraph()
      const page = expectDefined(graph.getPages()[0], 'page')
      const { section, frame } = nestedGeometryFixture(graph, page.id, flipX, flipY)
      const geometry = createSceneGeometry(graph)
      const viewport = { panX: 137.25, panY: -89.75, zoom: 1.75 }
      for (const point of [
        { x: 0, y: 0 },
        { x: 220, y: 120 },
        { x: 110, y: -24 }
      ]) {
        const expected = applyFixtureTransform(section, applyFixtureTransform(frame, point))
        const world = geometry.toWorld(frame, point)
        expect(world.x).toBeCloseTo(expected.x, 9)
        expect(world.y).toBeCloseTo(expected.y, 9)
        const screen = geometry.toScreen(frame, point, viewport)
        expect(screen.x).toBeCloseTo(expected.x * viewport.zoom + viewport.panX, 9)
        expect(screen.y).toBeCloseTo(expected.y * viewport.zoom + viewport.panY, 9)
        const local = expectDefined(geometry.screenToLocal(frame, screen, viewport), 'local point')
        expect(local.x).toBeCloseTo(point.x, 9)
        expect(local.y).toBeCloseTo(point.y, 9)
      }
      expect(geometry.screenToLocal(frame, { x: 0, y: 0 }, { ...viewport, zoom: 0 })).toBeNull()
    })
  }
}

test('ancestor previews resolve equally for geometry, cancellation and committed transforms', () => {
  const graph = new SceneGraph()
  const page = expectDefined(graph.getPages()[0], 'page')
  const { section, frame } = nestedGeometryFixture(graph, page.id, true, true)
  const original = createSceneGeometry(graph).worldMatrix(frame)
  const preview = createSceneGeometry(graph, { nodeId: section.id, angle: -70 })
  const held = preview.worldMatrix(frame)
  expect(held).not.toEqual(original)
  expect(section.rotation).toBe(25)
  expect(createSceneGeometry(graph, null).worldMatrix(frame)).toEqual(original)
  const composed = Matrix.multiply(preview.localMatrix(section), preview.localMatrix(frame))
  for (const [index, value] of held.entries()) expect(composed[index]).toBeCloseTo(value, 9)
  graph.updateNode(section.id, { rotation: -70 })
  expect(createSceneGeometry(graph).worldMatrix(frame)).toEqual(held)
})

test('scene drawing and geometry share each node type’s pivot', () => {
  const graph = new SceneGraph()
  const page = expectDefined(graph.getPages()[0], 'page')
  for (const type of ['LINE', 'RECTANGLE', 'FRAME'] as const) {
    const node = graph.createNode(type, page.id, {
      x: 100,
      y: 200,
      width: 220,
      height: 40,
      rotation: 35,
      flipX: true
    })
    const geometry = createSceneGeometry(graph)
    const drawn = Matrix.multiply(Matrix.translated(node.x, node.y), nodeOrientationMatrix(node))
    const expected = geometry.worldMatrix(node)
    for (const [index, value] of expected.entries()) expect(drawn[index]).toBeCloseTo(value, 9)
  }
})
