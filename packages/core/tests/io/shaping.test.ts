import { beforeAll, expect, test } from 'bun:test'

import { expectDefined } from '#core-tests/helpers/assert'
import type { TypefaceFontProvider } from 'canvaskit-wasm'

import { SceneGraph } from '@open-pencil/scene-graph'

import { getCanvasKit } from '#core/canvaskit'
import { withTextShaper } from '#core/io/shaping'
import { fontManager } from '#core/text/font/manager'

beforeAll(async () => {
  const inter = expectDefined(
    await fontManager.fetchBundledFont('/InterVariable.ttf'),
    'bundled Inter font'
  )
  await fontManager.markLoaded('Inter', 'Regular', inter)
})

test('overlapping shaping calls share their provider until the last one finishes', async () => {
  const ck = await getCanvasKit()
  // Providers other tests left attached are set aside, so the calls make one of their own.
  const setAside: TypefaceFontProvider[] = []
  for (
    let provider = fontManager.providerFor(ck);
    provider;
    provider = fontManager.providerFor(ck)
  ) {
    setAside.push(provider)
    fontManager.detachProvider(provider)
  }
  try {
    const graph = new SceneGraph()
    const node = graph.createNode('TEXT', graph.getPages()[0].id, {
      text: 'Shaped',
      fontFamily: 'Inter',
      fontSize: 13
    })
    const firstHeld = Promise.withResolvers<undefined>()
    const secondHeld = Promise.withResolvers<undefined>()

    const first = withTextShaper(ck, () => firstHeld.promise)
    const second = withTextShaper(ck, async (shape) => {
      await secondHeld.promise
      return shape(node)
    })
    firstHeld.resolve(undefined)
    await first
    secondHeld.resolve(undefined)

    expect((await second)?.baselines).toHaveLength(1)
    expect(fontManager.providerFor(ck)).toBeNull()
  } finally {
    for (const provider of setAside.toReversed()) fontManager.attachProvider(ck, provider)
  }
})
