import { mapKeys } from 'es-toolkit'

import type {
  ComponentPropertyDefinition,
  NodeType,
  SceneGraph,
  SceneNode
} from '@open-pencil/scene-graph'
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

/** The ids of the layers under `id`, at any depth. */
function descendantIds(graph: SceneGraph, id: string): string[] {
  return graph.getChildren(id).flatMap((child) => [child.id, ...descendantIds(graph, child.id)])
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

interface PropertyOwner {
  id: string
  definitions: readonly ComponentPropertyDefinition[]
  /** Written with `keepChildren`, so no layer of the render defined its properties. */
  kept: boolean
}

/** The component properties the layers under `id` use, by id. */
function usedProperties(graph: SceneGraph, id: string): Set<string> {
  return new Set(
    descendantIds(graph, id).flatMap(
      (layerId) =>
        graph.getNode(layerId)?.componentPropertyReferences.map((ref) => ref.propertyId) ?? []
    )
  )
}

/**
 * Settles the properties of components rendered again. One written again keeps the id it had,
 * so instances that set it and layers that use it still do. One the render did not write stays
 * while layers kept from the document use it, and every one stays on a layer that kept its
 * children, since its children are where properties are written.
 */
function settleProperties(graph: SceneGraph, owners: PropertyOwner[], rootIds: string[]) {
  const renamed = new Map<string, string>()
  for (const owner of owners) {
    const node = graph.getNode(owner.id)
    if (!node) continue
    const written = node.componentPropertyDefinitions.map((definition) => {
      const before = owner.definitions.find(
        (old) => old.name === definition.name && old.type === definition.type
      )
      if (!before || before.id === definition.id) return definition
      renamed.set(definition.id, before.id)
      return { ...definition, id: before.id }
    })
    const ids = new Set(written.map((definition) => definition.id))
    const used = owner.kept ? null : usedProperties(graph, owner.id)
    const stay = owner.definitions.filter(
      (definition) => !ids.has(definition.id) && (used === null || used.has(definition.id))
    )
    // In the order they had, new ones last, as the properties panel lists them.
    const order = new Map(owner.definitions.map((definition, index) => [definition.id, index]))
    const definitions = [...written, ...stay].toSorted(
      (a, b) => (order.get(a.id) ?? order.size) - (order.get(b.id) ?? order.size)
    )
    graph.updateNode(owner.id, { componentPropertyDefinitions: definitions })
  }
  if (renamed.size === 0) return
  const rename = (id: string) => renamed.get(id) ?? id
  for (const id of rootIds.flatMap((rootId) => [rootId, ...descendantIds(graph, rootId)])) {
    const node = graph.getNode(id)
    if (!node) continue
    const references = node.componentPropertyReferences
    const assignments = Object.keys(node.componentPropertyAssignments)
    if (
      !references.some((ref) => renamed.has(ref.propertyId)) &&
      !assignments.some((key) => renamed.has(key))
    )
      continue
    graph.updateNode(id, {
      componentPropertyReferences: references.map((ref) => ({
        ...ref,
        propertyId: rename(ref.propertyId)
      })),
      componentPropertyAssignments: mapKeys(node.componentPropertyAssignments, (_, key) =>
        rename(key)
      )
    })
  }
}

class Reconciler {
  /** Rendered layer id → the id it has once reconciled: the existing layer's, or its own. */
  readonly ids = new Map<string, string>()
  /** Existing layer id → the rendered layer that replaced it, for one rebuilt rather than updated. */
  readonly replaced = new Map<string, string>()
  /** The existing layers that kept their children, which no render wrote. */
  readonly kept: string[] = []
  /** The paired layers that define component properties, with the ones they had. */
  readonly owners: PropertyOwner[] = []

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
      this.replaced.set(existing.id, rendered.id)
      this.keepRendered(rendered)
      return rendered.id
    }
    const definitions = existing.componentPropertyDefinitions
    if (definitions.length > 0 || rendered.componentPropertyDefinitions.length > 0) {
      this.owners.push({ id: existing.id, definitions, kept: this.keep.has(rendered.id) })
    }
    const changes = authoredChanges(existing, rendered)
    if (Object.keys(changes).length > 0) this.graph.updateNode(existing.id, changes)
    this.ids.set(rendered.id, existing.id)
    if (this.keep.has(rendered.id)) this.kept.push(existing.id)
    else this.children(existing.id, rendered.id)
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
  settleProperties(graph, reconciler.owners, rootIds)
  // Layers kept from the document may refer to one the render rebuilt, such as a connector to a
  // vector; they take its new id, as the rendered layers take their kept ones.
  const keptLayers = reconciler.kept.flatMap((id) => descendantIds(graph, id))
  remapCopiedReferences(
    graph,
    new Map([
      ...keptLayers.map((id): [string, string] => [id, id]),
      ...reconciler.ids,
      ...reconciler.replaced
    ])
  )
  return { rootIds, ids: reconciler.ids }
}
