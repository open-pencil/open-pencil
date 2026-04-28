import { nodeToXPath } from '@open-pencil/core/xpath'

import type { EditorStore } from '@/app/editor/active-store'

export async function handleSelection(store: EditorStore): Promise<unknown> {
  const ids = [...store.state.selectedIds]
  const nodes = ids
    .map((id) => store.graph.getNode(id))
    .filter((node): node is NonNullable<typeof node> => node !== undefined)
    .map((node) => ({
      id: node.id,
      name: node.name,
      type: node.type,
      width: Math.round(node.width),
      height: Math.round(node.height),
      xpath: nodeToXPath(store.graph, node.id)
    }))
  return { ok: true, result: nodes }
}
