import type { GUID, NodeChange } from '@open-pencil/kiwi/fig/codec'
import { guidToString } from '@open-pencil/kiwi/fig/guid'

import {
  fieldsBoundByAssignments,
  bindSourceProperties,
  componentBindings,
  instanceBindings,
  type PropertyBinding
} from './interpret-bindings'
import type {
  ComponentPropAssignment,
  DerivedSymbolOverride,
  SymbolData,
  SymbolOverride
} from './types'

function readOverrideKey(value: unknown): GUID | undefined {
  if (!value || typeof value !== 'object' || !('sessionID' in value) || !('localID' in value))
    return undefined
  if (typeof value.sessionID !== 'number' || typeof value.localID !== 'number') return undefined
  return { sessionID: value.sessionID, localID: value.localID }
}

/** One occurrence, not a shared source node or a SceneGraph editing clone. */
export interface InstanceOccurrence {
  readonly sourceId: string
  readonly overrideKey: GUID | undefined
  mainComponentId: string | null
  properties: NodeChange
  children: InstanceOccurrence[]
}

export interface InstancePathDiagnostic {
  ownerId: string
  path: readonly GUID[]
  reason: 'missing-target' | 'ambiguous-target'
}

export interface InterpretInstanceOptions {
  /** Apply explicitly saved effective bounds, geometry and typography; no inferred scaling or layout. */
  derivedBounds?: boolean
  /** Unresolved property overrides are skipped only when a diagnostic receiver is supplied. */
  onUnresolvedProperty?: (diagnostic: InstancePathDiagnostic) => void
}

class InstancePathError extends Error {
  constructor(
    readonly diagnostic: InstancePathDiagnostic,
    message: string
  ) {
    super(message)
    this.name = 'InstancePathError'
  }
}

class SegmentError extends Error {
  constructor(
    readonly count: number,
    guid: GUID
  ) {
    super(`Expected one instance-path target for ${guidToString(guid)}; found ${count}`)
    this.name = 'SegmentError'
  }
}

function sameGuid(left: GUID | undefined, right: GUID): boolean {
  return left?.sessionID === right.sessionID && left.localID === right.localID
}

/** Search through ordinary containers, but never cross an instance boundary implicitly. */
function findSegment(root: InstanceOccurrence, guid: GUID): InstanceOccurrence {
  const matches: InstanceOccurrence[] = []
  const visit = (node: InstanceOccurrence): void => {
    if (sameGuid(node.overrideKey, guid) || node.sourceId === guidToString(guid)) {
      matches.push(node)
      return
    }
    if (node.mainComponentId !== null) return
    for (const child of node.children) visit(child)
  }
  for (const child of root.children) visit(child)
  if (matches.length !== 1) {
    throw new SegmentError(matches.length, guid)
  }
  return matches[0]
}

function applyPropertyOverrides(
  overrides: readonly SymbolOverride[],
  targetFor: (path: readonly GUID[]) => InstanceOccurrence,
  options: InterpretInstanceOptions,
  record: (target: InstanceOccurrence, props: Record<string, unknown>) => void
): void {
  for (const override of overrides) {
    const {
      guidPath,
      overriddenSymbolID: _swap,
      componentPropAssignments: _assignments,
      ...props
    } = override
    if (!guidPath?.guids?.length || Object.keys(props).length === 0) continue
    let target: InstanceOccurrence
    try {
      target = targetFor(guidPath.guids)
    } catch (error) {
      if (!(error instanceof InstancePathError) || !options.onUnresolvedProperty) throw error
      options.onUnresolvedProperty(error.diagnostic)
      continue
    }
    Object.assign(target.properties, structuredClone(props))
    record(target, props)
  }
}

function applyDerivedBounds(
  source: NodeChange,
  root: InstanceOccurrence,
  targetFor: (path: readonly GUID[]) => InstanceOccurrence,
  options: InterpretInstanceOptions
): void {
  if (!options.derivedBounds) return
  const derived = source.derivedSymbolData as DerivedSymbolOverride[] | undefined
  for (const entry of derived ?? []) {
    const path = entry.guidPath?.guids
    if (!path?.length) continue
    let target: InstanceOccurrence
    try {
      target = targetFor(path)
    } catch (error) {
      // Derived records can retain stale paths just like explicit property records.
      if (!(error instanceof InstancePathError) || !options.onUnresolvedProperty) throw error
      options.onUnresolvedProperty(error.diagnostic)
      continue
    }
    if (target === root) continue // Placed root bounds belong to its NodeChange.
    if (entry.fontSize !== undefined) target.properties.fontSize = entry.fontSize
    if (entry.lineHeight !== undefined)
      target.properties.lineHeight = structuredClone(entry.lineHeight)
    if (entry.letterSpacing !== undefined)
      target.properties.letterSpacing = structuredClone(entry.letterSpacing)
    if (entry.size) target.properties.size = structuredClone(entry.size)
    if (entry.transform) target.properties.transform = structuredClone(entry.transform)
    const { fillGeometry, strokeGeometry, vectorData } = structuredClone(entry)
    if (fillGeometry) target.properties.fillGeometry = fillGeometry
    if (strokeGeometry) target.properties.strokeGeometry = strokeGeometry
    if (vectorData) target.properties.vectorData = vectorData
  }
}

