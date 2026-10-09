import type { SceneGraph, SceneNode } from './'
import { findLayerByPath, layerPath } from './behaviours/layers'
import type { NodeCloneMode } from './copy'
import {
  createInstanceOverrideState,
  hasInstanceOverride as hasOverride,
  instanceOverridesAt,
  setInstanceOverride,
  type OverridePath
} from './instance-overrides'
import { overrideTarget } from './instances/addressing'
import { adoptCopies } from './instances/adopt'
import { INSTANCE_SYNC_FIELDS, INSTANCE_SYNC_PROPS } from './instances/fields'
import { overridePathKey, parseInstanceLayerId, parseOverridePathKey } from './instances/layer-ids'
import {
  bindingProtection,
  cloneInstanceChildren,
  copyProp,
  isProtectedSyncField,
  sourceInTargetCoordinates,
  syncBindingFields,
  syncInstanceChildren,
  syncInstanceLayer,
  updateSyncedProps
} from './instances/sync'
import { detachOwnedSlotContent, isOwnedSlotContent, restoreOwnedSlotContent } from './slots/frames'

export type { NodeCloneMode } from './copy'
export {
  INSTANCE_SYNC_FIELDS,
  INSTANCE_SYNC_PROPS,
  INSTANCE_SYNC_TEXT_PROPS
} from './instances/fields'

export function copyInstanceComponentProps(component: SceneNode): Partial<SceneNode> {
  const props: Partial<SceneNode> = {}
  for (const key of INSTANCE_SYNC_PROPS) copyProp(props, component, key)
  return props
}

export function createInstance(
  graph: SceneGraph,
  componentId: string,
  parentId: string,
  overrides: Partial<SceneNode> = {}
): SceneNode | null {
  const component = graph.nodes.get(componentId)
  if (component?.type !== 'COMPONENT') return null

  const props: Partial<SceneNode> = {
    ...copyInstanceComponentProps(component),
    name: component.name,
    componentId
  }

  const instance = graph.createNode('INSTANCE', parentId, { ...props, ...overrides })
  cloneInstanceChildren(graph, instance, component)
  return instance
}

export function populateInstanceChildren(
  graph: SceneGraph,
  instanceId: string,
  componentId: string,
  mode: NodeCloneMode = 'deep'
): void {
  const instance = graph.nodes.get(instanceId)
  const component = graph.nodes.get(componentId)
  if (!instance || !component || instance.type !== 'INSTANCE') return
  cloneInstanceChildren(graph, instance, component, mode)
}

/**
 * Overrides of layers below `prefix` follow a swap to the new component's layer of the same
 * name, as in Figma; overrides of layers it has no counterpart for are dropped. A path into a
 * nested instance keeps its tail, which addresses that instance's own component.
 */
function carryOverridesAcrossSwap(
  graph: SceneGraph,
  owner: SceneNode,
  prefix: OverridePath,
  previousComponent: SceneNode,
  component: SceneNode
): void {
  const { layers } = owner.instanceOverrides
  // Entries are moved to new keys while iterating, so iterate a copy.
  for (const [key, fields] of Array.from(layers)) {
    const path = parseOverridePathKey(key)
    if (path.length <= prefix.length || prefix.some((segment, i) => path[i] !== segment)) continue
    layers.delete(key)
    const [first, ...rest] = path.slice(prefix.length)
    const counterpart = findLayerByPath(
      graph,
      component.id,
      layerPath(graph, previousComponent.id, first)
    )
    if (!counterpart || counterpart.id === component.id) continue
    layers.set(overridePathKey([...prefix, counterpart.id, ...rest]), fields)
  }
}

export interface SwapInstanceOptions {
  /**
   * Keep the instance's name even when it is its old component's. A swap otherwise renames such
   * an instance after the new component, as Figma does; a view that only shows another variant,
   * such as preview, keeps names so layer paths stay the same.
   */
  keepName?: boolean
}

