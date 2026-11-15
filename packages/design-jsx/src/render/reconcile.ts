import type { NodeType, SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import { remapCopiedReferences } from '@open-pencil/scene-graph/transfer'

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

/** Whether a rendered layer of type `rendered` updates an existing `existing` one in place. */
export function updatesInPlaceAs(existing: NodeType, rendered: NodeType | undefined): boolean {
  return existing === rendered && !REPLACED_TYPES.has(existing)
}

function updatesInPlace(existing: SceneNode, rendered: SceneNode): boolean {
  return updatesInPlaceAs(existing.type, rendered.type)
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

/** `node` and the layers under it that are written with `keepChildren`. */
function keptLayers(graph: SceneGraph, node: SceneNode, keep: ReadonlySet<string>): SceneNode[] {
  return [
    ...(keep.has(node.id) ? [node] : []),
    ...graph.getChildren(node.id).flatMap((child) => keptLayers(graph, child, keep))
  ]
}

/**
 * The layers written with `keepChildren` that reconciling `rendered` into `existing` would pair
 * with no layer, found as `Reconciler.pair` pairs them, before anything changes.
 */
function unpairedKeptLayers(
  graph: SceneGraph,
  existing: SceneNode | undefined,
  rendered: SceneNode,
  keep: ReadonlySet<string>
): SceneNode[] {
  if (!existing || !updatesInPlace(existing, rendered)) return keptLayers(graph, rendered, keep)
  if (keep.has(rendered.id)) return []
  const renderedChildren = graph.getChildren(rendered.id)
  const pairs = matchChildren(graph.getChildren(existing.id), renderedChildren)
  return renderedChildren.flatMap((child) =>
    unpairedKeptLayers(graph, pairs.get(child), child, keep)
  )
}

class Reconciler {
  /** Rendered layer id → the id it has once reconciled: the existing layer's, or its own. */
  readonly ids = new Map<string, string>()

  constructor(
    private readonly graph: SceneGraph,
    private readonly keep: ReadonlySet<string>
  ) {}

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
    if (!this.keep.has(rendered.id)) this.children(existing.id, rendered.id)
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
 * by position; extra rendered roots stay, extra existing roots are deleted. A rendered layer that
 * pointed at another, such as an instance at its component or a connector at the layers it joins,
 * points at that layer's kept id. Returns the id each rendered layer ends up with.
 *
 * A layer in `keepChildrenIds`, written with `keepChildren`, takes the props it is written with and
 * keeps the children of the layer it pairs with. One that would pair with none is an error, thrown
 * before anything changes, since its children are not in the JSX to render.
 */
export function reconcileRenderedLayers(
  graph: SceneGraph,
  existingRootIds: readonly string[],
  renderedRootIds: readonly string[],
  keepChildrenIds: Iterable<string> = []
): { rootIds: string[]; ids: Map<string, string> } {
  const keep = new Set(keepChildrenIds)
  if (keep.size > 0) {
    const unpaired = renderedRootIds.flatMap((renderedId, index) => {
      const rendered = graph.getNode(renderedId)
      const existingId = existingRootIds.at(index)
      const existing = existingId ? graph.getNode(existingId) : undefined
      return rendered ? unpairedKeptLayers(graph, existing, rendered, keep) : []
    })
    if (unpaired.length > 0) {
      const names = unpaired.map((node) => `"${node.name}"`).join(', ')
      throw new Error(
        `keepChildren on ${names} matches no existing layer of the same type, so its children ` +
          "cannot be kept. Write the children out, or keep the layer's type and name."
      )
    }
  }
  const reconciler = new Reconciler(graph, keep)
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
  remapCopiedReferences(graph, reconciler.ids)
  return { rootIds, ids: reconciler.ids }
}
