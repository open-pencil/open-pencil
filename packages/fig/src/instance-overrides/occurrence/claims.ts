import { cloneRecord } from '#fig/node-change/clone'
import { claimedVariableMaps } from '#fig/node-change/variable/bindings'

import type { GUID } from '@open-pencil/kiwi/fig'
import type { NodeChange } from '@open-pencil/kiwi/fig/codec'

import { declareVariableBindingUnits } from '../bindings/variables'
import { completeClearedStyleClaim } from '../cleared-style'
import { applyDerivedEntry } from '../derived-symbol-data'
import type { PropertyLayer } from '../layers'
import { resolvesInSourceComponent, type InterpreterIndex } from '../source-index'
import { invalidateInheritedTextData } from '../text-provenance'
import type { DerivedSymbolOverride } from '../types'
import { findSegment, isRootGuid, pathError, resolveOccurrencePath, SegmentError } from './path'
import type { InstanceOccurrence, InterpretInstanceOptions } from './types'

export interface ClaimContext {
  readonly index: InterpreterIndex
  readonly options: InterpretInstanceOptions
  /** Fields set by an owner's assignment, by the rank of that owner. */
  readonly assignedFields: WeakMap<InstanceOccurrence, Map<string, number>>
  /** Components an occurrence expanded before an outer decision replaced them. */
  readonly replacedComponents: WeakMap<InstanceOccurrence, readonly GUID[]>
}

export function createClaimContext(
  index: InterpreterIndex,
  options: InterpretInstanceOptions
): ClaimContext {
  return { index, options, assignedFields: new WeakMap(), replacedComponents: new WeakMap() }
}

function applyPropertyClaim(
  { index, assignedFields }: ClaimContext,
  owner: InstanceOccurrence,
  ownerRank: number,
  target: InstanceOccurrence,
  layer: PropertyLayer
): void {
  // An outer owner's assignment supersedes this owner's explicit value for the same field.
  const bound = assignedFields.get(target)
  const retained = Object.fromEntries(
    Object.entries(layer.props).filter(([field]) => {
      const rank = bound?.get(field)
      return rank === undefined || rank >= ownerRank
    })
  )
  if (Object.keys(retained).length === 0) {
    return
  }
  completeClearedStyleClaim(target, retained, index.sources.get(target.sourceId))
  declareVariableBindingUnits(target, retained)
  invalidateInheritedTextData(target.properties, retained)
  Object.assign(
    target.properties,
    cloneRecord(retained),
    claimedVariableMaps(target.properties, retained as NodeChange)
  )
  if ('name' in retained) {
    target.hasOwnName = true
  }
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
function isRemovedTarget(
  { index, replacedComponents }: ClaimContext,
  owner: InstanceOccurrence,
  path: readonly GUID[]
): boolean {
  let current = owner
  for (const [position, segment] of path.entries()) {
    const rest = path.slice(position)
    const replaced = replacedComponents.get(current) ?? []
    if (replaced.some((component) => resolvesInSourceComponent(index, component, rest))) {
      return true
    }
    if (position === 0 && isRootGuid(current, segment)) {
      continue
    }
    try {
      current = findSegment(current, segment)
    } catch (error) {
      if (!(error instanceof SegmentError)) {
        throw error
      }
      return false
    }
  }
  return false
}

/** Resolve an owner's declared path in its built subtree, or decide how to skip it. */
function resolveClaimTarget(
  context: ClaimContext,
  owner: InstanceOccurrence,
  path: readonly GUID[]
): InstanceOccurrence | undefined {
  try {
    return resolveOccurrencePath(owner, path)
  } catch (cause) {
    if (!(cause instanceof SegmentError)) {
      throw cause
    }
    const error = pathError(owner.sourceId, owner.mainComponentId, path, cause)
    if (error.diagnostic.reason === 'missing-target' && isRemovedTarget(context, owner, path)) {
      return undefined
    }
    const { options } = context
    if (!options.onUnresolvedProperty) {
      throw error
    }
    options.onUnresolvedProperty(error.diagnostic)
    return undefined
  }
}

export function applyPropertyClaims(
  context: ClaimContext,
  owner: InstanceOccurrence,
  ownerRank: number,
  claims: readonly PropertyLayer[]
): void {
  for (const claim of claims) {
    const target = resolveClaimTarget(context, owner, claim.path)
    if (target) {
      applyPropertyClaim(context, owner, ownerRank, target, claim)
    }
  }
}

export function applyDerivedBounds(
  context: ClaimContext,
  owner: InstanceOccurrence,
  source: NodeChange
): void {
  if (!context.options.derivedBounds) {
    return
  }
  const derived = source.derivedSymbolData as DerivedSymbolOverride[] | undefined
  for (const entry of derived ?? []) {
    const path = entry.guidPath?.guids
    if (!path?.length) {
      continue
    }
    const target = resolveClaimTarget(context, owner, path)
    // Placed root bounds belong to its NodeChange.
    if (!target || target === owner) {
      continue
    }
    applyDerivedEntry(target, entry)
  }
}
