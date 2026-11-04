import { materializeFigFragment } from '@open-pencil/fig'
import type { NodeChange } from '@open-pencil/kiwi/fig/codec'
import type { SceneGraph } from '@open-pencil/scene-graph'
import {
  captureTransferredState,
  removeGraphTransfer,
  applyGraphTransfer,
  prepareGraphTransfer
} from '@open-pencil/scene-graph/transfer'

/** Interpret in isolation before any destination mutation. */
export function prepareClipboardImport(
  changes: NodeChange[],
  graph: SceneGraph,
  parentId: string,
  blobs: Uint8Array[] = [],
  offsetX = 0,
  offsetY = 0
) {
  const fragment = materializeFigFragment(changes, blobs, { missingComponent: 'detach-empty' })
  const plan = prepareGraphTransfer({
    source: fragment.graph,
    rootIds: fragment.rootIds,
    dependencyPageIds: fragment.dependencyPageIds,
    target: graph,
    parentId
  })
  const roots = new Set(plan.rootIds)
  for (const node of plan.nodes) {
    if (roots.has(node.id)) {
      node.props.x = (node.props.x ?? 0) + offsetX
      node.props.y = (node.props.y ?? 0) + offsetY
    }
    // Figma's paste drops statuses: a pasted copy is a new design nobody has reviewed.
    if (node.props.status && node.props.source) {
      const { editedFields } = node.props.source
      node.props.status = null
      node.props.source = { ...node.props.source, editedFields: [...editedFields, 'status'] }
    }
  }
  let snapshot = plan
  const operation = {
    sourceIds: fragment.sources,
    plan,
    capture: () => {
      snapshot = captureTransferredState(graph, plan)
    },
    undo: () => removeGraphTransfer(graph, snapshot),
    redo: () => applyGraphTransfer(graph, snapshot),
    commit: () => applyGraphTransfer(graph, plan)
  }
  return operation
}
