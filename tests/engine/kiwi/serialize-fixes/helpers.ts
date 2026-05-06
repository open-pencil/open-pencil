import { beforeAll } from 'bun:test'

import { initCodec, sceneNodeToKiwi, type SceneGraph } from '@open-pencil/core'

beforeAll(async () => {
  await initCodec()
})

export function pageId(graph: SceneGraph) {
  return graph.getPages()[0].id
}

export const ROOT_GUID = { sessionID: 1, localID: 0 }

export function toKiwi(node: ReturnType<SceneGraph['createNode']>, graph: SceneGraph) {
  const blobs: Uint8Array[] = []
  return sceneNodeToKiwi(node, ROOT_GUID, 0, { value: 100 }, graph, blobs)
}
