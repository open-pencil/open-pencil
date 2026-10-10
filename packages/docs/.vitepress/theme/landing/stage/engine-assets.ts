import canvasKitWasm from 'canvaskit-wasm/bin/canvaskit.wasm?url'

/// <reference types="vite/client" />
import { getCanvasKit } from '@open-pencil/core/canvaskit'

import { installBundledFonts } from '@/app/editor/fonts/bundled'

/**
 * Core expects CanvasKit's binary at the site root, which the app arranges by copying it
 * into `public/`. The landing imports it as an asset instead, and fonts come through the
 * app's own `installBundledFonts()`, so Vite serves both in development and emits them with
 * the build.
 */
let ready: Promise<void> | null = null

/** Loads CanvasKit from the emitted binary. Stages await it before mounting a canvas. */
export function prepareEngine(): Promise<void> {
  ready ??= (async () => {
    installBundledFonts()
    await getCanvasKit({ locateFile: () => canvasKitWasm })
  })()
  return ready
}
