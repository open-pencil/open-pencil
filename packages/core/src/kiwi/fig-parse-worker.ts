import { parseFigBuffer } from './fig-parse-core'

export type { FigParseResult } from './fig-parse-core'

self.onmessage = (e: MessageEvent<ArrayBuffer>) => {
  try {
    self.postMessage(parseFigBuffer(e.data))
  } catch (err) {
    self.postMessage({ error: err instanceof Error ? err.message : String(err) })
  }
}
