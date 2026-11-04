import { compact, isEqual, isPlainObject } from 'es-toolkit'

import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import { findInstanceAncestor } from '@open-pencil/scene-graph/instances'
import { copiedComponentLayerId } from '@open-pencil/scene-graph/instances/overrides'
import { scaleNodeChanges } from '@open-pencil/scene-graph/scaling'
import { instanceSlotFrames, slotPropertyId } from '@open-pencil/scene-graph/slots'

import type { SceneNodeToKiwiContext } from '../context'
import { componentPropAssignment } from './values'

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

/** An instance's slot frames, by slot property. */
function slotFrames(graph: SceneGraph, instance: SceneNode): Map<string, SceneNode> {
  return new Map(
    instanceSlotFrames(graph, instance).flatMap((frame) => {
      const propertyId = slotPropertyId(frame)
      return propertyId ? [[propertyId, frame] as const] : []
    })
  )
}

/** The layer a nested instance copies: its component's, or the one a swap left in its owner. */
function nestedSource(
  graph: SceneGraph,
  owner: SceneNode,
  nested: SceneNode
): SceneNode | undefined {
  // A swap replaces the nested instance's component and keeps the one it copied in the owner.
  const sourceOwner = (nested.parentId && findInstanceAncestor(graph, nested.parentId)) || owner
  const sourceId = copiedComponentLayerId(sourceOwner.instanceOverrides, sourceOwner.id, nested)
  return sourceId ? graph.getNode(sourceId) : undefined
}

/** Whether a nested instance's slot holds something other than what the instance it copies shows. */
function slotDiffersFromSource(
  context: SceneNodeToKiwiContext,
  source: SceneNode | undefined,
  frame: SceneNode,
  propertyId: string
): boolean {
  const graph = context.graph
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
 * The component property values a copy gives an instance it holds, which Figma stores on an
 * override at that instance's path. A copy keeps the nested instance's slot content as its own
 * layers, and its text, boolean, and swap values on the instance; only those that differ from
 * what the instance it copies shows are written, so a copy left as it was writes none.
 */
export function nestedPropertyAssignments(
  context: SceneNodeToKiwiContext,
  owner: SceneNode,
  nested: SceneNode,
  localIdCounter: { value: number }
) {
  const source = nestedSource(context.graph, owner, nested)
  const frames = slotFrames(context.graph, nested)
  return compact(
    Object.entries(nested.componentPropertyAssignments).map(([propertyId, value]) => {
      const definition = context.componentPropertyDefinitionsById.get(propertyId)
      if (!definition) return null
      if (definition.type === 'SLOT') {
        const frame = frames.get(propertyId)
        if (!frame || !slotDiffersFromSource(context, source, frame, propertyId)) return null
      } else {
        const shown =
          source?.type === 'INSTANCE'
            ? (source.componentPropertyAssignments[propertyId] ?? definition.defaultValue)
            : definition.defaultValue
        if (value === shown) return null
      }
      return componentPropAssignment(context, nested, propertyId, value, localIdCounter)
    })
  )
}
