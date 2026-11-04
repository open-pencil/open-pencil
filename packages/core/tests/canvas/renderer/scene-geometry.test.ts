import { afterAll, expect, test } from 'bun:test'

import { expectDefined } from '#core-tests/helpers/assert'

import { SkiaRenderer } from '@open-pencil/core/canvas'
import { initCanvasKit } from '@open-pencil/core/io/formats/raster'
import { SceneGraph } from '@open-pencil/scene-graph'

const ck = await initCanvasKit()
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
