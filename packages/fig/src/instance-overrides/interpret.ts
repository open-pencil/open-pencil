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
import {
  ownLayers,
  type AssignmentGroup,
  type Owner,
  type PropertyLayer,
  type StructuralLayer
} from './layers'
import {
  createComponentLoops,
  type ComponentChoice,
  type ComponentLoopSources,
  type ComponentLoops
} from './loops'
import { loopReferences } from './loops/references'
import { applyDerivedBounds, applyPropertyClaims, createClaimContext } from './occurrence/claims'
import { createOccurrence, type Subtree } from './occurrence/create'
import { createModeScopes, type ModeScope } from './occurrence/modes'
import { isRootGuid, pathError, SegmentError } from './occurrence/path'
import { resolveRoot, type RootResolution } from './occurrence/root'
import type { InstanceOccurrence, InterpretInstanceOptions } from './occurrence/types'
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
import { assignedSlotContent } from './types'

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
  const loops =
    index.componentLoops ??
    createComponentLoops({
      order: index,
      references: lazily(() => loopReferences(index)),
      whole: () => index,
      discover: discoverChoices
    })
  const read =
    (expectedType: 'INSTANCE' | 'SYMBOL' | 'CANVAS') =>
    (id: string, options: InterpretInstanceOptions = {}) =>
      interpretRoot(index, id, expectedType, options, { loops, dropped: loops.dropped })
  return { instance: read('INSTANCE'), component: read('SYMBOL'), page: read('CANVAS') }
}

/** A document's component loops, discovered by expanding definitions as reads expand them. */
export function createDocumentComponentLoops(
  sources: Omit<ComponentLoopSources, 'discover'>
): ComponentLoops {
  return createComponentLoops({ ...sources, discover: discoverChoices })
}

/** A value computed the first time it is asked for. */
function lazily<T>(compute: () => T): () => T {
  let value: { readonly current: T } | undefined
  return () => (value ??= { current: compute() }).current
}

/** How a read treats component loops. */
interface LoopHandling {
  /** The document's loops, checked before a record expands; absent while discovering them. */
  readonly loops?: ComponentLoops
  /** Instances repaired out of their definitions. */
  readonly dropped: () => ReadonlySet<string>
  /** Told of each component an instance expands, with the record that chose it. */
  readonly onChoice?: (choice: ComponentChoice) => void
}

const ignore = (): void => undefined

/**
 * The components a definition's expansion enters and the record that chose each, read leniently:
 * a repair asks this of definitions a loop runs through, which the loop's own entry cuts short.
 */
function discoverChoices(
  index: InterpreterIndex,
  componentId: string,
  dropped: ReadonlySet<string>
): ComponentChoice[] {
  const choices: ComponentChoice[] = []
  const options: InterpretInstanceOptions = {
    onUnresolvedProperty: ignore,
    onUnresolvedAssignment: ignore,
    onMissingComponent: ignore,
    onMissingSlotContent: ignore
  }
  interpretRoot(index, componentId, 'SYMBOL', options, {
    dropped: () => dropped,
    onChoice: (choice) => choices.push(choice)
  })
  return choices
}

/** The record whose layer or default chose a component, and its rank in the read. */
interface Choice {
  ownerId: string
  rank: number
}

/** A component being expanded, and the rank of the owner whose choice entered it. */
interface Entry {
  componentId: string
  rank: number
  chosenAt: number
}

