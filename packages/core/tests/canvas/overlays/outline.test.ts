import { afterAll, expect, test } from 'bun:test'

import { expectDefined } from '#core-tests/helpers/assert'

import { SkiaRenderer } from '@open-pencil/core/canvas'
import { initCanvasKit } from '@open-pencil/core/io/formats/raster'

import { dashEffect, withScreenStroke } from '#core/canvas/overlays/outline'

const ck = await initCanvasKit()
const renderer = new SkiaRenderer(ck, expectDefined(ck.MakeSurface(8, 8), 'surface'))

afterAll(() => renderer.destroy())

test('a screen stroke reuses its dash across frames at one zoom and makes another per zoom', () => {
  renderer.zoom = 1
  const draw = () => withScreenStroke(renderer, { color: ck.BLACK, dash: [4, 2] }, () => undefined)
  draw()
  draw()
  expect(renderer.dashEffects.size).toBe(1)
  const first = dashEffect(renderer, 4, 2)
  expect(dashEffect(renderer, 4, 2)).toBe(first)
  renderer.zoom = 2
  draw()
  expect(renderer.dashEffects.size).toBe(2)
})
