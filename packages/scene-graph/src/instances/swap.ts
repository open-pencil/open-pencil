import { isEqual } from 'es-toolkit/predicate'

import {
  overriddenAssignmentId,
  reapplyComponentPropertyAssignments
} from '../components/properties'
import type { SceneGraph } from '../graph'
import { ownsSlotContent, slotPropertyId } from '../slots/frames'
import type { SceneNode } from '../types'
import { ownsSelfFillField } from './main-component'
import { hasInstanceOverride, setInstanceOverride } from './overrides'
import {
  bindingProtection,
  cloneChildInCoordinates,
  cloneChildrenWithMapping,
  NOTHING_PROTECTED,
  syncCopy,
  type MatchedCopy
} from './sync'

const REPLACED_LAYER_FIELDS = ['textPathData', 'textPathBox', 'exportSettings'] as const

interface CopiesByLayer {
  linked: Map<string, (SceneNode | undefined)[]>
  unlinked: Map<string, SceneNode[]>
}

interface Swap {
  graph: SceneGraph
  instance: SceneNode
  owners: SceneNode[]
  changedOwners: Set<SceneNode>
  parked: ReadonlySet<string>
  namesakeOrdinals: Map<string, number>
}

function sourceLayer(swap: Swap, copy: SceneNode): SceneNode | undefined {
  for (let index = swap.owners.length - 1; index >= 0; index--) {
    const fields = swap.owners[index].instanceOverrides.descendants.get(copy.id)
    const linked = fields?.get('sourceComponentId')
    if (typeof linked === 'string') {
      return swap.graph.getNode(linked)
    }
  }
  const linked = copy.componentId ? swap.graph.getNode(copy.componentId) : undefined
  return linked?.type === 'COMPONENT' ? undefined : linked
}

function namesakeOrdinal(swap: Swap, layer: SceneNode): number {
  const known = swap.namesakeOrdinals.get(layer.id)
  if (known !== undefined) {
    return known
  }
  const parent = layer.parentId ? swap.graph.getNode(layer.parentId) : undefined
  const seen = new Map<string, number>()
  for (const id of parent?.childIds ?? []) {
    const sibling = swap.graph.getNode(id)
    if (sibling) {
      const ordinal = seen.get(sibling.name) ?? 0
      seen.set(sibling.name, ordinal + 1)
      swap.namesakeOrdinals.set(id, ordinal)
    }
  }
  return swap.namesakeOrdinals.get(layer.id) ?? 0
}

function addLinkedCopy(
  byLayer: CopiesByLayer,
  copy: SceneNode,
  source: SceneNode,
  ordinal: number
): boolean {
  const namesakes = byLayer.linked.get(source.name) ?? []
  byLayer.linked.set(source.name, namesakes)
  if (namesakes[ordinal] !== undefined) {
    return false
  }
  namesakes[ordinal] = copy
  return true
}

function addUnlinkedCopy(byLayer: CopiesByLayer, copy: SceneNode): void {
  const namesakes = byLayer.unlinked.get(copy.name)
  if (namesakes) {
    namesakes.push(copy)
  } else {
    byLayer.unlinked.set(copy.name, [copy])
  }
}

function copiesByLayer(swap: Swap, parent: SceneNode, stale: SceneNode[]): CopiesByLayer {
  const byLayer: CopiesByLayer = { linked: new Map(), unlinked: new Map() }
  for (const id of parent.childIds) {
    const copy = swap.graph.getNode(id)
    if (!copy || swap.parked.has(id)) {
      continue
    }
    const source = sourceLayer(swap, copy)
    if (!source) {
      addUnlinkedCopy(byLayer, copy)
    } else if (!addLinkedCopy(byLayer, copy, source, namesakeOrdinal(swap, source))) {
      stale.push(copy)
    }
  }
  return byLayer
}

function takeCopy(byLayer: CopiesByLayer, name: string, ordinal: number): SceneNode | undefined {
  const namesakes = byLayer.linked.get(name)
  const linked = namesakes?.[ordinal]
  if (namesakes && linked) {
    namesakes[ordinal] = undefined
    return linked
  }
  return byLayer.unlinked.get(name)?.shift()
}

function untakenCopies(byLayer: CopiesByLayer): SceneNode[] {
  const untaken: SceneNode[] = []
  for (const namesakes of byLayer.linked.values()) {
    for (const copy of namesakes) {
      if (copy) {
        untaken.push(copy)
      }
    }
  }
  for (const namesakes of byLayer.unlinked.values()) {
    untaken.push(...namesakes)
  }
  return untaken
}

function changeOwner(swap: Swap, owner: SceneNode): void {
  if (!swap.changedOwners.has(owner)) {
    swap.graph.willChangeNode(owner)
    swap.changedOwners.add(owner)
  }
}