export function swapInstanceComponent(
  graph: SceneGraph,
  instanceId: string,
  componentId: string,
  { keepName = false }: SwapInstanceOptions = {}
): void {
  const instance = graph.nodes.get(instanceId)
  const component = graph.nodes.get(componentId)
  const target = instance && overrideTarget(graph, instance)
  if (!instance || !target || component?.type !== 'COMPONENT' || instance.type !== 'INSTANCE')
    return

  const previousComponent = instance.componentId ? graph.nodes.get(instance.componentId) : undefined
  const { owner, path } = target
  // A copy of a nested instance is swapped by its owner; one of its own just shows another component.
  if (path.length > 0)
    setInstanceOverride(owner.instanceOverrides, path, 'componentId', componentId)
  if (previousComponent) carryOverridesAcrossSwap(graph, owner, path, previousComponent, component)
  if (owner.id !== instance.id)
    graph.updateNode(owner.id, { instanceOverrides: owner.instanceOverrides })

  const updates: Partial<SceneNode> = { componentId }
  const source = sourceInTargetCoordinates(component, instance.componentScale)
  for (const key of INSTANCE_SYNC_PROPS) {
    if (hasOverride(owner.instanceOverrides, path, key)) continue
    copyProp(updates, source, key)
  }
  if (!keepName && (!previousComponent || instance.name === previousComponent.name))
    updates.name = component.name

  const childIds = Array.from(instance.childIds)
  const slotContent = detachOwnedSlotContent(graph, instance)
  for (const childId of childIds) graph.deleteNode(childId)
  graph.updateNode(instanceId, updates)
  cloneInstanceChildren(graph, instance, component)
  restoreOwnedSlotContent(graph, instance, slotContent)
}

const syncingComponentsByGraph = new WeakMap<SceneGraph, Set<string>>()

export function syncInstances(graph: SceneGraph, componentId: string): void {
  syncInstancesOf(graph, componentId, getInstances(graph, componentId))
}

/** Syncs one instance from its component, as `syncInstances` does for every instance. */
export function syncInstance(graph: SceneGraph, instanceId: string): void {
  const instance = graph.nodes.get(instanceId)
  if (instance?.type !== 'INSTANCE' || !instance.componentId) return
  syncInstancesOf(graph, instance.componentId, [instance])
}

/**
 * Whether an instance takes its contents from its component directly. A copy of a nested
 * instance takes them from the layer it copies, so it is synced with its outermost instance,
 * unless that instance swapped it or owns the slot it sits in.
 */
function syncsFromComponent(graph: SceneGraph, instance: SceneNode): boolean {
  const target = overrideTarget(graph, instance)
  return (
    !target ||
    target.path.length === 0 ||
    hasOverride(target.owner.instanceOverrides, target.path, 'componentId') ||
    isOwnedSlotContent(graph, instance)
  )
}

function syncInstancesOf(
  graph: SceneGraph,
  componentId: string,
  instances: Iterable<SceneNode>
): void {
  const component = graph.nodes.get(componentId)
  if (component?.type !== 'COMPONENT') return
  let syncing = syncingComponentsByGraph.get(graph)
  if (!syncing) {
    syncing = new Set()
    syncingComponentsByGraph.set(graph, syncing)
  }
  if (syncing.has(componentId)) return
  syncing.add(componentId)
  try {
    // A copy of a nested instance takes the component's changes through the layer it copies, so
    // it syncs from that layer once the component's own instances have.
    const copies: { node: SceneNode; depth: number }[] = []
    for (const instance of instances) {
      if (!syncsFromComponent(graph, instance)) {
        const depth = parseInstanceLayerId(instance.id)?.path.length ?? 0
        copies.push({ node: instance, depth })
        continue
      }
      const target = overrideTarget(graph, instance)
      const overridden = target
        ? instanceOverridesAt(target.owner.instanceOverrides, target.path).keys()
        : []
      const protectedField = bindingProtection(overridden)
      const source = sourceInTargetCoordinates(component, instance.componentScale)
      const updates: Partial<SceneNode> = {}
      syncBindingFields(instance, source, updates, protectedField)
      for (const key of INSTANCE_SYNC_PROPS) {
        if (key === 'boundVariables') continue
        if (isProtectedSyncField(instance, key, protectedField)) continue
        copyProp(updates, source, key)
      }
      updateSyncedProps(graph, instance, updates)
      syncInstanceChildren(graph, instance, component)
    }
    for (const { node } of copies.toSorted((left, right) => left.depth - right.depth))
      syncInstanceLayer(graph, node)
  } finally {
    syncing.delete(componentId)
  }
}

