import { expect, test } from 'bun:test'

import { getCanvasKit } from '#core/canvaskit'
import { initCanvasKit } from '#core/io/formats/raster'

test('headless export draws with the process’s one CanvasKit, the one Core loads', async () => {
  // In an app, a document without a canvas exports through the headless renderer; it must use the
  // CanvasKit the app loaded, from the files the app serves, not load another one of its own.
  expect(await initCanvasKit()).toBe(await getCanvasKit())
})