function forgetOverrides(swap: Swap, node: SceneNode): void {
  for (const owner of swap.owners) {
    if (owner.instanceOverrides.descendants.has(node.id)) {
      changeOwner(swap, owner)
      owner.instanceOverrides.descendants.delete(node.id)
    }
  }
  for (const child of swap.graph.getChildren(node.id)) {
    forgetOverrides(swap, child)
  }
}

function removeCopy(swap: Swap, copy: SceneNode): void {
  if (swap.owners.some((owner) => owner.instanceOverrides.descendants.size > 0)) {
    forgetOverrides(swap, copy)
  }
  swap.graph.deleteNode(copy.id)
}

function isSwappedCopy(swap: Swap, copy: SceneNode): boolean {
  return swap.owners.some((owner) =>
    hasInstanceOverride(owner.instanceOverrides, owner.id, copy.id, 'componentId')
  )
}

function relinkSourceLayer(swap: Swap, copy: SceneNode, layer: SceneNode): void {
  for (const owner of swap.owners) {
    const linked = owner.instanceOverrides.descendants.get(copy.id)
    if (linked?.has('sourceComponentId')) {
      changeOwner(swap, owner)
      setInstanceOverride(owner.instanceOverrides, owner.id, copy.id, 'sourceComponentId', layer.id)
    }
  }
}

function linkCopy(
  swap: Swap,
  copy: SceneNode,
  layer: SceneNode,
  swapped: boolean
): string | undefined {
  relinkSourceLayer(swap, copy, layer)
  return swapped || copy.componentId === layer.id ? undefined : layer.id
}

function copyProtection(swap: Swap, copy: SceneNode): (field: string) => boolean {
  const scopes: ReadonlySet<string>[] = []
  for (const owner of swap.owners) {
    const fields = owner.instanceOverrides.descendants.get(copy.id)
    if (fields) {
      scopes.push(new Set(fields.keys()))
    }
  }
  if (scopes.length === 0) {
    return copy.instanceOverrides.self.size === 0
      ? NOTHING_PROTECTED
      : (field) => ownsSelfFillField(copy, field)
  }
  const protectedField = bindingProtection(scopes)
  return (field) => protectedField(field) || ownsSelfFillField(copy, field)
}

function followReplacedLayerFields(graph: SceneGraph, copy: SceneNode, layer: SceneNode): void {
  const changes: Partial<SceneNode> = {}
  for (const key of REPLACED_LAYER_FIELDS) {
    if (copy[key] !== layer[key] && !isEqual(copy[key], layer[key])) {
      Object.assign(changes, { [key]: structuredClone(layer[key]) })
    }
  }
  if (Object.keys(changes).length > 0) {
    graph.updateNode(copy.id, changes)
  }
}

function userAssignedIds(swap: Swap, copy: SceneNode): Set<string> {
  const ids = new Set<string>()
  for (const owner of swap.owners) {
    for (const field of owner.instanceOverrides.descendants.get(copy.id)?.keys() ?? []) {
      const propertyId = overriddenAssignmentId(field)
      if (propertyId !== undefined) {
        ids.add(propertyId)
      }
    }
  }
  return ids
}

function followAssignments(swap: Swap, copy: SceneNode, layer: SceneNode): boolean {
  if (isEqual(copy.componentPropertyAssignments, layer.componentPropertyAssignments)) {
    return false
  }
  const userAssigned = userAssignedIds(swap, copy)
  const assignments = { ...layer.componentPropertyAssignments }
  for (const [propertyId, value] of Object.entries(copy.componentPropertyAssignments)) {
    if (userAssigned.has(propertyId)) {
      assignments[propertyId] = value
    }
  }
  if (isEqual(assignments, copy.componentPropertyAssignments)) {
    return false
  }
  swap.graph.updateNode(copy.id, { componentPropertyAssignments: assignments })
  return true
}

function cloneLayer(
  swap: Swap,
  compParent: SceneNode,
  instParent: SceneNode,
  layer: SceneNode
): SceneNode {
  const clone = cloneChildInCoordinates(swap.graph, layer, compParent, instParent)
  if (layer.childIds.length > 0) {
    cloneChildrenWithMapping(swap.graph, layer.id, clone.id)
  }
  return clone
}

function followInside(swap: Swap, layer: SceneNode, copy: SceneNode): void {
  const owner = copy.type === 'INSTANCE'
  if (owner) {
    swap.owners.push(copy)
  }
  followLayers(swap, layer, copy)
  if (owner) {
    swap.owners.pop()
  }
}

