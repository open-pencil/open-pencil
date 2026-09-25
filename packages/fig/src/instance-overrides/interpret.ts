import type { GUID, NodeChange } from '@open-pencil/kiwi/fig/codec'
import { guidToString } from '@open-pencil/kiwi/fig/guid'
import type { Vector } from '@open-pencil/scene-graph'

import { mergeVariableConsumptionMaps } from '../node-change/variable-bindings'
import { applyDerivedEntry } from './derived-symbol-data/apply'
import {
  bindSourceProperties,
  componentBindings,
  instanceBindings,
  type BoundPropertyClaim,
  type PropertyBinding
} from './interpret-bindings'
import {
  ownLayers,
  type AssignmentGroup,
  type Owner,
  type PropertyLayer,
  type StructuralLayer
} from './layers'
import { applyInstanceLayoutScale } from './layout-scale'
import {
  findSegment,
  isRootGuid,
  pathError,
  resolveOccurrencePath,
  SegmentError
} from './occurrence-path'
import { applyPlacedConstraints } from './resize'
import {
  createSourceIndex,
  findStaticSegment,
  readOverrideKey,
  recordMatches,
  resolvesInSourceComponent,
  sameGuid,
  terminalComponent,
  type SourceIndex
} from './source-index'
import { invalidateInheritedTextData } from './text-provenance'
import type { ComponentPropAssignment, DerivedSymbolOverride } from './types'
import { declareVariableBindingUnits, declareSourceVariableBindingUnits } from './variable-bindings'

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

/** An explicit claim keeps the complete path relative to its owning occurrence. */
export interface InstancePropertyClaim {
  /** Source record declaring the claim; preserved when inherited by another occurrence. */
  declaredBy: string
  path: readonly GUID[]
  properties: Record<string, unknown>
}

/** One occurrence, not a shared source node or a SceneGraph editing clone. */
export interface InstanceOccurrence {
  readonly sourceId: string
  readonly overrideKey: GUID | undefined
  mainComponentId: string | null
  mainComponentOverrideKey?: GUID
  sourceComponentOverrideKey?: GUID
  sourceComponentId?: GUID
  properties: NodeChange
  children: InstanceOccurrence[]
  /** Explicit property records declared by this occurrence's source. */
  propertyClaims: InstancePropertyClaim[]
  bindingClaims: BoundPropertyClaim[]
  derivedSize?: Vector
  /** Cumulative scale for unresolved layout-distance variable values. */
  layoutScale?: number
  /** Per-field declaration-space multipliers, composed as owners expand. */
  variableBindingScales?: Record<string, number>
  /** Whether this expansion supplies a name rather than only inheriting it. */
  hasOwnName: boolean
  defaultInstanceName?: string
}

export interface InstancePathDiagnostic {
  ownerId: string
  mainComponentId?: string | null
  path: readonly GUID[]
  reason: 'missing-target' | 'ambiguous-target'
}

export interface InstanceAssignmentDiagnostic extends InstancePathDiagnostic {
  assignments: readonly ComponentPropAssignment[]
}

/** An instance whose main component the archive no longer contains. */
export interface MissingComponentDiagnostic {
  ownerId: string
  componentId: string
}

export { resolveOccurrencePath } from './occurrence-path'

