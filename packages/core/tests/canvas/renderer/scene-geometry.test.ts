import { afterAll, expect, test } from 'bun:test'

import { SkiaRenderer } from '@open-pencil/core/canvas'
import { getCanvasKit } from '@open-pencil/core/canvaskit'
import { SceneGraph } from '@open-pencil/scene-graph'
import { expectDefined } from '@open-pencil/test-support/assert'

const ck = await getCanvasKit()
const renderer = new SkiaRenderer(ck, expectDefined(ck.MakeSurface(8, 8), 'surface'))

afterAll(() => renderer.destroy())

test('one scene geometry serves a frame and the next frame starts afresh', () => {
  const graph = new SceneGraph()
  const geometry = renderer.sceneGeometry(graph, null)
  expect(renderer.sceneGeometry(graph, null)).toBe(geometry)
  expect(renderer.sceneGeometry(new SceneGraph(), null)).not.toBe(geometry)
  renderer.frameGeometry = null
  expect(renderer.sceneGeometry(graph, null)).not.toBe(geometry)
})
