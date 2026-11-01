import { afterAll, expect, spyOn, test } from 'bun:test'

import { expectDefined } from '#core-tests/helpers/assert'

import { SkiaRenderer } from '@open-pencil/core/canvas'
import { initCanvasKit } from '@open-pencil/core/io/formats/raster'
import { fontManager } from '@open-pencil/core/text'
import { SceneGraph } from '@open-pencil/scene-graph'

const ck = await initCanvasKit()
const renderer = new SkiaRenderer(ck, expectDefined(ck.MakeSurface(8, 8), 'surface'))

afterAll(() => renderer.destroy())

test('forgetting a layer drops the fonts it was waiting for and its text picture state', () => {
  const graph = new SceneGraph()
  const page = expectDefined(graph.getPages()[0], 'page')
  const node = graph.createNode('TEXT', page.id, { text: 'hello' })
  renderer.trackFontDemand(node, 'Inter|400')
  renderer.textFonts.pictureGenerations.set(node.id, { data: new Uint8Array(1), generation: 0 })
  expect(renderer.textFonts.pending.has(node.id)).toBe(true)

  renderer.forgetNode(node.id)

  expect(renderer.textFonts.pending.has(node.id)).toBe(false)
  expect(renderer.textFonts.pictureGenerations.has(node.id)).toBe(false)
})

test("a text's font readiness is found once per layer until the layer or the fonts change", async () => {
  // A loaded face reads as ready; a pending reading is asked again each frame and not kept.
  await fontManager.markLoaded('Inter', 'Regular', new ArrayBuffer(8), 'bundled')
  const graph = new SceneGraph()
  const page = expectDefined(graph.getPages()[0], 'page')
  const node = expectDefined(
    graph.getNode(graph.createNode('TEXT', page.id, { text: 'hello' }).id),
    'text'
  )
  // A reading that is found again is not decided again: the memo is written once.
  const written = spyOn(renderer.textFonts.readiness, 'set')
  const first = renderer.nodeFontReadiness(node)
  expect(renderer.textFonts.readiness.get(node.id)?.readiness).toBe(first)
  expect(renderer.nodeFontReadiness(node)).toBe(first)
  expect(written).toHaveBeenCalledTimes(1)

  // A change to the layer drops the memo; the next frame decides again.
  renderer.invalidateNodePicture(node.id)
  expect(renderer.textFonts.readiness.has(node.id)).toBe(false)
  expect(renderer.nodeFontReadiness(node)).toBe(first)

  // So does a layer object replaced by an edit, and a font generation that moved on.
  graph.updateNode(node.id, { text: 'hello there' })
  const edited = expectDefined(graph.getNode(node.id), 'edited')
  renderer.nodeFontReadiness(edited)
  expect(renderer.textFonts.readiness.get(node.id)?.node).toBe(edited)
  renderer.fontGeneration += 1
  renderer.nodeFontReadiness(edited)
  expect(renderer.textFonts.readiness.get(node.id)?.generation).toBe(renderer.fontGeneration)
})
