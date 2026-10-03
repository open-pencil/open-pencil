import type { GUID, NodeChange } from '@open-pencil/kiwi/fig/codec'

import type { InstanceAssignmentDiagnostic } from './interpret'
import { symbolOverridesOf, type ComponentPropAssignment } from './types'

/** Mutable per-owner frame shared by the layers an owner declares. */
export interface Owner {
  readonly id: string
  /** Expansion depth of the owner; smaller is further out and applies later. */
  readonly rank: number
  mainComponentId: string | null
  /** Assignment layers whose target did not exist, reported once the owner is built. */
  readonly unresolved: InstanceAssignmentDiagnostic[]
}

/** The last instance boundary a layer crossed whose component was replaced. */
export interface ReplacedBoundary {
  readonly replaced: readonly GUID[]
  /** The layer's path relative to that boundary. */
  readonly path: readonly GUID[]
}

/** A swap or assignment addressed relative to the expansion that receives it. */
export interface StructuralLayer {
  readonly owner: Owner
  /** Complete path as declared, for diagnostics. */
  readonly declaredPath: readonly GUID[]
  readonly path: readonly GUID[]
  readonly swap?: GUID
  readonly assignments: readonly ComponentPropAssignment[]
  /** Set when an outer decision replaced a component this layer was written against. */
  readonly boundary?: ReplacedBoundary
}

export interface PropertyLayer {
  readonly path: readonly GUID[]
  readonly props: Record<string, unknown>
}

export interface AssignmentGroup {
  readonly assignments: readonly ComponentPropAssignment[]
  readonly rank: number
}

/** Split an owner's saved overrides into structural layers and property claims. */
export function ownLayers(
  source: NodeChange,
  owner: Owner
): { structural: StructuralLayer[]; claims: PropertyLayer[] } {
  const structural: StructuralLayer[] = []
  const claims: PropertyLayer[] = []
  for (const override of symbolOverridesOf(source)) {
    const { guidPath, overriddenSymbolID: swap, componentPropAssignments, ...props } = override
    const path = guidPath?.guids ?? []
    if (!path.length) continue
    const assignments = componentPropAssignments ?? []
    if (swap || assignments.length)
      structural.push({ owner, declaredPath: path, path, swap, assignments })
    if (Object.keys(props).length) claims.push({ path, props })
  }
  return { structural, claims }
}
