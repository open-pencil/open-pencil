import { bindingVariant, instanceVariant, variantSet } from '#fig/document/component/links'
import { effectiveFigmaRawNodeFields } from '#fig/source-metadata'
import { uniqBy } from 'es-toolkit/array'

import type { GUID } from '@open-pencil/kiwi/fig'
import { guidToString } from '@open-pencil/kiwi/fig/guid'
import type { ComponentPropertyDefinition, SceneGraph, SceneNode } from '@open-pencil/scene-graph'

import { getOrCreatePropertyGuid, type SceneNodeToKiwiContext } from './context'

/**
 * Figma reads a set's boolean, text, instance swap, and slot properties through each variant's
 * own copy of them, linked by `parentPropDefId`: the variant's layers bind to the copy, and an
 * instance of the variant assigns it. A set without the copies opens with instances that lack
 * those properties (desktop 126). OpenPencil keeps the set's properties alone, and writes the
 * copies from them, under the GUIDs the file gave them or new ones.
 */

interface SavedCopy {
  id?: GUID
  parentPropDefId?: GUID
  /** The variant the copy was read for; a duplicate of it carries the copy too. */
  keptBy?: string
}

/** The properties each save has worked out for a set, by the map it keeps copy GUIDs in. */
const setPropertiesByExport = new WeakMap<
  Map<string, GUID>,
  Map<string, ComponentPropertyDefinition[]>
>()

/**
 * The properties a set is written with: its own, then any its variants define themselves, as
 * an older OpenPencil saved them. Figma keeps every variant's properties on its set (desktop 126),
 * so the set writes them all and each variant writes a copy of each but the variant properties.
 */
export function writtenSetProperties(
  context: SceneNodeToKiwiContext,
  set: SceneNode
): ComponentPropertyDefinition[] {
  let bySet = setPropertiesByExport.get(context.propertyCopyGuids)
  if (!bySet) {
    bySet = new Map()
    setPropertiesByExport.set(context.propertyCopyGuids, bySet)
  }
  let properties = bySet.get(set.id)
  if (!properties) {
    const variants = context.graph
      .getChildren(set.id)
      .flatMap((variant) =>
        variant.type === 'COMPONENT'
          ? variant.componentPropertyDefinitions.filter((item) => item.type !== 'VARIANT')
          : []
      )
    properties = uniqBy([...set.componentPropertyDefinitions, ...variants], (item) => item.id)
    bySet.set(set.id, properties)
  }
  return properties
}

/** Whether a property is one each of the set's variants copies: any but a variant property. */
function copiedProperty(
  context: SceneNodeToKiwiContext,
  set: SceneNode,
  propertyId: string
): boolean {
  return writtenSetProperties(context, set).some(
    (definition) => definition.id === propertyId && definition.type !== 'VARIANT'
  )
}

/** The GUID a variant's copy of a set property is written with. */
function copyGuid(
  context: SceneNodeToKiwiContext,
  variant: SceneNode,
  propertyId: string,
  localIdCounter: { value: number }
): GUID {
  const guids = context.propertyCopyGuids
  const key = `${variant.id}\0${propertyId}`
  const known = guids.get(key)
  if (known) return known
  const property = guidToString(getOrCreatePropertyGuid(context, propertyId, localIdCounter))
  const saved = effectiveFigmaRawNodeFields(variant).componentPropDefs
  const kept = (Array.isArray(saved) ? (saved as SavedCopy[]) : []).find(
    (copy) =>
      copy.id &&
      copy.parentPropDefId &&
      copy.keptBy === variant.id &&
      guidToString(copy.parentPropDefId) === property
  )?.id
  const guid = kept ?? { sessionID: 1, localID: localIdCounter.value++ }
  if (!kept) context.assignedGuidValues?.add(`${guid.sessionID}:${guid.localID}`)
  guids.set(key, guid)
  return guid
}

/**
 * The GUIDs variants keep for the copies their file saved, which a save writes again, so the
 * counter that mints new GUIDs must start past them.
 */
export function savedPropertyCopyIds(graph: SceneGraph): string[] {
  const ids: string[] = []
  for (const node of graph.getAllNodes()) {
    if (!variantSet(graph, node)) continue
    const saved = effectiveFigmaRawNodeFields(node).componentPropDefs
    for (const copy of Array.isArray(saved) ? (saved as SavedCopy[]) : [])
      if (copy.id && copy.parentPropDefId) ids.push(guidToString(copy.id))
  }
  return ids
}

/** A variant's copies of its set's properties, as its `componentPropDefs`; none elsewhere. */
export function variantPropertyCopies(
  context: SceneNodeToKiwiContext,
  node: SceneNode,
  localIdCounter: { value: number }
): { id: GUID; parentPropDefId: GUID }[] | null {
  const set = variantSet(context.graph, node)
  if (!set) return null
  return writtenSetProperties(context, set).flatMap((definition) =>
    definition.type === 'VARIANT'
      ? []
      : [
          {
            id: copyGuid(context, node, definition.id, localIdCounter),
            parentPropDefId: getOrCreatePropertyGuid(context, definition.id, localIdCounter)
          }
        ]
  )
}

/** The GUID a property is named by in `variant`'s file context: its copy, if it has one. */
function propertyGuidIn(
  context: SceneNodeToKiwiContext,
  variant: SceneNode | undefined,
  propertyId: string,
  localIdCounter: { value: number }
): GUID {
  const set = variant && variantSet(context.graph, variant)
  return variant && set && copiedProperty(context, set, propertyId)
    ? copyGuid(context, variant, propertyId, localIdCounter)
    : getOrCreatePropertyGuid(context, propertyId, localIdCounter)
}

/** The GUID a layer's reference names a property with: its variant's copy, if it has one. */
export function boundPropertyGuid(
  context: SceneNodeToKiwiContext,
  node: SceneNode,
  propertyId: string,
  localIdCounter: { value: number }
): GUID {
  return propertyGuidIn(context, bindingVariant(context.graph, node), propertyId, localIdCounter)
}

/** The GUID an instance assigns a property by: its component's copy, if it has one. */
export function assignedPropertyGuid(
  context: SceneNodeToKiwiContext,
  instance: SceneNode,
  propertyId: string,
  localIdCounter: { value: number }
): GUID {
  return propertyGuidIn(
    context,
    instanceVariant(context.graph, instance),
    propertyId,
    localIdCounter
  )
}
