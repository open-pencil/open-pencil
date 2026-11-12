import type { GUID } from '@open-pencil/kiwi/fig'
import type { NodeChange } from '@open-pencil/kiwi/fig/codec'
import { guidToString } from '@open-pencil/kiwi/fig/guid'

import {
  bindSourceProperties,
  componentBindings,
  instanceBindings,
  type BoundPropertyClaim,
  type PropertyBinding
} from './bindings/properties'
import { declareSourceVariableBindingUnits } from './bindings/variables'
import { applyDerivedEntry } from './derived-symbol-data'
import {
  ownLayers,
  type AssignmentGroup,
  type Owner,
  type PropertyLayer,
  type StructuralLayer
} from './layers'
import { createOccurrence, type Subtree } from './occurrence/create'
import { createModeScopes, type ModeScope } from './occurrence/modes'
import { isRootGuid, pathError, SegmentError } from './occurrence/path'
import { resolveRoot, type RootResolution } from './occurrence/root'
import type { InstanceOccurrence, InterpretInstanceOptions } from './occurrence/types'
import { createPropertyClaims } from './property-claims'
import { applyPlacedConstraints } from './resize'
import { applyInstanceLayoutScale } from './scale/layout'
import {
  createInterpreterIndex,
  findStaticSegment,
  idOf,
  recordMatches,
  resolvesInSourceComponent,
  terminalComponent,
  type InterpreterIndex
} from './source-index'
import { assignedSlotContent, type DerivedSymbolOverride } from './types'

/**
 * Figma's instance model reduces to three things: an instance expands its component's
 * subtree; owners contribute layers, each a partial record at a path relative to that
 * owner; and the outermost owner wins where layers overlap. A swap and a property
 * assignment are structural layers, everything else is a property layer.
 *
 * Structural layers are routed down to the instance they configure before it expands,
 * so every occurrence expands exactly once with its effective component and complete
 * assignment list. Property layers are applied by their declaring owner onto the built
 * subtree, so their values stay in that owner's coordinate space; outer owners apply
 * after inner ones by construction. Saved derived data is a cache, applied last.
 */

export { resolveOccurrencePath } from './occurrence/path'

export function interpretInstance(
  changes: readonly NodeChange[],
  instanceId: string,
  options: InterpretInstanceOptions = {}
): InstanceOccurrence {
  return createOccurrenceInterpreter(changes).instance(instanceId, options)
}

export function interpretComponent(
  changes: readonly NodeChange[],
  componentId: string,
  options: InterpretInstanceOptions = {}
): InstanceOccurrence {
  return createOccurrenceInterpreter(changes).component(componentId, options)
}

/** One source index per document; evaluation state remains local to each call. */
export function createOccurrenceInterpreter(changes: readonly NodeChange[]) {
  return createIndexedOccurrenceInterpreter(createInterpreterIndex(changes))
}

/** An interpreter over an index built elsewhere, such as one that decodes records as read. */
export function createIndexedOccurrenceInterpreter(index: InterpreterIndex) {
  return {
    instance: (id: string, options: InterpretInstanceOptions = {}) =>
      interpretRoot(index, id, 'INSTANCE', options),
    component: (id: string, options: InterpretInstanceOptions = {}) =>
      interpretRoot(index, id, 'SYMBOL', options),
    page: (id: string, options: InterpretInstanceOptions = {}) =>
      interpretRoot(index, id, 'CANVAS', options)
  }
}

