// Overrides a variant switch keeps for the layers it removes, to give back to the next copies.
import { omit } from 'es-toolkit/object'
import { isEqual } from 'es-toolkit/predicate'

import type { SceneGraph } from '../graph'
import type { SceneNode } from '../types'
import { overriddenBindingField } from './overrides'

/** Where a switch runs: the switched instance and the instances enclosing the layers it changes. */
export interface OverrideScope {
  graph: SceneGraph
  instance: SceneNode
  owners: readonly SceneNode[]
  /** Reports an owner before its override maps are written into. */
  willChange(owner: SceneNode): void
}

/**
 * An instance that holds overrides on a layer: one enclosing the switch, by ID, or one inside
 * the removed copy, by its path, since a new copy of it gets a new ID.
 */
type OwnerRef = { id: string } | { path: string }

/** What one owner overrides on a layer, with the values the layer showed. */
interface KeptOverrides {
  owner: OwnerRef
  /** The owner's own fields, for a nested instance's overrides on itself. */
  self: boolean
  fields: Map<string, unknown>
  values: Partial<SceneNode>
  /** Bindings the overrides claim, with their unit scales; an absent variable claims none. */
  bindings: Record<string, { variableId: string | undefined; scale: number | undefined }>
  /** Set when the overrides claim every binding, as removing a variable records. */
  allBindings?: { boundVariables: SceneNode['boundVariables']; scales: Scales }
}

type Scales = SceneNode['variableBindingScales']

/** Override fields that link a copy to its layer, which a new copy gets from its own layer. */
const LINK_FIELDS: ReadonlySet<string> = new Set(['sourceComponentId', 'componentId'])

/**
 * Overrides on layers a switch removed, by switched instance and then by the layer's path from
 * it: each step's name and its order among the same-named layers beside it, the way a switch
 * pairs layers. Figma brings them back when the instance switches to a variant that draws the
 * layer again, though its saved records keep none of them while the layer is gone (desktop
 * 126), so they live with the open document only.
 */
const keptByGraph = new WeakMap<SceneGraph, Map<string, Map<string, KeptOverrides[]>>>()

function keptFor(scope: OverrideScope, create: true): Map<string, KeptOverrides[]>
function keptFor(scope: OverrideScope, create: false): Map<string, KeptOverrides[]> | undefined
function keptFor(scope: OverrideScope, create: boolean) {
  let byInstance = keptByGraph.get(scope.graph)
  if (!byInstance && create) {
    byInstance = new Map()
    keptByGraph.set(scope.graph, byInstance)
  }
  let byPath = byInstance?.get(scope.instance.id)
  if (!byPath && byInstance && create) {
    byPath = new Map()
    byInstance.set(scope.instance.id, byPath)
  }
  return byPath
}

/** A layer's path from the switched instance, by names and their order among namesakes. */
function layerPath(scope: OverrideScope, node: SceneNode): string | undefined {
  const steps: string[] = []
  let current = node
  while (current.id !== scope.instance.id) {
    const parent: SceneNode | undefined = current.parentId
      ? scope.graph.getNode(current.parentId)
      : undefined
    if (!parent) return undefined
    let ordinal = 0
    for (const id of parent.childIds) {
      if (id === current.id) break
      if (scope.graph.getNode(id)?.name === current.name) ordinal++
    }
    steps.push(`${current.name}\u0000${ordinal}`)
    current = parent
  }
  return steps.reverse().join('\u0001')
}

function snapshot(
  node: SceneNode,
  owner: OwnerRef,
  self: boolean,
  fields: ReadonlyMap<string, unknown>
): KeptOverrides | undefined {
  const kept = new Map([...fields].filter(([field]) => !LINK_FIELDS.has(field)))
  if (kept.size === 0) return undefined
  const values: Partial<SceneNode> = {}
  const bindings: KeptOverrides['bindings'] = {}
  for (const field of kept.keys()) {
    const binding = overriddenBindingField(field)
    if (binding !== null) {
      bindings[binding] = {
        variableId: node.boundVariables[binding],
        scale: node.variableBindingScales[binding]
      }
    } else if (field in node && field !== 'boundVariables') {
      Object.assign(values, { [field]: structuredClone(node[field as keyof SceneNode]) })
    }
  }
  const allBindings = kept.has('boundVariables')
    ? {
        boundVariables: { ...node.boundVariables },
        scales: { ...node.variableBindingScales }
      }
    : undefined
  return { owner, self, fields: kept, values, bindings, allBindings }
}

