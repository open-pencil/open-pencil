import type { GUID } from '@open-pencil/kiwi/fig/codec'
import {
  findInstanceAncestor,
  getInstanceOverride,
  type SceneGraph,
  type SceneNode
} from '@open-pencil/scene-graph'

import type { DerivedSymbolOverride } from '../instance-overrides/types'

type ResolveGuid = (id: string) => GUID | undefined

export function instanceExportAddress(
  graph: SceneGraph,
  owner: SceneNode,
  target: SceneNode,
  resolveGuid: ResolveGuid
): GUID[] | undefined {
  if (target.id === owner.id && owner.componentId) {
    const guid = resolveGuid(owner.componentId)
    return guid ? [guid] : undefined
  }
  const boundaries: SceneNode[] = []
  let parent = target.parentId ? graph.getNode(target.parentId) : undefined
  while (parent && parent.id !== owner.id) {
    if (parent.type === 'INSTANCE') boundaries.unshift(parent)
    parent = parent.parentId ? graph.getNode(parent.parentId) : undefined
  }
  if (!parent) return undefined
  const path: GUID[] = []
  let scope = owner
  for (const node of [...boundaries, target]) {
    const sourceId = definitionSource(graph, sourceOf(scope, node))
    if (!sourceId) return undefined
    const guid = resolveGuid(sourceId)
    if (!guid) return undefined
    path.push(guid)
    scope = node
  }
  return path
}

function sourceOf(scope: SceneNode, node: SceneNode): string | null {
  const mapped = getInstanceOverride(
    scope.instanceOverrides,
    scope.id,
    node.id,
    'sourceComponentId'
  )
  return typeof mapped === 'string' ? mapped : node.componentId
}

/**
 * Only definition-level nodes are written as records, so a path segment must name one.
 * A source that itself sits inside an instance (a nested instance's child as seen from the
 * enclosing component) resolves through its own correspondence until it leaves every instance.
 */
function definitionSource(graph: SceneGraph, id: string | null): string | undefined {
  const seen = new Set<string>()
  let current = id ? graph.getNode(id) : undefined
  while (current) {
    const owner = current.parentId ? findInstanceAncestor(graph, current.parentId) : undefined
    if (!owner) return current.id
    if (seen.has(current.id)) return undefined
    seen.add(current.id)
    const next = sourceOf(owner, current)
    current = next ? graph.getNode(next) : undefined
  }
  return undefined
}

/** Derived geometry is a snapshot, not an authored size or position claim. */
export function snapshotInstanceGeometry(
  graph: SceneGraph,
  owner: SceneNode,
  resolveGuid: ResolveGuid,
  retained: DerivedSymbolOverride[],
  geometry: (node: SceneNode) => Pick<DerivedSymbolOverride, 'size' | 'transform'>
): DerivedSymbolOverride[] {
  const key = (path: GUID[]) => path.map((guid) => `${guid.sessionID}:${guid.localID}`).join('/')
  const entries = new Map<string, DerivedSymbolOverride>()
  const unaddressed: DerivedSymbolOverride[] = []
  for (const entry of retained) {
    if (!entry.guidPath?.guids?.length) {
      unaddressed.push(entry)
      continue
    }
    const id = key(entry.guidPath.guids)
    entries.set(id, { ...entries.get(id), ...entry })
  }
  const visited = new Set<string>()
  const visit = (node: SceneNode): void => {
    for (const child of graph.getChildren(node.id)) {
      const path = instanceExportAddress(graph, owner, child, resolveGuid)
      if (!path)
        throw new Error(`Missing instance geometry address for ${child.id} under ${owner.id}`)
      const id = key(path)
      if (visited.has(id))
        throw new Error(`Ambiguous instance geometry address ${id} under ${owner.id}`)
      visited.add(id)
      entries.set(id, { ...entries.get(id), guidPath: { guids: path }, ...geometry(child) })
      visit(child)
    }
  }
  visit(owner)
  return [...unaddressed, ...entries.values()]
}
