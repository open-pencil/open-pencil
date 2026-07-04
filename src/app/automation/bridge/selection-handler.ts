import { nodeToXPath } from '@open-pencil/core/xpath'

import type { AutomationTarget } from '@/app/automation/bridge/target'

export async function handleSelection(target: AutomationTarget): Promise<unknown> {
  const store = target.store
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
