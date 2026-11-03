// Overrides a variant switch keeps for the layers it removes, to give back to the next copies.
import { omit } from 'es-toolkit/object'
import { isEqual } from 'es-toolkit/predicate'

import {
  overriddenAssignmentId,
  reapplyComponentPropertyAssignments
} from '../components/properties'
import type { SceneGraph } from '../graph'
import type { SceneNode } from '../types'
import { instanceMainComponent } from './main-component'
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
  /** The component a nested instance was switched to, which its new copy is switched to again. */
  swappedTo?: string
  /** Property values the overrides claim on a nested instance. */
  assignments: Record<string, string>
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
  graph: SceneGraph,
  node: SceneNode,
  owner: OwnerRef,
  self: boolean,
  fields: ReadonlyMap<string, unknown>
): KeptOverrides | undefined {
  const kept = new Map([...fields].filter(([field]) => !LINK_FIELDS.has(field)))
  // A swap is kept as the component it shows; the new copy records it again when switched.
  const swappedTo =
    fields.has('componentId') && node.type === 'INSTANCE'
      ? instanceMainComponent(graph, node)?.id
      : undefined
  if (kept.size === 0 && !swappedTo) return undefined
  const values: Partial<SceneNode> = {}
  const bindings: KeptOverrides['bindings'] = {}
  const assignments: Record<string, string> = {}
  for (const field of kept.keys()) {
    const binding = overriddenBindingField(field)
    const assigned = overriddenAssignmentId(field)
    if (assigned !== undefined) {
      if (Object.hasOwn(node.componentPropertyAssignments, assigned))
        assignments[assigned] = node.componentPropertyAssignments[assigned]
    } else if (binding !== null) {
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
  return { owner, self, fields: kept, values, bindings, allBindings, swappedTo, assignments }
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
    const kept = snapshot(scope.graph, node, { id: owner.id }, false, fields)
    if (kept) taken.push(kept)
  }
  for (const owner of inner) {
    const fields = owner.instanceOverrides.descendants.get(node.id)
    const path = layerPath(scope, owner)
    const kept = fields && path ? snapshot(scope.graph, node, { path }, false, fields) : undefined
    if (kept) taken.push(kept)
  }
  const ownPath = node.type === 'INSTANCE' ? layerPath(scope, node) : undefined
  const own = ownPath
    ? snapshot(scope.graph, node, { path: ownPath }, true, node.instanceOverrides.self)
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

/**
 * Switches a nested instance switched to another variant again first, so what is kept for it
 * and its layers lands on what it then shows. Returns the node as it then stands.
 */
function switchAsKept(scope: OverrideScope, copy: SceneNode, kept: readonly KeptOverrides[]) {
  const swappedTo = kept.find((entry) => entry.swappedTo)?.swappedTo
  if (
    swappedTo &&
    copy.type === 'INSTANCE' &&
    scope.graph.getNode(swappedTo) &&
    instanceMainComponent(scope.graph, copy)?.id !== swappedTo
  ) {
    scope.graph.swapInstanceComponent(copy.id, swappedTo)
  }
  return scope.graph.getNode(copy.id) ?? copy
}

/** The bindings and unit scales a layer shows with the kept bindings applied over its own. */
function keptBindings(node: SceneNode, kept: readonly KeptOverrides[]) {
  let boundVariables: Record<string, string> = { ...node.boundVariables }
  let scales: Scales = { ...node.variableBindingScales }
  for (const { bindings, allBindings } of kept) {
    if (allBindings) {
      boundVariables = { ...allBindings.boundVariables }
      scales = { ...allBindings.scales }
    }
    for (const [field, { variableId, scale }] of Object.entries(bindings)) {
      boundVariables = variableId
        ? { ...boundVariables, [field]: variableId }
        : omit(boundVariables, [field])
      scales = scale !== undefined ? { ...scales, [field]: scale } : omit(scales, [field])
    }
  }
  return { boundVariables, scales }
}

function giveOverrides(scope: OverrideScope, copy: SceneNode, kept: readonly KeptOverrides[]) {
  const node = switchAsKept(scope, copy, kept)
  const values: Partial<SceneNode> = {}
  for (const { owner: ref, self, fields, values: shown } of kept) {
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
  }
  const { boundVariables, scales } = keptBindings(node, kept)
  if (!isEqual(boundVariables, node.boundVariables)) values.boundVariables = boundVariables
  if (!isEqual(scales, node.variableBindingScales)) values.variableBindingScales = scales
  const assignments: Record<string, string> = Object.assign(
    {},
    ...kept.map((entry) => entry.assignments)
  )
  const assigns = Object.keys(assignments).length > 0
  if (assigns) {
    values.componentPropertyAssignments = { ...node.componentPropertyAssignments, ...assignments }
  }
  if (Object.keys(values).length > 0) scope.graph.updateNode(node.id, values)
  // The values a nested instance is given show in its layers, as a matched copy's do.
  if (assigns) reapplyComponentPropertyAssignments(scope.graph, node.id)
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