/** Takes the overrides on a layer off its owners, outer ones and those inside the removed copy. */
function takeOverrides(
  scope: OverrideScope,
  node: SceneNode,
  inner: readonly SceneNode[]
): KeptOverrides[] {
  const taken: KeptOverrides[] = []
  for (const owner of scope.owners) {
    const fields = owner.instanceOverrides.descendants.get(node.id)
    if (!fields) continue
    scope.willChange(owner)
    owner.instanceOverrides.descendants.delete(node.id)
    const kept = snapshot(node, { id: owner.id }, false, fields)
    if (kept) taken.push(kept)
  }
  for (const owner of inner) {
    const fields = owner.instanceOverrides.descendants.get(node.id)
    const path = layerPath(scope, owner)
    const kept = fields && path ? snapshot(node, { path }, false, fields) : undefined
    if (kept) taken.push(kept)
  }
  const ownPath = node.type === 'INSTANCE' ? layerPath(scope, node) : undefined
  const own = ownPath
    ? snapshot(node, { path: ownPath }, true, node.instanceOverrides.self)
    : undefined
  if (own) taken.push(own)
  return taken
}

/**
 * Keeps what is overridden on a copy and its layers before a switch removes it. A layer
 * removed with nothing overridden clears what an earlier removal kept for its path, so a value
 * the user reset does not come back.
 */
export function keepOverrides(
  scope: OverrideScope,
  copy: SceneNode,
  inner: readonly SceneNode[] = []
): void {
  const path = layerPath(scope, copy)
  const taken = takeOverrides(scope, copy, inner)
  if (path && taken.length > 0) keptFor(scope, true).set(path, taken)
  else if (path) keptFor(scope, false)?.delete(path)
  const owners = copy.type === 'INSTANCE' ? [...inner, copy] : inner
  for (const child of scope.graph.getChildren(copy.id)) keepOverrides(scope, child, owners)
}

function ownerOf(scope: OverrideScope, ref: OwnerRef): SceneNode | undefined {
  if ('id' in ref) return scope.owners.find((owner) => owner.id === ref.id)
  let current: SceneNode | undefined = scope.instance
  for (const step of ref.path.split('\u0001')) {
    const [name, ordinal] = step.split('\u0000')
    current = current
      ? scope.graph.getChildren(current.id).filter((child) => child.name === name)[Number(ordinal)]
      : undefined
  }
  return current?.type === 'INSTANCE' ? current : undefined
}

function giveOverrides(scope: OverrideScope, node: SceneNode, kept: readonly KeptOverrides[]) {
  const values: Partial<SceneNode> = {}
  let boundVariables: Record<string, string> = { ...node.boundVariables }
  let scales: Scales = { ...node.variableBindingScales }
  for (const { owner: ref, self, fields, values: shown, bindings, allBindings } of kept) {
    const owner = ownerOf(scope, ref)
    if (!owner) continue
    scope.willChange(owner)
    const own = self
      ? owner.instanceOverrides.self
      : owner.instanceOverrides.descendants.get(node.id)
    const merged = new Map([...(own ?? []), ...fields])
    if (self) owner.instanceOverrides.self = merged
    else owner.instanceOverrides.descendants.set(node.id, merged)
    Object.assign(values, structuredClone(shown))
    if (allBindings) {
      boundVariables = { ...allBindings.boundVariables }
      scales = { ...allBindings.scales }
    }
    for (const [field, { variableId, scale }] of Object.entries(bindings)) {
      if (variableId) boundVariables[field] = variableId
      else boundVariables = omit(boundVariables, [field])
      if (scale !== undefined) scales[field] = scale
      else scales = omit(scales, [field])
    }
  }
  if (!isEqual(boundVariables, node.boundVariables)) values.boundVariables = boundVariables
  if (!isEqual(scales, node.variableBindingScales)) values.variableBindingScales = scales
  if (Object.keys(values).length > 0) scope.graph.updateNode(node.id, values)
}

/** Gives a copy just placed, and its layers, what an earlier switch kept for their paths. */
export function restoreOverrides(scope: OverrideScope, copy: SceneNode): void {
  const kept = keptFor(scope, false)
  if (!kept?.size) return
  const restore = (node: SceneNode) => {
    const path = layerPath(scope, node)
    const found = path ? kept.get(path) : undefined
    // Kept, not taken: undoing this switch and switching again gives them back once more.
    if (found) giveOverrides(scope, node, found)
    for (const child of scope.graph.getChildren(node.id)) restore(child)
  }
  restore(copy)
}