function matchCopies(swap: Swap, compParent: SceneNode, instParent: SceneNode) {
  const stale: SceneNode[] = []
  const byLayer = copiesByLayer(swap, instParent, stale)
  const ordinals = new Map<string, number>()
  const matched = compParent.childIds.map((layerId) => {
    const layer = swap.graph.getNode(layerId)
    if (!layer) {
      return undefined
    }
    const ordinal = ordinals.get(layer.name) ?? 0
    ordinals.set(layer.name, ordinal + 1)
    const copy = takeCopy(byLayer, layer.name, ordinal)
    if (!copy || copy.type === layer.type) {
      return copy
    }
    stale.push(copy)
    return undefined
  })
  stale.push(...untakenCopies(byLayer))
  return { matched, stale }
}

function standsInOrderFor(swap: Swap, copy: SceneNode, layer: SceneNode, index: number): boolean {
  if (copy.type !== layer.type || swap.parked.has(copy.id)) {
    return false
  }
  const source = sourceLayer(swap, copy)
  if (!source) {
    return copy.name === layer.name
  }
  const sourceParent = source.parentId ? swap.graph.getNode(source.parentId) : undefined
  return source.name === layer.name && sourceParent?.childIds[index] === source.id
}

function hasCopiesInOrder(swap: Swap, compParent: SceneNode, instParent: SceneNode): boolean {
  const layerIds = compParent.childIds
  const copyIds = instParent.childIds
  if (layerIds.length !== copyIds.length) {
    return false
  }
  for (let index = 0; index < layerIds.length; index++) {
    const layer = swap.graph.getNode(layerIds[index])
    const copy = swap.graph.getNode(copyIds[index])
    if (!layer || !copy || !standsInOrderFor(swap, copy, layer, index)) {
      return false
    }
  }
  return true
}

function followCopiesInOrder(swap: Swap, compParent: SceneNode, instParent: SceneNode): void {
  compParent.childIds.forEach((layerId, index) => {
    const compChild = swap.graph.getNode(layerId)
    const instChild = swap.graph.getNode(instParent.childIds[index])
    if (compChild && instChild) {
      followCopy(swap, { compParent, instParent, compChild, instChild })
    }
  })
}

function followLayers(swap: Swap, compParent: SceneNode, instParent: SceneNode): void {
  if (hasCopiesInOrder(swap, compParent, instParent)) {
    followCopiesInOrder(swap, compParent, instParent)
    return
  }
  const { graph } = swap
  const { matched, stale } = matchCopies(swap, compParent, instParent)
  for (const copy of stale) {
    removeCopy(swap, copy)
  }
  compParent.childIds.forEach((layerId, index) => {
    const layer = graph.getNode(layerId)
    if (!layer) {
      return
    }
    const copy = matched[index] ?? cloneLayer(swap, compParent, instParent, layer)
    if (instParent.childIds[index] !== copy.id) {
      graph.insertChildAt(copy.id, instParent.id, index)
    }
    if (copy === matched[index]) {
      followCopy(swap, { compParent, instParent, compChild: layer, instChild: copy })
    }
  })
}

function followCopy(swap: Swap, match: MatchedCopy): void {
  const { compChild: layer, instChild: copy } = match
  const swapped = isSwappedCopy(swap, copy)
  const replaced = sourceLayer(swap, copy) !== layer
  const linkedLayerId = linkCopy(swap, copy, layer, swapped)
  syncCopy(swap.graph, match, copyProtection(swap, copy), linkedLayerId)
  if (replaced) {
    followReplacedLayerFields(swap.graph, copy, layer)
  }
  if (swapped || ownsSlotContent(swap.graph, copy, slotPropertyId(layer))) {
    return
  }
  const reassigned = copy.type === 'INSTANCE' && followAssignments(swap, copy, layer)
  followInside(swap, layer, copy)
  if (reassigned) {
    reapplyComponentPropertyAssignments(swap.graph, copy.id)
  }
}

function enclosingInstances(graph: SceneGraph, instance: SceneNode): SceneNode[] {
  const owners: SceneNode[] = []
  graph.closest(instance.id, (node) => {
    if (node.type === 'INSTANCE') {
      owners.push(node)
    }
    return false
  })
  return owners.reverse()
}

export function followComponentLayers(
  graph: SceneGraph,
  instance: SceneNode,
  component: SceneNode,
  parked: ReadonlySet<string>
): void {
  const swap: Swap = {
    graph,
    instance,
    owners: enclosingInstances(graph, instance),
    changedOwners: new Set(),
    parked,
    namesakeOrdinals: new Map()
  }
  followLayers(swap, component, instance)
  for (const owner of swap.changedOwners) {
    graph.updateNode(owner.id, { instanceOverrides: owner.instanceOverrides })
  }
}
