/** Stage 3: computeAllLayouts on deserialized SceneGraph. */
import { SceneGraph } from '../scene-graph'
import { computeAllLayouts } from '../layout'
import { profileStage, profileStart, getFigParseProfile, clearFigParseProfile } from './fig-parse-profile'

interface Input {
  data: Parameters<typeof SceneGraph.fromPlainData>[0]
  profile?: boolean
}

self.onmessage = (e: MessageEvent<Input>) => {
  const { data, profile } = e.data
  if (profile) {
    ;(globalThis as unknown as { __FIG_PARSE_PROFILE__: boolean }).__FIG_PARSE_PROFILE__ = true
    clearFigParseProfile()
  }

  try {
    const t0 = profileStart()
    const graph = SceneGraph.fromPlainData(data)
    profileStage('5a_fromPlainData', t0)

    const t1 = profileStart()
    computeAllLayouts(graph)
    profileStage('5b_computeAllLayouts', t1)

    const out = {
      nodes: [...graph.nodes.entries()],
      images: [...graph.images.entries()],
      variables: [...graph.variables.entries()],
      variableCollections: [...graph.variableCollections.entries()],
      activeMode: [...graph.activeMode.entries()],
      rootId: graph.rootId
    }

    const transferables: Transferable[] = []
    const seen = new Set<ArrayBuffer>()
    for (const [, bytes] of out.images) {
      const buf = bytes.buffer as ArrayBuffer
      if (!seen.has(buf)) { seen.add(buf); transferables.push(buf) }
    }

    self.postMessage(
      { type: 'success', data: out, profile: profile ? getFigParseProfile() : undefined },
      { transfer: transferables }
    )
  } catch (err) {
    self.postMessage({ type: 'error', message: String(err) })
  }
}
