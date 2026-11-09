import { buildFigCanvas, type FigCanvasParts } from './compress'

/** The compressed `canvas.fig`, or why it failed: a rejected handler would never reach `onerror`. */
export type CompressResult = Uint8Array | { error: string }

self.onmessage = async (event: MessageEvent<FigCanvasParts>) => {
  try {
    const canvas = await buildFigCanvas(event.data)
    self.postMessage(canvas, { transfer: [canvas.buffer] })
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : String(error) })
  }
}