function interpretRoot(
  index: InterpreterIndex,
  rootId: string,
  expectedType: 'INSTANCE' | 'SYMBOL' | 'CANVAS',
  options: InterpretInstanceOptions
): InstanceOccurrence {
  const { sources, children } = index
  const expanding = new Set<string>()
  const modeScopes = createModeScopes(index)
  /** Fields set by an owner's assignment, by the rank of that owner. */
  const assignedFields = new WeakMap<InstanceOccurrence, Map<string, number>>()
  /** Components an occurrence expanded before an outer decision replaced them. */
  const replacedComponents = new WeakMap<InstanceOccurrence, readonly GUID[]>()

  /** A layer written against a component that an outer decision replaced is stale, not wrong. */
  const isStaleLayer = ({ boundary }: StructuralLayer): boolean =>
    boundary?.replaced.some((component) =>
      resolvesInSourceComponent(index, component, boundary.path)
    ) ?? false

  /**
   * An address that resolves to nothing is a record Figma kept after deleting the node it
   * named, and a swap is no different: its replacement can be present while the layer it
   * replaced is gone. An ambiguous address means the path is wrong, which stays fatal.
   */
  const unresolvedStructural = (layer: StructuralLayer, cause: SegmentError): void => {
    if (cause.count === 0 && isStaleLayer(layer)) return
    const error = pathError(layer.owner.id, layer.owner.mainComponentId, layer.declaredPath, cause)
    if (cause.count !== 0 || !options.onUnresolvedAssignment) throw error
    layer.owner.unresolved.push({
      ...error.diagnostic,
      assignments: structuredClone(layer.assignments)
    })
  }

  /** Dispatch structural layers to the direct child whose static subtree holds their first segment. */
  const routeToChildren = (
    id: string,
    layers: readonly StructuralLayer[]
  ): Map<string, StructuralLayer[]> => {
    const routed = new Map<string, StructuralLayer[]>()
    for (const layer of layers) {
      const [segment] = layer.path
      const { count, topChild } = findStaticSegment(index, id, segment)
      if (!topChild?.guid) {
        unresolvedStructural(layer, new SegmentError(count, segment))
        continue
      }
      const childId = guidToString(topChild.guid)
      const direct = recordMatches(topChild, segment)
      const next = { ...layer, path: direct ? layer.path.slice(1) : layer.path }
      const bucket = routed.get(childId)
      if (bucket) bucket.push(next)
      else routed.set(childId, [next])
    }
    return routed
  }

  const { applyPropertyClaim, resolveClaimTarget } = createPropertyClaims({
    index,
    options,
    assignedFields,
    replacedComponents
  })

  const applyDerivedBounds = (owner: InstanceOccurrence, source: NodeChange): void => {
    if (!options.derivedBounds) return
    const derived = source.derivedSymbolData as DerivedSymbolOverride[] | undefined
    for (const entry of derived ?? []) {
      const path = entry.guidPath?.guids
      if (!path?.length) continue
      const target = resolveClaimTarget(owner, path)
      if (!target || target === owner) continue // Placed root bounds belong to its NodeChange.
      applyDerivedEntry(target, entry)
    }
  }

  /** Bind the record's fields from the enclosing component scope, recording provenance. */
  const bindRecord = (
    raw: NodeChange,
    bindings: readonly PropertyBinding[]
  ): {
    source: NodeChange
    claims: BoundPropertyClaim[]
    /** Fields set by an owner's assignment, by that owner's rank. */
    bound: Map<string, number>
    /** Swap values earlier owners assigned before a later one replaced them. */
    superseded: GUID[]
    /** The content frame an assignment put in this slot frame. */
    slotContent: string | undefined
  } => {
    const claims: BoundPropertyClaim[] = []
    const bound = new Map<string, number>()
    const superseded: GUID[] = []
    let slotContent: string | undefined
    const source = bindSourceProperties(raw, bindings, (claim, binding) => {
      claims.push(claim)
      if (binding.origin === 'assignment' && binding.rank !== undefined)
        bound.set(claim.field, binding.rank)
      if (claim.field === 'symbolData')
        for (const value of binding.superseded ?? [])
          if (value.guidValue) superseded.push(value.guidValue)
      if (claim.field === 'slotContent') {
        const content = assignedSlotContent(binding.value)
        slotContent = content ? guidToString(content) : undefined
      }
    })
    if (slotContent && !sources.has(slotContent)) {
      if (!options.onMissingSlotContent) throw new Error(`Missing slot content ${slotContent}`)
      options.onMissingSlotContent({ slotId: idOf(raw) ?? '', slotContentId: slotContent })
      slotContent = undefined
    }
    return { source, claims, bound, superseded, slotContent }
  }

  /**
   * Expand one source record. `layers` are structural layers addressed relative to this
   * expansion: an empty path configures this record itself, a longer path a descendant.
   */
  const expand = (
    id: string,
    bindings: readonly PropertyBinding[],
    layers: readonly StructuralLayer[],
    rank: number,
    inherited: ModeScope
  ): InstanceOccurrence => {
    if (expanding.has(id)) throw new Error(`Cyclic component expansion at ${id}`)
    options.onProgress?.()
    const raw = sources.get(id)
    if (!raw) throw new Error(`Missing source node ${id}`)
    const record = bindRecord(raw, bindings)
    const { source } = record
    expanding.add(id)
    try {
      const owner: Owner = { id, rank, mainComponentId: null, unresolved: [] }
      const own = ownLayers(source, owner)
      const structural = [...own.structural, ...layers].sort((a, b) => b.owner.rank - a.owner.rank)
      const root = resolveRoot(sources, raw, source, record.superseded, structural, rank)
      const modes = modeScopes.enter(inherited, raw, root.effective, own.claims)
      let subtree: Subtree
      if (root.effective) {
        subtree = expandBase(owner, { ...root, effective: root.effective }, rank, modes)
      } else if (record.slotContent) {
        subtree = expandSlotContent(record.slotContent, root.descendant, rank, modes)
      } else {
        subtree = expandChildren(id, source, bindings, root.groups, root.descendant, rank, modes)
      }
      const occurrence = createOccurrence(sources, id, raw, source, root, subtree, record.claims)
      if (record.slotContent) occurrence.slotContentId = record.slotContent
      assignedFields.set(occurrence, record.bound)
      if (subtree.base && root.replaced.length) replacedComponents.set(occurrence, root.replaced)
      declareSourceVariableBindingUnits(occurrence, source)
      const claims = subtree.dangling
        ? own.claims.filter(({ path }) => path.length === 1 && isRootGuid(occurrence, path[0]))
        : own.claims
      finishOccurrence(occurrence, subtree.base, source, claims, rank, !subtree.dangling, modes)
      for (const diagnostic of owner.unresolved)
        options.onUnresolvedAssignment?.({
          ...diagnostic,
          mainComponentId: occurrence.mainComponentId
        })
      return occurrence
    } finally {
      expanding.delete(id)
    }
  }

  /**
   * The component expansion receives the assignments as its own root layers and the
   * descendant layers unchanged: both address the same subtree.
   */
  const expandBase = (
    owner: Owner,
    { effective, replaced, groups, descendant }: RootResolution & { effective: GUID },
    rank: number,
    modes: ModeScope
  ): Subtree => {
    const componentId = guidToString(effective)
    if (!sources.has(componentId)) {
      // Layers addressed into the missing subtree have nothing to configure.
      if (!options.onMissingComponent) throw new Error(`Missing source node ${componentId}`)
      options.onMissingComponent({ ownerId: owner.id, componentId })
      return { base: null, children: [], dangling: true }
    }
    owner.mainComponentId = terminalComponent(index, componentId)
    const crossing = descendant.map((layer) =>
      replaced.length ? { ...layer, boundary: { replaced, path: layer.path } } : layer
    )
    const rootLayers = groups
      .filter((group) => group.assignments.length)
      .map((group): StructuralLayer => ({
        owner: { ...owner, rank: group.rank },
        declaredPath: [],
        path: [],
        assignments: group.assignments
      }))
    const base = expand(componentId, [], [...rootLayers, ...crossing], rank + 1, modes)
    return { base, children: base.children }
  }

  /** A component definition starts a binding scope; ordinary containers pass theirs through. */
  const expandChildren = (
    id: string,
    source: NodeChange,
    bindings: readonly PropertyBinding[],
    groups: readonly AssignmentGroup[],
    descendant: readonly StructuralLayer[],
    rank: number,
    modes: ModeScope
  ): Subtree => {
    const scoped =
      source.type === 'SYMBOL'
        ? groups.reduce(
            (result, group) => instanceBindings(result, group.assignments, group.rank),
            componentBindings(source)
          )
        : bindings
    return expandIndexedChildren(id, scoped, descendant, rank, modes)
  }

  /**
   * Slot content is the instance's own layers, saved under a content frame. Component
   * property bindings do not reach into a slot, so its layers expand outside that scope.
   */
  const expandSlotContent = (
    contentId: string,
    descendant: readonly StructuralLayer[],
    rank: number,
    modes: ModeScope
  ): Subtree => expandIndexedChildren(contentId, [], descendant, rank, modes)

  /** Expand a record's indexed children, each with the structural layers routed to it. */
  const expandIndexedChildren = (
    parentId: string,
    bindings: readonly PropertyBinding[],
    descendant: readonly StructuralLayer[],
    rank: number,
    modes: ModeScope
  ): Subtree => {
    const routed = routeToChildren(parentId, descendant)
    const expanded = (children.get(parentId) ?? []).map((child) => {
      if (!child.guid) throw new Error('Indexed child has no GUID')
      const childId = guidToString(child.guid)
      return expand(childId, bindings, routed.get(childId) ?? [], rank + 1, modes)
    })
    return { base: null, children: expanded }
  }

  /** Apply this owner's property layers, then its placed geometry and saved caches. */
  const finishOccurrence = (
    occurrence: InstanceOccurrence,
    base: InstanceOccurrence | null,
    source: NodeChange,
    claims: readonly PropertyLayer[],
    rank: number,
    derived: boolean,
    modes: ModeScope
  ): void => {
    for (const claim of claims) {
      const target = resolveClaimTarget(occurrence, claim.path)
      if (target) applyPropertyClaim(occurrence, rank, target, claim)
    }
    applyInstanceLayoutScale(occurrence, source)
    applyPlacedConstraints(occurrence, base, source)
    modeScopes.applySavedSize(occurrence, source, modes)
    if (derived) applyDerivedBounds(occurrence, source)
  }

  if (sources.get(rootId)?.type !== expectedType) {
    const kind = { INSTANCE: 'an instance', SYMBOL: 'a component', CANVAS: 'a page' }[expectedType]
    throw new Error(`Expected ${kind} source`)
  }
  return expand(rootId, [], [], 0, modeScopes.atParentOf(rootId))
}
