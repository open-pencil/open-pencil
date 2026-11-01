import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'

/**
 * Fields a layer keeps when its code is rendered again: its place in the tree and the identity
 * that other layers, libraries and files refer to.
 */
const IDENTITY_FIELDS = new Set<keyof SceneNode>([
  'id',
  'type',
  'parentId',
  'childIds',
  'source',
  'componentKey',
  'sourceLibraryKey',
  'publishId',
  'overrideKey'
])

/**
 * Types rebuilt as a whole: instance overrides are keyed by the ids of their sublayers, and icon
 * and SVG artwork is drawn again from its paths.
 */
const REPLACED_TYPES = new Set<SceneNode['type']>(['INSTANCE', 'VECTOR', 'BOOLEAN_OPERATION'])

function updatesInPlace(existing: SceneNode, rendered: SceneNode): boolean {
  return existing.type === rendered.type && !REPLACED_TYPES.has(existing.type)
}

/** Pairs rendered children with existing ones: same type and name first, then same type in order. */
function matchChildren(
  existing: readonly SceneNode[],
  rendered: readonly SceneNode[]
): Map<SceneNode, SceneNode> {
  const pairs = new Map<SceneNode, SceneNode>()
  const free = new Set(existing)
  const take = (node: SceneNode, test: (candidate: SceneNode) => boolean) => {
    for (const candidate of free) {
      if (!test(candidate)) continue
      free.delete(candidate)
      pairs.set(node, candidate)
      return
    }
  }
  for (const node of rendered) {
    take(node, (candidate) => candidate.type === node.type && candidate.name === node.name)
  }
  for (const node of rendered) {
    if (!pairs.has(node)) take(node, (candidate) => candidate.type === node.type)
  }
  return pairs
}

function authoredChanges(existing: SceneNode, rendered: SceneNode): Partial<SceneNode> {
  const changes: Partial<SceneNode> = {}
  for (const key of Object.keys(rendered) as (keyof SceneNode)[]) {
    if (IDENTITY_FIELDS.has(key)) continue
    const next = rendered[key]
    if (JSON.stringify(existing[key]) === JSON.stringify(next)) continue
    Object.assign(changes, { [key]: structuredClone(next) })
  }
  return changes
}

class Reconciler {
  /** Rendered layer id → the id it has once reconciled: the existing layer's, or its own. */
  readonly ids = new Map<string, string>()

  constructor(private readonly graph: SceneGraph) {}

  keepRendered(node: SceneNode) {
    this.ids.set(node.id, node.id)
    for (const child of this.graph.getChildren(node.id)) this.keepRendered(child)
  }

  /** Makes `existing` match `rendered` and returns the id the pair ends up with. */
  pair(existing: SceneNode, rendered: SceneNode): string {
    if (!updatesInPlace(existing, rendered)) {
      const parentId = existing.parentId
      const parent = parentId ? this.graph.getNode(parentId) : undefined
      if (parent && parentId) {
        this.graph.insertChildAt(rendered.id, parentId, parent.childIds.indexOf(existing.id))
      }
      this.graph.deleteNode(existing.id)
      this.keepRendered(rendered)
      return rendered.id
    }
    const changes = authoredChanges(existing, rendered)
    if (Object.keys(changes).length > 0) this.graph.updateNode(existing.id, changes)
    this.ids.set(rendered.id, existing.id)
    this.children(existing.id, rendered.id)
    this.graph.deleteNode(rendered.id)
    return existing.id
  }

  private children(existingId: string, renderedId: string) {
    const renderedChildren = this.graph.getChildren(renderedId)
    const pairs = matchChildren(this.graph.getChildren(existingId), renderedChildren)
    const order = renderedChildren.map((child) => {
      const match = pairs.get(child)
      return match ? this.pair(match, child) : child.id
    })
    for (const child of renderedChildren) if (!pairs.has(child)) this.keepRendered(child)
    const kept = new Set(order)
    for (const child of this.graph.getChildren(existingId)) {
      if (!kept.has(child.id)) this.graph.deleteNode(child.id)
    }
    for (const [index, id] of order.entries()) this.graph.insertChildAt(id, existingId, index)
  }
}

/**
 * Folds freshly rendered layers into the layers they replace, so code edits update layers in
 * place: matched layers keep their ids, and only the properties that differ change. Roots pair
 * by position; extra rendered roots stay, extra existing roots are deleted. Returns the id each
 * rendered layer ends up with.
 */
export function reconcileRenderedLayers(
  graph: SceneGraph,
  existingRootIds: readonly string[],
  renderedRootIds: readonly string[]
): { rootIds: string[]; ids: Map<string, string> } {
  const reconciler = new Reconciler(graph)
  const rootIds = renderedRootIds.flatMap((renderedId, index) => {
    const rendered = graph.getNode(renderedId)
    if (!rendered) return []
    const existingId = existingRootIds.at(index)
    const existing = existingId ? graph.getNode(existingId) : undefined
    if (existing) return [reconciler.pair(existing, rendered)]
    reconciler.keepRendered(rendered)
    return [rendered.id]
  })
  for (const id of existingRootIds.slice(renderedRootIds.length)) graph.deleteNode(id)
  return { rootIds, ids: reconciler.ids }
}
