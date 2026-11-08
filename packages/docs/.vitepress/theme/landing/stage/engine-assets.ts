import { getCanvasKit } from '@open-pencil/core/canvaskit'

// The app's module that points Core at the files the openPencil() Vite plugin serves.
import '@/app/editor/canvas/canvaskit'
import { registerInterfaceFont } from '@/app/editor/fonts/interface'

let ready: Promise<void> | null = null

/** Loads CanvasKit from the emitted binary. Stages await it before mounting a canvas. */
export function prepareEngine(): Promise<void> {
  if (ready) return ready
  const request = (async () => {
    registerInterfaceFont()
    await getCanvasKit()
  })()
  // A failed download is tried again by the next stage rather than shared.
  request.catch(() => {
    if (ready === request) ready = null
  })
  ready = request
  return request
}
