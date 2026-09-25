import type { SceneGraph, SceneNode } from './'
import type { NodeCloneMode } from './copy'
import {
  clearInstanceOverrides,
  getInstanceOverride,
  hasInstanceOverride as hasNodeInstanceOverride,
  setInstanceOverride
} from './instance-overrides'
import { INSTANCE_SYNC_FIELDS, INSTANCE_SYNC_PROPS } from './instances/fields'
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
} from './instances/sync'

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

export function swapInstanceComponent(
  graph: SceneGraph,
  instanceId: string,
  componentId: string
): void {
  const instance = graph.nodes.get(instanceId)
  const component = graph.nodes.get(componentId)
  if (!instance || component?.type !== 'COMPONENT' || instance.type !== 'INSTANCE') return

  const previousComponent = instance.componentId ? graph.nodes.get(instance.componentId) : undefined
  recordNestedSwap(graph, instance, componentId)
  const updates: Partial<SceneNode> = { componentId }
  const source = sourceInTargetCoordinates(component, instance.componentScale)
  for (const key of INSTANCE_SYNC_PROPS) {
    if (hasNodeInstanceOverride(instance.instanceOverrides, instance.id, instance.id, key)) continue
    copyProp(updates, source, key)
  }

  if (!previousComponent || instance.name === previousComponent.name) updates.name = component.name

  const childIds = Array.from(instance.childIds)
  for (const childId of childIds) graph.deleteNode(childId)
  graph.updateNode(instanceId, updates)
  cloneChildrenWithMapping(graph, componentId, instanceId)
}

const syncingComponentsByGraph = new WeakMap<SceneGraph, Set<string>>()

export function syncInstances(graph: SceneGraph, componentId: string): void {
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
    for (const instance of getInstances(graph, componentId)) {
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
      updateSyncedProps(graph, instance, updates)
      syncChildren(graph, component.id, instance.id, instance.instanceOverrides)
    }
  } finally {
    syncing.delete(componentId)
  }
}

export function detachInstance(graph: SceneGraph, instanceId: string): void {
  const node = graph.nodes.get(instanceId)
  if (node?.type !== 'INSTANCE') return
  if (node.componentId) {
    graph.instanceIndex.get(node.componentId)?.delete(instanceId)
  }
  node.type = 'FRAME'
  node.componentId = null
  clearInstanceOverrides(node.instanceOverrides)
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

/*
 * syncInstances) won't clobber them, and — if `nodeId` sits inside an INSTANCE —
 * so the .fig exporter knows to write the diff out as a symbol override. A no-op
 * for fields outside INSTANCE_SYNC_PROPS or nodes with no INSTANCE ancestor.
 */
export function recordInstanceOverrideValue(
  graph: SceneGraph,
  nodeId: string,
  field: string,
  value: unknown
): void {
  const instance = findInstanceAncestor(graph, nodeId)
  if (!instance) return
  setInstanceOverride(instance.instanceOverrides, instance.id, nodeId, field, value)
  graph.updateNode(instance.id, { instanceOverrides: instance.instanceOverrides })
}
export function recordInstanceOverride(
  graph: SceneGraph,
  nodeId: string,
  fields: Iterable<string>
): void {
  const instance = findInstanceAncestor(graph, nodeId)
  if (!instance) return

  const relevant = [...fields].filter((field) =>
    (INSTANCE_SYNC_FIELDS as readonly string[]).includes(field)
  )

  if (relevant.length === 0) return

  for (const field of relevant)
    setInstanceOverride(instance.instanceOverrides, instance.id, nodeId, field)
  graph.updateNode(instance.id, { instanceOverrides: instance.instanceOverrides })
}
