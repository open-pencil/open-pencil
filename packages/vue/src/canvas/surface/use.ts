import type { CanvasKit } from 'canvaskit-wasm'
import type { Ref } from 'vue'

import type { Editor } from '@open-pencil/core/editor'

import {
  createCanvasSurfaceManager,
  useCanvasSurfaceLifecycle
} from '#vue/canvas/surface/lifecycle'
import { createCanvasHitTests, createRulerVisibility } from '#vue/canvas/surface/overlays'
import type { UseCanvasOptions } from '#vue/canvas/surface/types'

export type { UseCanvasOptions } from '#vue/canvas/surface/types'

/**
 * Connects an OpenPencil editor to a real canvas element using CanvasKit.
 *
 * This composable owns renderer creation, surface recreation on resize,
 * render scheduling, and renderer-backed hit testing helpers used by higher-
 * level canvas interaction code.
 */
export function useCanvas(
  canvasRef: Ref<HTMLCanvasElement | null>,
  editor: Editor,
  options?: UseCanvasOptions
) {
  let ck: CanvasKit | null = null
  const lifecycle: { destroyed: boolean } = { destroyed: false }
  const isDestroyed = () => lifecycle.destroyed
  const shouldShowRulers = createRulerVisibility(options)

  const surface = createCanvasSurfaceManager({
    editor,
    canvasRef,
    options,
    getCanvasKit: () => ck,
    isDestroyed,
    shouldShowRulers
  })

  useCanvasSurfaceLifecycle({
    canvasRef,
    surface,
    lifecycle,
    getCanvasKitValue: () => ck,
    setCanvasKit: (value) => {
      ck = value
    },
    onReady: options?.onReady
  })

  const { hitTestSectionTitle, hitTestComponentLabel, hitTestFrameTitle } = createCanvasHitTests(
    editor,
    surface.getRenderer
  )

  return {
    render: surface.markDirty,
    renderNow: surface.renderNow,
    hitTestSectionTitle,
    hitTestComponentLabel,
    hitTestFrameTitle
  }
}
