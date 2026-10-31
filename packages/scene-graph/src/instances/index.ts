import type { NodeCloneMode } from '../copy'
import type { SceneGraph } from '../graph'
import { detachOwnedSlotContent, restoreOwnedSlotContent } from '../slots/frames'
import type { SceneNode } from '../types'
import { keepOwnContentSize } from './content-size'
import { createInstanceSyncContext, groupCopyRemovals, removeLeftoverCopies } from './copies'
import { canCreateInstance } from './cycles'
import { INSTANCE_OVERRIDE_FIELDS, INSTANCE_SYNC_PROPS } from './fields'
import {
  clearInstanceOverrides,
  cloneInstanceOverrideState,
  getInstanceOverride,
  hasInstanceOverride as hasNodeInstanceOverride,
  setInstanceOverride
} from './overrides'
import { walkInstanceSources } from './source-walk'
import {
  bindingProtection,
  cloneChildrenWithMapping,
  copyProp,
  enclosingInstanceOverrideFields,
  isProtectedSyncField,
  sourceInTargetCoordinates,
  syncBindingFields,
  syncChildren,
  updateSyncedProps
} from './sync'

export { canCreateInstance, createsComponentCycle, cycleSafeParent } from './cycles'
export { instanceMainComponent } from './main-component'
export {
  INSTANCE_FOLLOWED_FIELDS,
  INSTANCE_OVERRIDE_FIELDS,
  INSTANCE_SYNC_FIELDS,
  INSTANCE_SYNC_PROPS,
  INSTANCE_SYNC_TEXT_PROPS
} from './fields'

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
  if (component?.type !== 'COMPONENT' || !canCreateInstance(graph, componentId, parentId))
    return null

  const props: Partial<SceneNode> = {
    ...copyInstanceComponentProps(component),
    name: component.name
  }

  // The component checked above is the one the instance shows, whatever `overrides` holds.
  const instance = graph.createNode('INSTANCE', parentId, { ...props, ...overrides, componentId })

  cloneChildrenWithMapping(graph, component.id, instance.id)

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
  cloneChildrenWithMapping(graph, componentId, instanceId, mode)
}

/**
 * A nested instance's link to the enclosing component's record is its `componentId` when it
 * was populated by cloning. A swap replaces that field, so keep the correspondence as the
 * owner's `sourceComponentId` override and record the swap itself; materialized documents
 * already carry the correspondence and only gain the swap.
 */
function recordNestedSwap(graph: SceneGraph, instance: SceneNode, componentId: string): void {
  const owner = instance.parentId ? findInstanceAncestor(graph, instance.parentId) : undefined
  if (!owner) return
  const existing = getInstanceOverride(
    owner.instanceOverrides,
    owner.id,
    instance.id,
    'sourceComponentId'
  )
  if (typeof existing !== 'string' && instance.componentId)
    setInstanceOverride(
      owner.instanceOverrides,
      owner.id,
      instance.id,
      'sourceComponentId',
      instance.componentId
    )
  setInstanceOverride(owner.instanceOverrides, owner.id, instance.id, 'componentId', componentId)
  graph.updateNode(owner.id, { instanceOverrides: owner.instanceOverrides })
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
  if (!instance || component?.type !== 'COMPONENT' || instance.type !== 'INSTANCE') return
  if (instance.parentId && !canCreateInstance(graph, componentId, instance.parentId)) return

  const previousComponent = instance.componentId ? graph.nodes.get(instance.componentId) : undefined
  recordNestedSwap(graph, instance, componentId)
  const updates: Partial<SceneNode> = { componentId }
  const source = sourceInTargetCoordinates(component, instance.componentScale)
  for (const key of INSTANCE_SYNC_PROPS) {
    if (hasNodeInstanceOverride(instance.instanceOverrides, instance.id, instance.id, key)) continue
    copyProp(updates, source, key)
  }

  if (!keepName && (!previousComponent || instance.name === previousComponent.name))
    updates.name = component.name

  const childIds = Array.from(instance.childIds)
  const slotContent = detachOwnedSlotContent(graph, instance)
  for (const childId of childIds) graph.deleteNode(childId)
  graph.updateNode(instanceId, updates)
  cloneChildrenWithMapping(graph, componentId, instanceId)
  restoreOwnedSlotContent(graph, instance, slotContent)
}

const syncingComponentsByGraph = new WeakMap<SceneGraph, Set<string>>()

export function syncInstances(graph: SceneGraph, componentId: string): void {
  syncInstancesOf(graph, componentId, getInstances(graph, componentId))
}

/**
 * Syncs each component's instances, in order, as one edit: the copies they remove stay
 * restorable together for as long as undo keeps that edit.
 */
export function syncInstancesTogether(graph: SceneGraph, componentIds: Iterable<string>): void {
  groupCopyRemovals(graph, () => {
    for (const id of componentIds) syncInstances(graph, id)
  })
}