/** Makes an instance's layers its own and turns it into a frame. */
function detach(graph: SceneGraph, instance: SceneNode): ReadonlyMap<string, string> {
  const renames = adoptCopies(graph, instance)
  graph.updateNode(instance.id, {
    type: 'FRAME',
    componentId: null,
    instanceOverrides: createInstanceOverrideState()
  })
  return renames
}

/**
 * Turn an instance into a frame holding its layers as layers of its own. Detaching a copy of a
 * nested instance detaches the instances it sits in first, as in Figma, which gives it a new
 * id. Returns the frame.
 */
export function detachInstance(graph: SceneGraph, instanceId: string): SceneNode | undefined {
  const instance = graph.nodes.get(instanceId)
  if (instance?.type !== 'INSTANCE') return undefined
  const address = parseInstanceLayerId(instance.id)
  if (!address) {
    detach(graph, instance)
    return instance
  }
  const owner = graph.nodes.get(address.owner)
  if (owner?.type !== 'INSTANCE') return undefined
  // Detaching the owner leaves this copy an instance inside fewer instances, under a new id.
  const renames = detach(graph, owner)
  return detachInstance(graph, renames.get(instanceId) ?? instanceId)
}

export function getMainComponent(graph: SceneGraph, instanceId: string): SceneNode | undefined {
  const node = graph.nodes.get(instanceId)
  if (!node?.componentId) return undefined
  return graph.nodes.get(node.componentId)
}

export function getInstances(graph: SceneGraph, componentId: string): SceneNode[] {
  const ids = graph.instanceIndex.get(componentId)
  if (!ids) return []
  const instances: SceneNode[] = []
  for (const id of ids) {
    const node = graph.nodes.get(id)
    if (node) instances.push(node)
  }
  return instances
}

/** Nearest INSTANCE at or above `nodeId` — self, parent, grandparent, etc. */
export function findInstanceAncestor(graph: SceneGraph, nodeId: string): SceneNode | undefined {
  let current = graph.nodes.get(nodeId)
  while (current) {
    if (current.type === 'INSTANCE') return current
    current = current.parentId ? graph.nodes.get(current.parentId) : undefined
  }
  return undefined
}

/** Whether a field of `nodeId` is overridden, so instance sync leaves it alone. */
export function hasInstanceOverride(graph: SceneGraph, nodeId: string, field: string): boolean {
  const node = graph.nodes.get(nodeId)
  const target = node && overrideTarget(graph, node)
  return target ? hasOverride(target.owner.instanceOverrides, target.path, field) : false
}

/** Records `fields` of a layer inside an instance as overridden, on its outermost instance. */
export function recordInstanceOverride(
  graph: SceneGraph,
  nodeId: string,
  fields: Iterable<string>
): void {
  const node = graph.nodes.get(nodeId)
  const target = node && overrideTarget(graph, node)
  if (!target) return
  const relevant = [...fields].filter((field) =>
    (INSTANCE_SYNC_FIELDS as readonly string[]).includes(field)
  )
  if (relevant.length === 0) return
  for (const field of relevant)
    setInstanceOverride(target.owner.instanceOverrides, target.path, field)
  graph.updateNode(target.owner.id, { instanceOverrides: target.owner.instanceOverrides })
}