function interpretRoot(
  index: InterpreterIndex,
  rootId: string,
  expectedType: 'INSTANCE' | 'SYMBOL' | 'CANVAS',
  options: InterpretInstanceOptions,
  handling: LoopHandling
): InstanceOccurrence {
  const { sources, children } = index
  /** The components being expanded, outermost first; one recurs where a swap repeats it. */
  const entries: Entry[] = []
  const modeScopes = createModeScopes(index)
  const claimContext = createClaimContext(index, options, handling.dropped)

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

  /** Bind the record's fields from the enclosing component scope, recording provenance. */
  const bindRecord = (
    raw: NodeChange,
    bindings: readonly PropertyBinding[]
  ): {
    source: NodeChange
    claims: BoundPropertyClaim[]
    /** Fields set by an owner's assignment, by that owner's rank. */
    bound: Map<string, number>
    /** The owner whose assignment chose the component the record expands. */
    symbolOwner: Choice | undefined
    /** Swap values earlier owners assigned before a later one replaced them. */
    superseded: GUID[]
    /** The content frame an assignment put in this slot frame. */
    slotContent: string | undefined
  } => {
    const claims: BoundPropertyClaim[] = []
    const bound = new Map<string, number>()
    const superseded: GUID[] = []
    let slotContent: string | undefined
    let symbolOwner: Choice | undefined
    const source = bindSourceProperties(raw, bindings, (claim, binding) => {
      claims.push(claim)
      if (binding.origin === 'assignment' && binding.rank !== undefined)
        bound.set(claim.field, binding.rank)
      if (claim.field === 'symbolData' && binding.rank !== undefined && binding.ownerId)
        symbolOwner = { ownerId: binding.ownerId, rank: binding.rank }
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
    return { source, claims, bound, symbolOwner, superseded, slotContent }
  }

  /**
   * A component expanding inside its own expansion is a loop only when every choice since it
   * was entered came from inside that expansion: its definition then holds it at every depth.
   * A swap or swap property value from further out applies at its own path only, so Figma
   * expands the component once more with its defaults, and so does this read.
   */
  const closesLoop = (componentId: string, chosenAt: number): boolean => {
    let entry = entries.length - 1
    while (entry >= 0 && entries[entry].componentId !== componentId) entry--
    if (entry < 0) return false
    const { rank } = entries[entry]
    if (chosenAt < rank) return false
    return entries.slice(entry + 1).every((later) => later.chosenAt >= rank)
  }

  const reportLeftOut = (instanceId: string): void => options.onCyclicComponent?.({ instanceId })

  /**
   * The component an instance expands, with the record that chose it, once the loops it could
   * reach are repaired; null when expanding it would repeat a loop the repair did not see.
   */
  const choose = (
    id: string,
    { effective, swappedBy }: RootResolution,
    symbolOwner: Choice | undefined,
    rank: number
  ): Choice | null | undefined => {
    if (!effective) return undefined
    const componentId = guidToString(effective)
    const choice = swappedBy
      ? { ownerId: swappedBy.id, rank: swappedBy.rank }
      : (symbolOwner ?? { ownerId: id, rank })
    handling.onChoice?.({ ownerId: choice.ownerId, componentId })
    handling.loops?.ensure(componentId, reportLeftOut)
    if (!closesLoop(componentId, choice.rank)) return choice
    // Discovering choices stops at a loop silently; a read reports what it leaves out.
    if (handling.loops) reportLeftOut(id)
    return null
  }

  /**
   * Expand one source record. `layers` are structural layers addressed relative to this
   * expansion: an empty path configures this record itself, a longer path a descendant.
   * Returns null for an instance left out because its component would contain itself.
   */
  const expand = (
    id: string,
    bindings: readonly PropertyBinding[],
    layers: readonly StructuralLayer[],
    rank: number,
    inherited: ModeScope,
    /** The rank of the owner whose choice made this record an instance's base. */
    chosenAt?: number
  ): InstanceOccurrence | null => {
    options.onProgress?.()
    const raw = sources.get(id)
    if (!raw) throw new Error(`Missing source node ${id}`)
    // A component reached by a choice was checked by the instance that chose it.
    if (raw.type === 'SYMBOL' && chosenAt === undefined) handling.loops?.ensure(id, reportLeftOut)
    const record = bindRecord(raw, bindings)
    const { source } = record
    const entered = raw.type === 'SYMBOL' || chosenAt !== undefined
    if (entered) entries.push({ componentId: id, rank, chosenAt: chosenAt ?? rank })
    try {
      const owner: Owner = { id, rank, mainComponentId: null, unresolved: [] }
      const own = ownLayers(source, owner)
      const structural = [...own.structural, ...layers].sort((a, b) => b.owner.rank - a.owner.rank)
      const root = resolveRoot(sources, raw, source, record.superseded, structural, rank)
      const choice = choose(id, root, record.symbolOwner, rank)
      if (choice === null) return null
      const modes = modeScopes.enter(inherited, raw, root.effective, own.claims)
      let subtree: Subtree
      if (root.effective && choice) {
        subtree = expandBase(
          owner,
          { ...root, effective: root.effective },
          rank,
          choice.rank,
          modes
        )
      } else if (record.slotContent) {
        subtree = expandSlotContent(record.slotContent, root.descendant, rank, modes)
      } else {
        subtree = expandChildren(id, source, bindings, root.groups, root.descendant, rank, modes)
      }
      const occurrence = createOccurrence(sources, id, raw, source, root, subtree, record.claims)
      if (record.slotContent) occurrence.slotContentId = record.slotContent
      claimContext.assignedFields.set(occurrence, record.bound)
      if (subtree.base && root.replaced.length) {
        claimContext.replacedComponents.set(occurrence, root.replaced)
      }
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
      if (entered) entries.pop()
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
    chosenAt: number,
    modes: ModeScope
  ): Subtree => {
    const componentId = guidToString(effective)
    // An instance standing in for a component that a repair left out reads as gone, as it is
    // once the repair is saved.
    if (!sources.has(componentId) || handling.dropped().has(componentId)) {
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
        // The instance that declared the assignments chose what they swap in, not this one.
        owner: { ...owner, id: group.ownerId ?? owner.id, rank: group.rank },
        declaredPath: [],
        path: [],
        assignments: group.assignments
      }))
    const base = expand(componentId, [], [...rootLayers, ...crossing], rank + 1, modes, chosenAt)
    // An instance standing in for a component can lead back into itself; it then shows nothing.
    if (!base) return { base: null, children: [], dangling: true }
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
            (result, group) =>
              instanceBindings(result, group.assignments, group.rank, group.ownerId),
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
    const expanded = (children.get(parentId) ?? []).flatMap((child) => {
      if (!child.guid) throw new Error('Indexed child has no GUID')
      const childId = guidToString(child.guid)
      if (handling.dropped().has(childId)) return []
      return expand(childId, bindings, routed.get(childId) ?? [], rank + 1, modes) ?? []
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
    applyPropertyClaims(claimContext, occurrence, rank, claims)
    applyInstanceLayoutScale(occurrence, source)
    applyPlacedConstraints(occurrence, base, source)
    modeScopes.applySavedSize(occurrence, source, modes)
    if (derived) {
      applyDerivedBounds(claimContext, occurrence, source)
    }
  }

  if (sources.get(rootId)?.type !== expectedType) {
    const kind = { INSTANCE: 'an instance', SYMBOL: 'a component', CANVAS: 'a page' }[expectedType]
    throw new Error(`Expected ${kind} source`)
  }
  const occurrence = expand(rootId, [], [], 0, modeScopes.atParentOf(rootId))
  if (!occurrence) throw new Error(`Instance ${rootId} would contain its own component`)
  return occurrence
}
