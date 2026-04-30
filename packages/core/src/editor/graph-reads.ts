import type { SceneGraph } from '#core/scene-graph'

export function createGraphReadActions(getGraph: () => SceneGraph) {
  return {
    getNode: (id: string) => getGraph().getNode(id),
    getImage: (hash: string) => getGraph().images.get(hash),
    getChildren: (id: string) => getGraph().getChildren(id),
    getPages: (includeInternal?: boolean) => getGraph().getPages(includeInternal)
  }
}
