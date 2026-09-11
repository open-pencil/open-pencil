import { type SceneGraph, type SceneNode, setInstanceOverride } from '@open-pencil/scene-graph'

function linkSubtree(
  graph: SceneGraph,
  compParentId: string,
  instParentId: string,
  instRootId: string
): void {
  const compParent = graph.getNode(compParentId)
  const instParent = graph.getNode(instParentId)
  if (!compParent || !instParent) return

  const instRoot = graph.getNode(instRootId)
  const overrides = instRoot?.instanceOverrides

  const compChildren = compParent.childIds
    .map((id) => graph.getNode(id))
    .filter((n): n is SceneNode => n !== undefined)
  const instChildren = instParent.childIds
    .map((id) => graph.getNode(id))
    .filter((n): n is SceneNode => n !== undefined)

  const linkedComp = new Set<string>()
  const linkedInst = new Set<string>()

  const linkPair = (compChild: SceneNode, instChild: SceneNode): void => {
    if (instChild.type === 'INSTANCE') {
      if (overrides) {
        setInstanceOverride(overrides, instRootId, instChild.id, 'sourceComponentId', compChild.id)
      }
    } else if (!instChild.componentId) {
      instChild.componentId = compChild.id
    }
    linkedComp.add(compChild.id)
    linkedInst.add(instChild.id)
    // Do not recurse across INSTANCE boundaries. The sub-instance's descendants
    // are linked to their own main component by the outer getAllNodes() loop in
    // linkImportedInstanceChildren, which calls linkSubtree with the sub-instance's
    // componentId. Recursing here would stamp descendant componentIds with proxy
    // nodes inside the parent component's sub-instance rather than the canonical
    // main component children.
    if (
      instChild.type !== 'INSTANCE' &&
      compChild.childIds.length > 0 &&
      instChild.childIds.length > 0
    ) {
      linkSubtree(graph, compChild.id, instChild.id, instRootId)
    }
  }

  // Pass 1: match by stable overrideKey before position. This survives renames
  // and guards against an extra same-type child inserted before a renamed
  // serialized child — positional matching would otherwise mis-assign it.
  for (const instChild of instChildren) {
    if (!instChild.overrideKey || linkedInst.has(instChild.id)) continue
    const compChild = compChildren.find(
      (c) =>
        !linkedComp.has(c.id) &&
        c.overrideKey === instChild.overrideKey &&
        c.type === instChild.type
    )
    if (!compChild) continue
    linkPair(compChild, instChild)
  }

  // Pass 2: positional matching for remaining nodes (preserves order for nodes
  // without stable keys, and for legacy files without overrideKey).
  const remainingComp = compChildren.filter((c) => !linkedComp.has(c.id))
  const remainingInst = instChildren.filter((c) => !linkedInst.has(c.id))
  // Positional evidence is safe only when every remaining slot has a matching type.
  // Otherwise preserve all unmatched instance children and let sync clone missing ones.
  const compatible =
    remainingComp.length === remainingInst.length &&
    remainingComp.every((child, index) => child.type === remainingInst[index]?.type)
  if (!compatible) return
  for (let i = 0; i < remainingComp.length; i++) {
    const compChild = remainingComp[i]
    const instChild = remainingInst[i]
    linkPair(compChild, instChild)
  }
}

export function linkImportedInstanceChildren(graph: SceneGraph, instanceIds?: Set<string>): void {
  graph.preserveSourceMetadataDuring(() => {
    for (const node of graph.getAllNodes()) {
      if (node.type !== 'INSTANCE' || !node.componentId) continue
      // When scoped to a set of instance ids (e.g. freshly pasted nodes), only link
      // those instances — never re-link pre-existing, user-modified instances in the
      // target document. Unscoped (import path) links every instance.
      if (instanceIds && !instanceIds.has(node.id)) continue
      const comp = graph.getNode(node.componentId)
      if (!comp) continue
      linkSubtree(graph, comp.id, node.id, node.id)
    }
  })
}
