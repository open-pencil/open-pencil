import type { SceneNode } from '@open-pencil/scene-graph'

import type { EditorContext } from '#core/editor/types'

import type { ClipboardSnapshot } from './snapshot'
import { importClipboardVariables, remapClipboardVariableBindings } from './variables'

export interface ClipboardDependencyImport {
  nodes: ClipboardSnapshot['nodes']
  styleSnapshots: SceneNode[]
  applyVariables?: () => void
  revertVariables?: () => void
}

export function importClipboardDependencies(
  ctx: EditorContext,
  snapshot: ClipboardSnapshot
): ClipboardDependencyImport {
  const nodes = structuredClone(snapshot.nodes)
  if (snapshot.sourceRootId === ctx.graph.rootId) return { nodes, styleSnapshots: [] }
  const styleIds = new Map<string, string>()
  const styleSnapshots: SceneNode[] = []
  for (const definition of snapshot.styleDefinitions) {
    const sourceStyleId = definition.source.id
    if (!sourceStyleId) continue
    const pastedStyleId = crypto.randomUUID()
    let pasted: SceneNode | undefined
    ctx.graph.preserveSourceMetadataDuring(() => {
      pasted = ctx.graph.createNode(definition.type, ctx.state.currentPageId, {
        ...structuredClone(definition),
        id: undefined,
        parentId: ctx.state.currentPageId,
        childIds: [],
        source: { ...definition.source, id: pastedStyleId }
      })
    })
    if (!pasted) continue
    styleIds.set(sourceStyleId, pastedStyleId)
    styleSnapshots.push(structuredClone(pasted))
  }
  const variables = importClipboardVariables(ctx.graph, snapshot.variableDependencies)
  function remap(node: ClipboardSnapshot['nodes'][number]) {
    remapClipboardVariableBindings(
      node,
      variables.variableIds,
      variables.collectionIds,
      variables.modeIds,
      styleIds
    )
    for (const child of node.children ?? []) remap(child)
  }
  for (const node of nodes) remap(node)
  variables.apply()
  return {
    nodes,
    styleSnapshots,
    applyVariables: variables.apply,
    revertVariables: variables.revert
  }
}