export interface InterpretInstanceOptions {
  /** Apply explicitly saved effective bounds, geometry and typography; no inferred scaling or layout. */
  derivedBounds?: boolean
  /** Unresolved property overrides are skipped only when a diagnostic receiver is supplied. */
  onUnresolvedProperty?: (diagnostic: InstancePathDiagnostic) => void
  /** Explicit partial evaluation: report and skip missing assignment targets. Swaps remain fatal. */
  onUnresolvedAssignment?: (diagnostic: InstanceAssignmentDiagnostic) => void
  /**
   * Keep an instance of a deleted component as a childless instance that retains its
   * saved reference, the way Figma does, instead of rejecting the document.
   */
  onMissingComponent?: (diagnostic: MissingComponentDiagnostic) => void
}

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
  const index = createSourceIndex(changes)
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
  index: SourceIndex,
  rootId: string,
  expectedType: 'INSTANCE' | 'SYMBOL' | 'CANVAS',
  options: InterpretInstanceOptions
): InstanceOccurrence {
  const { sources, children } = index
  const expanding = new Set<string>()
  /** Fields set by an owner's assignment, by the rank of that owner. */
  const assignedFields = new WeakMap<InstanceOccurrence, Map<string, number>>()
  /** Components an occurrence expanded before an outer decision replaced them. */
  const replacedComponents = new WeakMap<InstanceOccurrence, readonly GUID[]>()

  const defaultInstanceName = (occurrence: InstanceOccurrence): string | undefined => {
    const source = sources.get(occurrence.sourceId)
    if (source?.type === 'INSTANCE') return occurrence.properties.name
    const parentGuid = source?.parentIndex?.guid
    const parent = parentGuid ? sources.get(guidToString(parentGuid)) : undefined
    return parent?.isStateGroup === true ? parent.name : occurrence.properties.name
  }

  /** A component and its override key both address the root of an instance's expansion. */
  const componentKeys = (guid: GUID | undefined): GUID[] => {
    if (!guid) return []
    const key = readOverrideKey(sources.get(guidToString(guid))?.overrideKey)
    return key ? [guid, key] : [guid]
  }

  /** A layer written against a component that an outer decision replaced is stale, not wrong. */
  const isStaleLayer = ({ boundary }: StructuralLayer): boolean =>
    boundary?.replaced.some((component) =>
      resolvesInSourceComponent(index, component, boundary.path)
    ) ?? false

  const unresolvedStructural = (layer: StructuralLayer, cause: SegmentError): void => {
    if (cause.count === 0 && isStaleLayer(layer)) return
    const error = pathError(layer.owner.id, layer.owner.mainComponentId, layer.declaredPath, cause)
    if (layer.swap || cause.count !== 0 || !options.onUnresolvedAssignment) throw error
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

  interface RootResolution {
    effective: GUID | undefined
    /** Components superseded on the way to `effective`, innermost decision first. */
    replaced: GUID[]
    groups: AssignmentGroup[]
    descendant: StructuralLayer[]
  }

  /**
   * Root layers select the effective component and the complete assignment list, in
   * inner-to-outer order so later entries win. Everything else addresses a descendant.
   */
  /** Components an occurrence would have expanded before outer bindings replaced them. */
  const bindingHistory = (
    raw: NodeChange,
    effective: GUID | undefined,
    superseded: readonly GUID[]
  ): GUID[] => {
    const original = raw.symbolData?.symbolID
    if (!effective) return []
    return [...(original ? [original] : []), ...superseded].filter(
      (component) => !sameGuid(component, effective)
    )
  }

  const resolveRoot = (
    raw: NodeChange,
    source: NodeChange,
    superseded: readonly GUID[],
    structural: readonly StructuralLayer[],
    rank: number
  ): RootResolution => {
    let effective = source.symbolData?.symbolID
    const replaced = bindingHistory(raw, effective, superseded)
    const keys = [...componentKeys(raw.symbolData?.symbolID), ...componentKeys(effective)]
    const isKey = (guid: GUID): boolean => keys.some((key) => sameGuid(key, guid))
    const groups: AssignmentGroup[] = [
      { assignments: (source.componentPropAssignments ?? []) as ComponentPropAssignment[], rank }
    ]
    const descendant: StructuralLayer[] = []
    const swapRoot = (swap: GUID): void => {
      if (!effective) throw new Error('Swap target is not an instance')
      if (!sameGuid(effective, swap)) replaced.push(effective)
      effective = swap
      // Later layers may address the root through the replacement's identity.
      for (const key of componentKeys(effective)) if (!isKey(key)) keys.push(key)
    }
    for (const layer of structural) {
      const addressesRoot = layer.path.length === 0 || isKey(layer.path[0])
      if (!addressesRoot || layer.path.length > 1) {
        descendant.push(addressesRoot ? { ...layer, path: layer.path.slice(1) } : layer)
        continue
      }
      if (layer.swap) swapRoot(layer.swap)
      if (layer.assignments.length)
        groups.push({ assignments: layer.assignments, rank: layer.owner.rank })
    }
    return { effective, replaced, groups, descendant }
  }

  const applyPropertyClaim = (
    owner: InstanceOccurrence,
    ownerRank: number,
    target: InstanceOccurrence,
    layer: PropertyLayer
  ): void => {
    // An outer owner's assignment supersedes this owner's explicit value for the same field.
    const bound = assignedFields.get(target)
    const retained = Object.fromEntries(
      Object.entries(layer.props).filter(([field]) => {
        const rank = bound?.get(field)
        return rank === undefined || rank >= ownerRank
      })
    )
    if (Object.keys(retained).length === 0) return
    declareVariableBindingUnits(target, retained as NodeChange)
    invalidateInheritedTextData(target.properties, retained)
    Object.assign(
      target.properties,
      structuredClone(retained),
      mergeVariableConsumptionMaps(target.properties, retained as NodeChange)
    )
    if ('name' in retained) target.hasOwnName = true
    owner.propertyClaims.push({
      declaredBy: owner.sourceId,
      path: structuredClone(layer.path),
      properties: structuredClone(retained)
    })
  }

  /**
   * A claim that addressed a component an instance on its path no longer expands is
   * stale, not wrong: some outer decision replaced that subtree after it was written.
   */
  const isRemovedTarget = (owner: InstanceOccurrence, path: readonly GUID[]): boolean => {
    let current = owner
    for (const [position, segment] of path.entries()) {
      const rest = path.slice(position)
      const replaced = replacedComponents.get(current) ?? []
      if (replaced.some((component) => resolvesInSourceComponent(index, component, rest)))
        return true
      if (position === 0 && isRootGuid(current, segment)) continue
      try {
        current = findSegment(current, segment)
      } catch (error) {
        if (!(error instanceof SegmentError)) throw error
        return false
      }
    }
    return false
  }

  /** Resolve an owner's declared path in its built subtree, or decide how to skip it. */
  const resolveClaimTarget = (
    owner: InstanceOccurrence,
    path: readonly GUID[]
  ): InstanceOccurrence | undefined => {
    try {
      return resolveOccurrencePath(owner, path)
    } catch (cause) {
      if (!(cause instanceof SegmentError)) throw cause
      const error = pathError(owner.sourceId, owner.mainComponentId, path, cause)
      if (error.diagnostic.reason === 'missing-target' && isRemovedTarget(owner, path))
        return undefined
      if (!options.onUnresolvedProperty) throw error
      options.onUnresolvedProperty(error.diagnostic)
      return undefined
    }
  }

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

  /**
   * Expand one source record. `layers` are structural layers addressed relative to this
   * expansion: an empty path configures this record itself, a longer path a descendant.
   */
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
  } => {
    const claims: BoundPropertyClaim[] = []
    const bound = new Map<string, number>()
    const superseded: GUID[] = []
    const source = bindSourceProperties(raw, bindings, (claim, binding) => {
      claims.push(claim)
      if (binding.origin === 'assignment' && binding.rank !== undefined)
        bound.set(claim.field, binding.rank)
      if (claim.field === 'symbolData')
        for (const value of binding.superseded ?? [])
          if (value.guidValue) superseded.push(value.guidValue)
    })
    return { source, claims, bound, superseded }
  }

  /**
   * Expand one source record. `layers` are structural layers addressed relative to this
   * expansion: an empty path configures this record itself, a longer path a descendant.
   */
  const expand = (
    id: string,
    bindings: readonly PropertyBinding[],
    layers: readonly StructuralLayer[],
    rank: number
  ): InstanceOccurrence => {
    if (expanding.has(id)) throw new Error(`Cyclic component expansion at ${id}`)
    const raw = sources.get(id)
    if (!raw) throw new Error(`Missing source node ${id}`)
    const record = bindRecord(raw, bindings)
    const { source } = record
    expanding.add(id)
    try {
      const owner: Owner = { id, rank, mainComponentId: null, unresolved: [] }
      const own = ownLayers(source, owner)
      const structural = [...own.structural, ...layers].sort((a, b) => b.owner.rank - a.owner.rank)
      const root = resolveRoot(raw, source, record.superseded, structural, rank)
      const subtree = root.effective
        ? expandBase(owner, { ...root, effective: root.effective }, rank)
        : expandChildren(id, source, bindings, root.groups, root.descendant, rank)
      const occurrence = createOccurrence(id, raw, source, root, subtree, record.claims)
      assignedFields.set(occurrence, record.bound)
      if (subtree.base && root.replaced.length) replacedComponents.set(occurrence, root.replaced)
      declareSourceVariableBindingUnits(occurrence, source)
      const claims = subtree.dangling
        ? own.claims.filter(({ path }) => path.length === 1 && isRootGuid(occurrence, path[0]))
        : own.claims
      finishOccurrence(occurrence, subtree.base, source, claims, rank, !subtree.dangling)
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

  interface Subtree {
    base: InstanceOccurrence | null
    children: InstanceOccurrence[]
    /** The component is gone; only the record itself remains addressable. */
    dangling?: true
  }

  /**
   * The component expansion receives the assignments as its own root layers and the
   * descendant layers unchanged: both address the same subtree.
   */
  const expandBase = (
    owner: Owner,
    { effective, replaced, groups, descendant }: RootResolution & { effective: GUID },
    rank: number
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
    const base = expand(guidToString(effective), [], [...rootLayers, ...crossing], rank + 1)
    return { base, children: base.children }
  }

  /** A component definition starts a binding scope; ordinary containers pass theirs through. */
  const expandChildren = (
    id: string,
    source: NodeChange,
    bindings: readonly PropertyBinding[],
    groups: readonly AssignmentGroup[],
    descendant: readonly StructuralLayer[],
    rank: number
  ): Subtree => {
    const scoped =
      source.type === 'SYMBOL'
        ? groups.reduce(
            (result, group) => instanceBindings(result, group.assignments, group.rank),
            componentBindings(source)
          )
        : bindings
    const routed = routeToChildren(id, descendant)
    const expanded = (children.get(id) ?? []).map((child) => {
      if (!child.guid) throw new Error('Indexed child has no GUID')
      const childId = guidToString(child.guid)
      return expand(childId, scoped, routed.get(childId) ?? [], rank + 1)
    })
    return { base: null, children: expanded }
  }

  /** Identity and provenance an occurrence inherits from the subtree it expands. */
  const inheritedFromBase = (
    base: InstanceOccurrence | null
  ): Pick<
    InstanceOccurrence,
    | 'mainComponentId'
    | 'mainComponentOverrideKey'
    | 'propertyClaims'
    | 'variableBindingScales'
    | 'hasOwnName'
  > => {
    if (!base) {
      return {
        mainComponentId: null,
        mainComponentOverrideKey: undefined,
        propertyClaims: [],
        variableBindingScales: {},
        hasOwnName: false
      }
    }
    return {
      mainComponentId: base.mainComponentId ?? base.sourceId,
      mainComponentOverrideKey: base.mainComponentOverrideKey ?? base.overrideKey,
      propertyClaims: structuredClone(base.propertyClaims),
      variableBindingScales: { ...base.variableBindingScales },
      hasOwnName: sources.get(base.sourceId)?.type === 'INSTANCE' && base.hasOwnName
    }
  }

  const createOccurrence = (
    id: string,
    raw: NodeChange,
    source: NodeChange,
    { effective, replaced, groups }: RootResolution,
    { base, children: expanded }: Subtree,
    bindingClaims: BoundPropertyClaim[]
  ): InstanceOccurrence => {
    const original = raw.symbolData?.symbolID
    const [, sourceComponentOverrideKey] = componentKeys(original)
    const occurrence: InstanceOccurrence = {
      sourceId: id,
      sourceComponentId: original,
      sourceComponentOverrideKey,
      ...inheritedFromBase(base),
      bindingClaims,
      overrideKey: readOverrideKey(source.overrideKey),
      // The record is the top layer of its own root: its fields are placed state.
      properties: {
        ...base?.properties,
        ...source,
        ...(effective && source.symbolData
          ? { symbolData: { ...source.symbolData, symbolID: effective } }
          : {}),
        ...mergeVariableConsumptionMaps(base?.properties ?? {}, source)
      },
      children: expanded
    }
    if (source.type === 'INSTANCE')
      occurrence.properties.componentPropAssignments = groups.flatMap((g) => g.assignments)
    // A swapped instance without a name of its own takes the replacement's default name.
    if (base && replaced.length && !occurrence.hasOwnName)
      occurrence.properties.name = base.defaultInstanceName ?? base.properties.name
    occurrence.defaultInstanceName = defaultInstanceName(occurrence)
    return occurrence
  }

  /** Apply this owner's property layers, then its placed geometry and saved caches. */
  const finishOccurrence = (
    occurrence: InstanceOccurrence,
    base: InstanceOccurrence | null,
    source: NodeChange,
    claims: readonly PropertyLayer[],
    rank: number,
    derived: boolean
  ): void => {
    for (const claim of claims) {
      const target = resolveClaimTarget(occurrence, claim.path)
      if (target) applyPropertyClaim(occurrence, rank, target, claim)
    }
    applyInstanceLayoutScale(occurrence, source)
    applyPlacedConstraints(occurrence, base, source)
    if (source.type === 'INSTANCE' && source.size)
      occurrence.properties.size = structuredClone(source.size)
    if (derived) applyDerivedBounds(occurrence, source)
  }

  if (sources.get(rootId)?.type !== expectedType) {
    const kind = { INSTANCE: 'an instance', SYMBOL: 'a component', CANVAS: 'a page' }[expectedType]
    throw new Error(`Expected ${kind} source`)
  }
  return expand(rootId, [], [], 0)
}