function symbolOverrides(source: NodeChange): readonly SymbolOverride[] {
  return (source.symbolData as SymbolData | undefined)?.symbolOverrides ?? []
}

function replaceOccurrence(target: InstanceOccurrence, replacement: InstanceOccurrence): void {
  if (target.mainComponentId === null) throw new Error('Swap target is not an instance')
  target.mainComponentId = replacement.mainComponentId ?? replacement.sourceId
  const { guid, parentIndex, type, name, transform, size } = target.properties
  target.properties = { ...replacement.properties, guid, parentIndex, type, name, transform, size }
  target.children = replacement.children
}

function samePath(a: readonly GUID[], b: readonly GUID[]): boolean {
  return a.length === b.length && a.every((guid, index) => sameGuid(b[index], guid))
}

function groupedStructuralOverrides(overrides: readonly SymbolOverride[]): SymbolOverride[] {
  const groups: SymbolOverride[] = []
  for (const override of overrides) {
    const path = override.guidPath?.guids
    if (!path?.length) continue
    if (!override.overriddenSymbolID && !override.componentPropAssignments?.length) continue
    const existing = groups.find((group) => samePath(group.guidPath?.guids ?? [], path))
    if (!existing) {
      groups.push(structuredClone(override))
      continue
    }
    if (override.overriddenSymbolID) existing.overriddenSymbolID = override.overriddenSymbolID
    existing.componentPropAssignments = [
      ...(existing.componentPropAssignments ?? []),
      ...(override.componentPropAssignments ?? [])
    ]
  }
  return groups.sort((a, b) => (a.guidPath?.guids?.length ?? 0) - (b.guidPath?.guids?.length ?? 0))
}

function rootAssignments(source: NodeChange): ComponentPropAssignment[] {
  return symbolOverrides(source).flatMap((override) => {
    const path = override.guidPath?.guids
    return path?.length === 1 && sameGuid(source.symbolData?.symbolID, path[0])
      ? (override.componentPropAssignments ?? [])
      : []
  })
}

function applyStructuralOverrides(
  overrides: readonly SymbolOverride[],
  targetFor: (path: readonly GUID[]) => InstanceOccurrence,
  expand: (
    id: string,
    bindings?: readonly PropertyBinding[],
    assignments?: readonly ComponentPropAssignment[]
  ) => InstanceOccurrence,
  reconfigure: (
    target: InstanceOccurrence,
    assignments: readonly ComponentPropAssignment[]
  ) => void,
  adopt: (target: InstanceOccurrence, replacement: InstanceOccurrence) => void
): void {
  const structural = groupedStructuralOverrides(overrides)
  for (const override of structural) {
    const path = override.guidPath?.guids
    if (!path?.length) continue
    const target = targetFor(path)
    if (override.overriddenSymbolID) {
      const replacement = expand(
        guidToString(override.overriddenSymbolID),
        [],
        override.componentPropAssignments
      )
      replaceOccurrence(target, replacement)
      adopt(target, replacement)
    } else {
      reconfigure(target, override.componentPropAssignments ?? [])
    }
  }
}

function bindingContext(
  source: NodeChange,
  bindings: readonly PropertyBinding[],
  assignments: readonly ComponentPropAssignment[]
): readonly PropertyBinding[] {
  return source.type === 'SYMBOL'
    ? instanceBindings(componentBindings(source), assignments)
    : bindings
}

/**
 * Interpret source component expansion and explicit symbol overrides without SceneGraph.
 * This slice interprets direct component bindings and explicit symbol overrides.
 * Variables and derived layout remain unsupported.
 */