/** Syncs one instance from its component, as `syncInstances` does for every instance. */
export function syncInstance(graph: SceneGraph, instanceId: string): void {
  const instance = graph.nodes.get(instanceId)
  if (instance?.type !== 'INSTANCE' || !instance.componentId) return
  syncInstancesOf(graph, instance.componentId, [instance])
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
    groupCopyRemovals(graph, (removals) => {
      for (const instance of instances) {
        const enclosing = enclosingInstanceOverrideFields(graph, instance)
        enclosing.push(new Set(instance.instanceOverrides.self.keys()))
        const protectedField = bindingProtection(enclosing)
        const source = sourceInTargetCoordinates(component, instance.componentScale)
        const updates: Partial<SceneNode> = {}
        syncBindingFields(instance, source, updates, protectedField)
        for (const key of INSTANCE_SYNC_PROPS) {
          if (key === 'boundVariables') continue
          if (isProtectedSyncField(instance, key, protectedField)) continue
          copyProp(updates, source, key)
        }
        // An instance that hugs its layers sizes to what it shows, not to the component.
        keepOwnContentSize(graph, updates, instance, source)
        updateSyncedProps(graph, instance, updates)
        const context = createInstanceSyncContext(instance.id, instance.instanceOverrides)
        syncChildren(graph, component.id, instance.id, instance.instanceOverrides, context)
        removeLeftoverCopies(graph, context, removals)
      }
    })
  } finally {
    syncing.delete(componentId)
  }
}

export function detachInstance(graph: SceneGraph, instanceId: string): void {
  const node = graph.nodes.get(instanceId)
  if (node?.type !== 'INSTANCE') return
  for (const nested of outermostNestedInstances(graph, node))
    adoptNestedOverrides(graph, node, nested)
  if (node.componentId) {
    graph.instanceIndex.get(node.componentId)?.delete(instanceId)
  }
  node.type = 'FRAME'
  node.componentId = null
  clearInstanceOverrides(node.instanceOverrides)
}

// A swap's bookkeeping belongs to the instance enclosing the swapped one, never to the swapped one.
const OWNER_ONLY_FIELDS = new Set(['componentId', 'sourceComponentId'])

function outermostNestedInstances(graph: SceneGraph, instance: SceneNode): SceneNode[] {
  return graph
    .getChildren(instance.id)
    .flatMap((child) =>
      child.type === 'INSTANCE' ? [child] : outermostNestedInstances(graph, child)
    )
}

/**
 * An instance a detached one holds stands on its own once that one is a frame, and so must what
 * makes it differ from its component. Cloned in, it kept the overrides of the instance it copies,
 * under that instance's layers; those, and the ones the detached instance recorded on its layers,
 * now go under its own.
 */
function adoptNestedOverrides(graph: SceneGraph, detached: SceneNode, nested: SceneNode): void {
  const ownLayer = new Map<string, string>()
  walkInstanceSources(graph, nested, (source, target) => {
    ownLayer.set(source.id, target.id)
    return true
  })
  const { self, descendants: kept } = cloneInstanceOverrideState(nested.instanceOverrides)
  const outer = cloneInstanceOverrideState(detached.instanceOverrides).descendants
  const descendants = new Map<string, Map<string, unknown>>()
  const claim = (layerId: string, fields: Map<string, unknown>): void => {
    const merged = descendants.get(layerId)
    if (!merged) descendants.set(layerId, fields)
    else for (const [field, value] of fields) merged.set(field, value)
  }
  // What was recorded on its own layers is more recent than what it copied, so it is laid on top.
  for (const [layerId, fields] of kept)
    if (ownLayer.has(layerId)) claim(ownLayer.get(layerId) ?? layerId, fields)
  for (const [layerId, fields] of kept) if (!ownLayer.has(layerId)) claim(layerId, fields)
  for (const [layerId, fields] of outer) {
    if (layerId === nested.id) {
      for (const [field, value] of fields) if (!OWNER_ONLY_FIELDS.has(field)) self.set(field, value)
    } else if (graph.isDescendant(layerId, nested.id)) claim(layerId, fields)
  }
  graph.updateNode(nested.id, { instanceOverrides: { self, descendants } })
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

/**
 * True when a node field is protected from instance synchronization.
 */
export function hasInstanceOverride(graph: SceneGraph, nodeId: string, field: string): boolean {
  const instance = findInstanceAncestor(graph, nodeId)
  if (!instance) return false
  return hasNodeInstanceOverride(instance.instanceOverrides, instance.id, nodeId, field)
}

export function recordInstanceOverride(
  graph: SceneGraph,
  nodeId: string,
  fields: Iterable<string>
): void {
  const instance = findInstanceAncestor(graph, nodeId)
  if (!instance) return

  const relevant = [...fields].filter((field) =>
    (INSTANCE_OVERRIDE_FIELDS as readonly string[]).includes(field)
  )

  if (relevant.length === 0) return

  for (const field of relevant)
    setInstanceOverride(instance.instanceOverrides, instance.id, nodeId, field)
  graph.updateNode(instance.id, { instanceOverrides: instance.instanceOverrides })
}
