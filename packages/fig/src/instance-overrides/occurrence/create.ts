import { mergeVariableConsumptionMaps } from '#fig/node-change/variable/bindings'
import { omit } from 'es-toolkit/object'

import type { NodeChange } from '@open-pencil/kiwi/fig/codec'
import { guidToString } from '@open-pencil/kiwi/fig/guid'

import type { BoundPropertyClaim } from '../bindings/properties'
import { COMPONENT_IDENTITY_FIELDS } from '../fields'
import { ownerAssignedProperties } from '../layers'
import { readOverrideKey, sameGuid, type InterpreterIndex } from '../source-index'
import { assignedSlotContent, type ComponentPropAssignment } from '../types'
import { componentKeys, type RootResolution } from './root'
import type { InstanceOccurrence } from './types'

type Sources = InterpreterIndex['sources']

/** The name an instance of this occurrence takes by default: its variant set's, for a variant. */
function defaultInstanceName(sources: Sources, occurrence: InstanceOccurrence): string | undefined {
  const source = sources.get(occurrence.sourceId)
  if (source?.type === 'INSTANCE') return occurrence.properties.name
  const parentGuid = source?.parentIndex?.guid
  const parent = parentGuid ? sources.get(guidToString(parentGuid)) : undefined
  return parent?.isStateGroup === true ? parent.name : occurrence.properties.name
}

/** What an occurrence expanded into: its component's root, or its own children. */
export interface Subtree {
  base: InstanceOccurrence | null
  children: InstanceOccurrence[]
  /** The component is gone; only the record itself remains addressable. */
  dangling?: true
}

function namesMissingSlotContent(sources: Sources, assignment: ComponentPropAssignment): boolean {
  const content = assignedSlotContent(assignment.varValue?.value)
  return !!content && !sources.has(guidToString(content))
}

/** Identity and provenance an occurrence inherits from the subtree it expands. */
function inheritedFromBase(
  sources: Sources,
  base: InstanceOccurrence | null
): Pick<
  InstanceOccurrence,
  | 'mainComponentId'
  | 'mainComponentOverrideKey'
  | 'propertyClaims'
  | 'variableBindingScales'
  | 'hasOwnName'
> {
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

/** The occurrence a record places: its own fields over the subtree it expanded. */
export function createOccurrence(
  sources: Sources,
  id: string,
  raw: NodeChange,
  source: NodeChange,
  { effective, replaced, groups }: RootResolution,
  { base, children: expanded }: Subtree,
  bindingClaims: BoundPropertyClaim[]
): InstanceOccurrence {
  const original = raw.symbolData?.symbolID
  const [, sourceComponentOverrideKey] = componentKeys(sources, original)
  // A swapped root draws the replacement's paint, so the old paint's style link goes with it.
  const placed =
    base && effective && !sameGuid(original, effective) && source.type === 'INSTANCE'
      ? omit(source, ['fillPaints', 'styleIdForFill'])
      : source
  const occurrence: InstanceOccurrence = {
    sourceId: id,
    sourceComponentId: original,
    sourceComponentOverrideKey,
    ...inheritedFromBase(sources, base),
    bindingClaims,
    overrideKey: readOverrideKey(source.overrideKey),
    // The record is the top layer of its own root: its fields are placed state.
    properties: {
      // The component's look carries over; its identity does not.
      ...(base && omit(base.properties, COMPONENT_IDENTITY_FIELDS)),
      ...placed,
      ...(effective && source.symbolData
        ? { symbolData: { ...source.symbolData, symbolID: effective } }
        : {}),
      ...mergeVariableConsumptionMaps(base?.properties ?? {}, source)
    },
    children: expanded
  }
  if (source.type === 'INSTANCE') {
    occurrence.properties.componentPropAssignments = groups
      .flatMap((g) => g.assignments)
      // A slot whose content frame is gone falls back to its component's content.
      .filter((assignment) => !namesMissingSlotContent(sources, assignment))
    occurrence.ownerAssignedProperties = ownerAssignedProperties(
      groups,
      (assignment) => !namesMissingSlotContent(sources, assignment)
    )
  }
  // A swapped instance without a name of its own takes the replacement's default name.
  if (base && replaced.length && !occurrence.hasOwnName)
    occurrence.properties.name = base.defaultInstanceName ?? base.properties.name
  occurrence.defaultInstanceName = defaultInstanceName(sources, occurrence)
  return occurrence
}