export function interpretInstance(
  changes: readonly NodeChange[],
  instanceId: string,
  options: InterpretInstanceOptions = {}
): InstanceOccurrence {
  const sources = new Map<string, NodeChange>()
  const children = new Map<string, NodeChange[]>()
  for (const change of changes) {
    if (!change.guid) continue
    const id = guidToString(change.guid)
    if (sources.has(id)) throw new Error(`Duplicate source node ${id}`)
    sources.set(id, change)
    if (!change.parentIndex?.guid) continue
    const parentId = guidToString(change.parentIndex.guid)
    const siblings = children.get(parentId)
    if (siblings) siblings.push(change)
    else children.set(parentId, [change])
  }
  for (const siblings of children.values()) {
    siblings.sort((a, b) => {
      const left = a.parentIndex?.position ?? ''
      const right = b.parentIndex?.position ?? ''
      if (left === right) return 0
      return left < right ? -1 : 1
    })
  }

  const expanding = new Set<string>()
  const propertyPatches = new WeakMap<InstanceOccurrence, Record<string, unknown>>()
  const recordPatch = (target: InstanceOccurrence, props: Record<string, unknown>): void => {
    propertyPatches.set(target, { ...propertyPatches.get(target), ...structuredClone(props) })
  }
  const restorePatches = (
    previous: InstanceOccurrence,
    next: InstanceOccurrence,
    assignments: readonly ComponentPropAssignment[],
    descendBindings = true
  ): void => {
    const patch = propertyPatches.get(previous)
    if (patch) {
      const boundFields = fieldsBoundByAssignments(next.properties, assignments)
      const retained = Object.fromEntries(
        Object.entries(patch).filter(([field]) => !boundFields.has(field))
      )
      Object.assign(next.properties, structuredClone(retained))
      recordPatch(next, retained)
    }
    for (const child of previous.children) {
      const matches = next.children.filter((candidate) => candidate.sourceId === child.sourceId)
      if (matches.length === 1)
        restorePatches(
          child,
          matches[0],
          descendBindings ? assignments : [],
          child.mainComponentId === null
        )
    }
  }
  // Re-expansion recipes are occurrence-local; retaining them avoids falling back
  // to the unconfigured source when a more distant owner changes one binding.
  const recipes = new WeakMap<
    InstanceOccurrence,
    (assignments: readonly ComponentPropAssignment[]) => InstanceOccurrence
  >()
  const adopt = (target: InstanceOccurrence, replacement: InstanceOccurrence): void => {
    const recipe = recipes.get(replacement)
    if (!recipe) throw new Error('Missing occurrence expansion recipe')
    recipes.set(target, recipe)
  }
  const reconfigure = (
    target: InstanceOccurrence,
    assignments: readonly ComponentPropAssignment[]
  ): void => {
    const recipe = recipes.get(target)
    if (!recipe) throw new Error('Missing occurrence expansion recipe')
    const replacement = recipe(assignments)
    restorePatches(target, replacement, assignments)
    replaceOccurrence(target, replacement)
    adopt(target, replacement)
  }
  const expand = (
    id: string,
    bindings: readonly PropertyBinding[] = [],
    assignments: readonly ComponentPropAssignment[] = []
  ): InstanceOccurrence => {
    if (expanding.has(id)) throw new Error(`Cyclic component expansion at ${id}`)
    const raw = sources.get(id)
    if (!raw) throw new Error(`Missing source node ${id}`)
    const source = bindSourceProperties(raw, bindings)
    expanding.add(id)
    try {
      const symbolId = source.symbolData?.symbolID
      const ownAssignments = (source.componentPropAssignments ?? []) as ComponentPropAssignment[]
      const base = symbolId
        ? expand(
            guidToString(symbolId),
            [],
            [...ownAssignments, ...rootAssignments(source), ...assignments]
          )
        : null
      const childBindings = bindingContext(source, bindings, assignments)
      const occurrence: InstanceOccurrence = {
        sourceId: id,
        overrideKey: readOverrideKey(source.overrideKey),
        mainComponentId: base ? (base.mainComponentId ?? base.sourceId) : null,
        properties: { ...base?.properties, ...structuredClone(source) },
        children:
          base?.children ??
          (children.get(id) ?? []).map((child) => {
            if (!child.guid) throw new Error('Indexed child has no GUID')
            return expand(guidToString(child.guid), childBindings)
          })
      }
      const overrides = symbolOverrides(source)
      const targetFor = (path: readonly GUID[]): InstanceOccurrence => {
        let target = occurrence
        try {
          for (const [index, guid] of path.entries()) {
            if (index === 0 && sameGuid(symbolId, guid)) continue
            target = findSegment(target, guid)
          }
        } catch (cause) {
          if (!(cause instanceof SegmentError)) throw cause
          throw new InstancePathError(
            {
              ownerId: id,
              path: structuredClone(path),
              reason: cause.count === 0 ? 'missing-target' : 'ambiguous-target'
            },
            `Override declared by ${id}, path [${path.map(guidToString).join(', ')}]: ${cause.message}`
          )
        }
        return target
      }
      applyStructuralOverrides(
        overrides.filter((override) => {
          const path = override.guidPath?.guids
          return !(
            path?.length === 1 &&
            sameGuid(symbolId, path[0]) &&
            !override.overriddenSymbolID
          )
        }),
        targetFor,
        expand,
        reconfigure,
        adopt
      )
      applyPropertyOverrides(overrides, targetFor, options, recordPatch)
      applyDerivedBounds(source, occurrence, targetFor, options)
      recipes.set(occurrence, (next) => expand(id, bindings, [...assignments, ...next]))
      return occurrence
    } finally {
      expanding.delete(id)
    }
  }
  if (sources.get(instanceId)?.type !== 'INSTANCE') throw new Error('Expected an instance source')
  return expand(instanceId)
}
