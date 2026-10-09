import type { SceneGraph } from '../index'
import {
  createInstanceOverrideState,
  setInstanceOverride,
  type InstanceOverrideState
} from '../instance-overrides'
import { isOwnedSlotContent } from '../slots/frames'
import type { SceneNode } from '../types'
import {
  copyLayerId,
  instanceScope,
  isInstanceLayerId,
  parseInstanceLayerId,
  type InstanceScope
} from './layer-ids'

type LegacyFields = Map<string, Map<string, unknown>>

/**
 * The overrides an owner kept by copy id: deserialized ones, or a structured clone of a state
 * from before copies were named by their paths, which held them as `descendants`.
 */
function takeLegacyCopies(state: InstanceOverrideState): LegacyFields | undefined {
  const stored: unknown = state.legacyCopies ?? Reflect.get(state, 'descendants')
  Reflect.deleteProperty(state, 'legacyCopies')
  Reflect.deleteProperty(state, 'descendants')
  if (!(state.layers instanceof Map)) state.layers = new Map()
  return stored instanceof Map ? (stored as LegacyFields) : undefined
}

interface Migration {
  readonly graph: SceneGraph
  /** Each copy's planned id, by its current one. */
  readonly renames: Map<string, string>
  /** Legacy overrides by the copy id they named, merged across the owners that held them. */
  readonly legacy: LegacyFields
  readonly owners: Set<string>
}

/** The source a copy was linked to before: an owner's record, or its own `componentId`. */
function legacySource(migration: Migration, copy: SceneNode): string | undefined {
  const recorded = migration.legacy.get(copy.id)?.get('sourceComponentId')
  if (typeof recorded === 'string') return recorded
  return copy.componentId ?? undefined
}

function current(migration: Migration, id: string): string {
  return migration.renames.get(id) ?? id
}

/** Pairs component layers with the copies an instance holds of them, the way sync used to. */
function pairCopies(
  migration: Migration,
  sources: SceneNode[],
  targets: SceneNode[],
  scope: InstanceScope
): Array<[SceneNode, SceneNode]> {
  const pairs: Array<[SceneNode, SceneNode]> = []
  const pairedSources = new Set<SceneNode>()
  const pairedTargets = new Set<SceneNode>()
  const pair = (source: SceneNode, target: SceneNode) => {
    pairs.push([source, target])
    pairedSources.add(source)
    pairedTargets.add(target)
  }
  const unpaired = <T>(nodes: T[], paired: Set<T>) => nodes.filter((node) => !paired.has(node))
  // Copies named already, then links recorded before, then Figma's stable keys.
  for (const target of targets) {
    const source = sources.find(
      (candidate) =>
        !pairedSources.has(candidate) &&
        (copyLayerId(scope, { id: current(migration, candidate.id) }) === target.id ||
          current(migration, legacySource(migration, target) ?? '') === candidate.id)
    )
    if (source) pair(source, target)
  }
  for (const target of unpaired(targets, pairedTargets)) {
    if (!target.overrideKey) continue
    const source = unpaired(sources, pairedSources).find(
      (candidate) => candidate.overrideKey === target.overrideKey && candidate.type === target.type
    )
    if (source) pair(source, target)
  }
  // Then name and type in order, where the counts leave no doubt.
  const remainingSources = unpaired(sources, pairedSources)
  const remainingTargets = unpaired(targets, pairedTargets)
  const count = (nodes: SceneNode[], type: string) =>
    nodes.filter((node) => node.type === type).length
  for (const source of remainingSources) {
    if (count(remainingTargets, source.type) > count(remainingSources, source.type)) continue
    const target = remainingTargets.find(
      (candidate) =>
        !pairedTargets.has(candidate) &&
        candidate.type === source.type &&
        candidate.name === source.name
    )
    if (target) pair(source, target)
  }
  return pairs
}

