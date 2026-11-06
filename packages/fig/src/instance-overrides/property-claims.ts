import type { GUID } from '@open-pencil/kiwi/fig'
import type { NodeChange } from '@open-pencil/kiwi/fig/codec'

import { cloneRecord } from '../node-change/clone'
import { claimedVariableMaps } from '../node-change/variable/bindings'
import { declareVariableBindingUnits } from './bindings/variables'
import { completeClearedStyleClaim } from './cleared-style'
import type { PropertyLayer } from './layers'
import {
  findSegment,
  isRootGuid,
  pathError,
  resolveOccurrencePath,
  SegmentError
} from './occurrence/path'
import type { InstanceOccurrence, InterpretInstanceOptions } from './occurrence/types'
import { resolvesInSourceComponent, type InterpreterIndex } from './source-index'
import { invalidateInheritedTextData } from './text-provenance'

/** What one interpretation shares with the property layers its owners apply. */
interface PropertyClaimScope {
  readonly index: InterpreterIndex
  readonly options: InterpretInstanceOptions
  /** Fields set by an owner's assignment, by the rank of that owner. */
  readonly assignedFields: WeakMap<InstanceOccurrence, Map<string, number>>
  /** Components an occurrence expanded before an outer decision replaced them. */
  readonly replacedComponents: WeakMap<InstanceOccurrence, readonly GUID[]>
}

/** Property layers an owner applies onto its built subtree, and the paths they address. */
export function createPropertyClaims({
  index,
  options,
  assignedFields,
  replacedComponents
}: PropertyClaimScope) {
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
    completeClearedStyleClaim(target, retained, index.sources.get(target.sourceId))
    declareVariableBindingUnits(target, retained)
    invalidateInheritedTextData(target.properties, retained)
    Object.assign(
      target.properties,
      cloneRecord(retained),
      claimedVariableMaps(target.properties, retained as NodeChange)
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

  return { applyPropertyClaim, resolveClaimTarget }
}
