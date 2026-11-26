import { expect, spyOn, test } from 'bun:test'

import { expectDefined } from '@open-pencil/test-support/assert'

import { createOffscreenRenderer, withOffscreenRenderer, type SkiaRenderer } from '#core/canvas'
import { getCanvasKit } from '#core/canvaskit'

const ck = await getCanvasKit()

test('an offscreen renderer draws on a 1×1 surface with its fonts loaded', async () => {
  const renderer = expectDefined(await createOffscreenRenderer(ck), 'renderer')
  try {
    expect([renderer.surface.width(), renderer.surface.height()]).toEqual([1, 1])
    expect(renderer.fontsLoaded).toBe(true)
  } finally {
    renderer.destroy()
  }
})

test('withOffscreenRenderer destroys the renderer when the job resolves or rejects', async () => {
  let resolved: SkiaRenderer | undefined
  expect(
    await withOffscreenRenderer(ck, async (renderer) => {
      resolved = renderer
      return 'drawn'
    })
  ).toBe('drawn')
  expect(expectDefined(resolved, 'renderer').isDestroyed()).toBe(true)

  let rejected: SkiaRenderer | undefined
  const failing = withOffscreenRenderer(ck, async (renderer) => {
    rejected = renderer
    throw new Error('draw failed')
  })
  await expect(failing).rejects.toThrow('draw failed')
  expect(expectDefined(rejected, 'renderer').isDestroyed()).toBe(true)
})

test('an offscreen renderer is null when CanvasKit cannot make its surface', async () => {
  const makeSurface = spyOn(ck, 'MakeSurface').mockReturnValue(null)
  try {
    expect(await createOffscreenRenderer(ck)).toBeNull()
    expect(await withOffscreenRenderer(ck, async () => 'drawn')).toBeNull()
  } finally {
    makeSurface.mockRestore()
  }
})
