import type { GUID, NodeChange } from '@open-pencil/kiwi/fig/codec'
import type { Vector } from '@open-pencil/scene-graph'

import type { BoundPropertyClaim } from '../bindings/properties'
import type { ComponentPropAssignment } from '../types'

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
  /**
   * Set on a slot frame whose instance assigned it content: the source id of the content
   * frame its children were expanded from. Those children belong to the instance, not to
   * the component, so they have no counterpart in the component's expansion.
   */
  slotContentId?: string
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

/** A slot assignment naming a content frame the archive no longer contains. */
export interface MissingSlotContentDiagnostic {
  /** The slot frame being expanded, as the source record that declares it. */
  slotId: string
  slotContentId: string
}

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
  /** Keep the component's own slot content where the assigned content frame is gone. */
  onMissingSlotContent?: (diagnostic: MissingSlotContentDiagnostic) => void
}
