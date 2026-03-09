import { parseFigFile } from './fig-file'
import { computeAllLayouts } from '../layout'
import { getFigParseProfile, clearFigParseProfile } from './fig-parse-profile'

type WorkerInput = ArrayBuffer | { buffer: ArrayBuffer; profile?: boolean }

self.onmessage = async (e: MessageEvent<WorkerInput>) => {
  const input = e.data
  const buffer = input instanceof ArrayBuffer ? input : input.buffer
  const profile = typeof input === 'object' && input !== null && 'profile' in input && input.profile

  if (profile) {
    ;(globalThis as unknown as { __FIG_PARSE_PROFILE__: boolean }).__FIG_PARSE_PROFILE__ = true
    clearFigParseProfile()
  }

  try {
    const graph = await parseFigFile(buffer)
    const tLayout = performance.now()
    computeAllLayouts(graph)
    if (profile) {
      const layoutMs = performance.now() - tLayout
      getFigParseProfile().push({ stage: '5_computeAllLayouts', ms: layoutMs })
    }

    const data = {
      nodes: [...graph.nodes.entries()],
      images: [...graph.images.entries()],
      variables: [...graph.variables.entries()],
      variableCollections: [...graph.variableCollections.entries()],
      activeMode: [...graph.activeMode.entries()],
      rootId: graph.rootId
    }

    const transferables: Transferable[] = []
    const seen = new Set<ArrayBuffer>()
    for (const [, bytes] of data.images) {
      const buf = bytes.buffer as ArrayBuffer
      if (!seen.has(buf)) {
        seen.add(buf)
        transferables.push(buf)
      }
    }

    const payload: { type: 'success'; data: typeof data; profile?: Array<{ stage: string; ms: number }> } = {
      type: 'success',
      data
    }
    if (profile) {
      payload.profile = getFigParseProfile()
    }
    self.postMessage(payload, { transfer: transferables })
  } catch (err) {
    self.postMessage({ type: 'error', message: String(err) })
  }
}
