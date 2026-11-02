import { getCanvasKit } from '@open-pencil/core/canvaskit'

import { installCanvasKitBinary } from '@/app/editor/canvas/canvaskit'
import { installBundledFonts } from '@/app/editor/fonts/bundled'

/**
 * The landing installs the app's emitted CanvasKit binary and fonts, so Vite serves both in
 * development and emits them with the build.
 */
let ready: Promise<void> | null = null

/** Loads CanvasKit from the emitted binary. Stages await it before mounting a canvas. */
export function prepareEngine(): Promise<void> {
  if (ready) return ready
  const request = (async () => {
    installBundledFonts()
    installCanvasKitBinary()
    await getCanvasKit()
  })()
  // A failed download is tried again by the next stage rather than shared.
  request.catch(() => {
    if (ready === request) ready = null
  })
  ready = request
  return request
}
