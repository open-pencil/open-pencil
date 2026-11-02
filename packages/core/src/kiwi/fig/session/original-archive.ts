import type { SceneGraph } from '@lawha/scene-graph'

import { requestOriginalArchive } from '#core/kiwi/fig/population/client'

const originalFigArchives = new WeakMap<SceneGraph, () => Promise<Uint8Array>>()

export function registerOriginalFigArchive(
  graph: SceneGraph,
  requestArchive: () => Promise<Uint8Array>
): void {
  originalFigArchives.set(graph, requestArchive)
}

export async function originalFigArchive(graph: SceneGraph): Promise<Uint8Array | null> {
  return (await originalFigArchives.get(graph)?.()) ?? (await requestOriginalArchive(graph))
}

export function releaseOriginalFigArchive(graph: SceneGraph): void {
  originalFigArchives.delete(graph)
}