function migrateCopies(
  migration: Migration,
  scope: InstanceScope,
  sourceParent: SceneNode,
  targetParent: SceneNode
): void {
  const { graph } = migration
  if (sourceParent.id === targetParent.id || graph.isDescendant(targetParent.id, sourceParent.id))
    return
  const sources = graph.getChildren(sourceParent.id)
  const targets = graph.getChildren(targetParent.id)
  for (const [source, target] of pairCopies(migration, sources, targets, scope)) {
    // Sources renamed earlier in this migration are named here by their new ids.
    const id = copyLayerId(scope, { id: current(migration, source.id) })
    if (id !== target.id) migration.renames.set(target.id, id)
    if (target.type !== 'INSTANCE') {
      target.componentId = null
      migrateCopies(migration, scope, source, target)
      continue
    }
    const swapped = migration.legacy.get(target.id)?.get('componentId')
    const shown = typeof swapped === 'string' ? current(migration, swapped) : source.componentId
    // Renaming later indexes the copy under its new id; one already named keeps its entry.
    if (target.componentId !== shown) {
      if (target.componentId) graph.instanceIndex.get(target.componentId)?.delete(target.id)
      if (shown)
        graph.instanceIndex.set(shown, (graph.instanceIndex.get(shown) ?? new Set()).add(target.id))
      target.componentId = shown
    }
    // A copy of a nested instance records nothing itself; its owner holds what it overrode.
    const owner = graph.getNode(scope.owner)
    const address = parseInstanceLayerId(id)
    if (owner && address) {
      for (const [field, value] of target.instanceOverrides.self)
        setInstanceOverride(owner.instanceOverrides, address.path, field, value)
      if (shown !== source.componentId)
        setInstanceOverride(owner.instanceOverrides, address.path, 'componentId', shown)
    }
    target.instanceOverrides = createInstanceOverrideState()
    // Its copies are named the same whether paired with the component's copies of the layers it
    // shows or with those layers themselves; the component's layers exist even when its copies
    // were never built.
    const component = shown ? graph.getNode(shown) : undefined
    if (component) migrateCopies(migration, instanceScope({ id }), component, target)
  }
}

function migrateOwner(migration: Migration, owner: SceneNode): void {
  if (migration.owners.has(owner.id)) return
  migration.owners.add(owner.id)
  const component = owner.componentId ? migration.graph.getNode(owner.componentId) : undefined
  if (!component) return
  // Copies are named by the component's layers, which may be copies inside it themselves.
  migrateOwners(migration, component)
  migrateCopies(migration, { owner: owner.id, prefix: [] }, component, owner)
}

/** Migrates the instances in `root`'s subtree that are not copies of another one. */
function migrateOwners(migration: Migration, root: SceneNode): void {
  for (const child of migration.graph.getChildren(root.id)) {
    if (child.type === 'INSTANCE' && !isInstanceLayerId(child.id)) migrateOwner(migration, child)
    else migrateOwners(migration, child)
  }
}

/**
 * Whether `node` is in the shape graphs had before copies inside instances were named by their
 * paths: a layer inside an instance under an id of its own that is not slot content the instance
 * owns, or an instance holding overrides keyed by copy ids.
 */
export function isLegacyInstanceLayer(graph: SceneGraph, node: SceneNode): boolean {
  const state = node.instanceOverrides
  if (state.legacyCopies || Reflect.has(state, 'descendants')) return true
  if (isInstanceLayerId(node.id)) return false
  const parent = node.parentId ? graph.getNode(node.parentId) : undefined
  if (!parent || (parent.type !== 'INSTANCE' && !isInstanceLayerId(parent.id))) return false
  return !isOwnedSlotContent(graph, node)
}

/**
 * Bring a graph whose instance copies have ids of their own, as graphs had before copies were
 * named by their paths, to the current model: copies are renamed `I<owner>;<path>` after the
 * component layers they copy, overrides keyed by copy ids move to their outermost instance by
 * path, and copies stop linking to their sources through `componentId`. Layers that match no
 * component layer stay as the instance's own.
 */
export function migrateInstanceLayers(graph: SceneGraph): void {
  const legacy: LegacyFields = new Map()
  for (const node of graph.getAllNodes()) {
    const copies = takeLegacyCopies(node.instanceOverrides)
    for (const [id, fields] of copies ?? []) {
      const merged = legacy.get(id) ?? new Map<string, unknown>()
      for (const [field, value] of fields) merged.set(field, value)
      legacy.set(id, merged)
    }
  }
  const migration: Migration = { graph, renames: new Map(), legacy, owners: new Set() }
  const root = graph.getNode(graph.rootId)
  if (root) migrateOwners(migration, root)
  if (migration.renames.size === 0 && legacy.size === 0) return

  for (const [copyId, fields] of legacy) {
    const address = parseInstanceLayerId(current(migration, copyId))
    const owner = address ? graph.getNode(address.owner) : undefined
    if (!address || !owner) continue
    for (const [field, value] of fields)
      if (field !== 'sourceComponentId' && field !== 'componentId')
        setInstanceOverride(owner.instanceOverrides, address.path, field, value)
  }
  graph.renameNodes(migration.renames)
}
