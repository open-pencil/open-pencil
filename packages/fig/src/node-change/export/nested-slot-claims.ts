import { isEqual, isPlainObject } from 'es-toolkit'

import {
  findInstanceAncestor,
  getInstanceOverride,
  scaleNodeChanges,
  slotPropertyId,
  type SceneGraph,
  type SceneNode
} from '@open-pencil/scene-graph'

import { getOrCreatePropertyGuid, type SceneNodeToKiwiContext } from './context'
import { slotContentAssignment } from './slots'

/** Fields that identify a layer or link it to its source rather than describe how it looks. */
const IDENTITY_FIELDS = new Set([
  'id',
  'parentId',
  'childIds',
  'source',
  'componentId',
  'overrideKey',
  'instanceOverrides'
])

/** Scale maps hold `1` for a field that was never rescaled, which is the same as no entry. */
function withoutUnitScales(
  scales: Partial<Record<string, number>>
): Partial<Record<string, number>> {
  return Object.fromEntries(
    Object.entries(scales).filter(([, value]) => value === undefined || !sameValue(value, 1))
  )
}

/**
 * Whether two field values match, where numbers that differ only by the rounding of a rescale
 * are the same and a field a rescale left undefined is the same as one that is missing.
 */
function sameValue(a: unknown, b: unknown): boolean {
  if (typeof a === 'number' && typeof b === 'number')
    return Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b))
  if (Array.isArray(a) && Array.isArray(b))
    return a.length === b.length && a.every((item, index) => sameValue(item, b[index]))
  if (isPlainObject(a) && isPlainObject(b)) {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)])
    return [...keys].every((key) => sameValue(a[key], b[key]))
  }
  return isEqual(a, b)
}

/**
 * A layer as it looks at the source's scale. A copy rescaled with its instance holds every
 * layer scaled, which is not an edit of the slot.
 */
function atSourceScale(node: SceneNode, ratio: number): SceneNode {
  if (ratio === 1) return node
  const unscale = (scales: Partial<Record<string, number>>) =>
    Object.fromEntries(
      Object.entries(scales).map(([field, value]) => [field, value && value / ratio])
    )
  return {
    ...node,
    ...scaleNodeChanges(node, 1 / ratio, true),
    // A rescale also changes the units its variable bindings and assignments resolve in.
    variableBindingScales: unscale(node.variableBindingScales),
    variableAssignmentScales: unscale(node.variableAssignmentScales),
    componentScale: node.componentScale / ratio
  }
}

/**
 * Whether a layer and its source match, descendants included. It stops at the first difference
 * and only visits one slot's layers, so its cost follows the size of that slot's content.
 */
function sameLayer(
  graph: SceneGraph,
  layer: SceneNode,
  source: SceneNode,
  ratio: number,
  slotProperty?: { from: string; to: string }
): boolean {
  const scaled = atSourceScale(layer, ratio)
  const a: SceneNode = {
    ...scaled,
    variableBindingScales: withoutUnitScales(scaled.variableBindingScales),
    variableAssignmentScales: withoutUnitScales(scaled.variableAssignmentScales),
    // A replacement component gives the slot a property id of its own; the layers match by name.
    componentPropertyReferences: scaled.componentPropertyReferences.map((reference) =>
      reference.propertyId === slotProperty?.from
        ? { ...reference, propertyId: slotProperty.to }
        : reference
    )
  }
  const b: SceneNode = {
    ...source,
    variableBindingScales: withoutUnitScales(source.variableBindingScales),
    variableAssignmentScales: withoutUnitScales(source.variableAssignmentScales)
  }
  const keys = new Set([...Object.keys(a), ...Object.keys(b)] as Array<keyof SceneNode>)
  for (const key of keys) {
    if (!IDENTITY_FIELDS.has(key) && !sameValue(a[key], b[key])) return false
  }
  // A copy's clone of an instance points at the layer it clones; a swap points it at another
  // component, which is an edit of the slot.
  if (
    layer.type === 'INSTANCE' &&
    layer.componentId !== source.id &&
    layer.componentId !== source.componentId
  )
    return false
  const aChildren = graph.getChildren(layer.id)
  const bChildren = graph.getChildren(source.id)
  return (
    aChildren.length === bChildren.length &&
    aChildren.every((child, index) => sameLayer(graph, child, bChildren[index], ratio))
  )
}

/** The slot frames directly in an instance, by slot property, without entering nested ones. */
function slotFrames(graph: SceneGraph, instance: SceneNode): Map<string, SceneNode> {
  const frames = new Map<string, SceneNode>()
  const visit = (node: SceneNode): void => {
    for (const child of graph.getChildren(node.id)) {
      const propertyId = slotPropertyId(child)
      if (propertyId) frames.set(propertyId, child)
      else if (child.type !== 'INSTANCE') visit(child)
    }
  }
  visit(instance)
  return frames
}

/** Whether a nested instance's slot holds something other than what the instance it copies shows. */
function slotDiffersFromSource(
  context: SceneNodeToKiwiContext,
  owner: SceneNode,
  nested: SceneNode,
  frame: SceneNode,
  propertyId: string
): boolean {
  const graph = context.graph
  // A swap replaces the nested instance's component and keeps the one it copied in the owner.
  const sourceOwner = (nested.parentId && findInstanceAncestor(graph, nested.parentId)) || owner
  const linked = getInstanceOverride(
    sourceOwner.instanceOverrides,
    sourceOwner.id,
    nested.id,
    'sourceComponentId'
  )
  const sourceId = typeof linked === 'string' ? linked : nested.componentId
  const source = sourceId ? graph.getNode(sourceId) : undefined
  // A replacement component names its slot the same but gives it a property id of its own.
  const slotName = context.componentPropertyDefinitionsById.get(propertyId)?.name
  const match =
    source?.type === 'INSTANCE' && slotName !== undefined
      ? [...slotFrames(graph, source)].find(([sourcePropertyId]) => {
          const definition = context.componentPropertyDefinitionsById.get(sourcePropertyId)
          return definition?.type === 'SLOT' && definition.name === slotName
        })
      : undefined
  if (!match) return true
  const [sourcePropertyId, counterpart] = match
  return !sameLayer(graph, frame, counterpart, frame.componentScale / counterpart.componentScale, {
    from: propertyId,
    to: sourcePropertyId
  })
}

/**
 * A copy of a component that holds an instance keeps that instance's slot content as its own
 * layers. Figma stores a copy's edits to them as slot content assigned to the nested instance,
 * through an override at its path; a copy that left the slot as it was stays without one.
 */
export function nestedSlotAssignments(
  context: SceneNodeToKiwiContext,
  owner: SceneNode,
  nested: SceneNode,
  localIdCounter: { value: number }
) {
  const assignments: NonNullable<ReturnType<typeof slotContentAssignment>>[] = []
  const frames = slotFrames(context.graph, nested)
  for (const propertyId of Object.keys(nested.componentPropertyAssignments)) {
    const frame = frames.get(propertyId)
    if (context.componentPropertyDefinitionsById.get(propertyId)?.type !== 'SLOT' || !frame)
      continue
    if (!slotDiffersFromSource(context, owner, nested, frame, propertyId)) continue
    const assignment = slotContentAssignment(
      context,
      nested,
      propertyId,
      getOrCreatePropertyGuid(context, propertyId, localIdCounter),
      localIdCounter
    )
    if (assignment) assignments.push(assignment)
  }
  return assignments
}
