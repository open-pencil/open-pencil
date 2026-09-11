import type { SceneGraph, SceneNode } from './'
import { cloneNodeProps, copyEffects, copyFills, copyStrokes, copyStyleRuns } from './copy'
import type { NodeCloneMode } from './copy'
import {
  clearInstanceOverrides,
  getInstanceOverride,
  hasInstanceOverride as hasNodeInstanceOverride,
  setInstanceOverride,
  type InstanceOverrideState
} from './instance-overrides'

export type { NodeCloneMode } from './copy'

export const INSTANCE_SYNC_TEXT_PROPS = [
  'name',
  'text',
  'fontSize',
  'fontWeight',
  'fontFamily',
  'textDirection'
] as const

export const INSTANCE_SYNC_PROPS: (keyof SceneNode)[] = [
  'width',
  'height',
  'minWidth',
  'maxWidth',
  'minHeight',
  'maxHeight',
  'fills',
  'strokes',
  'effects',
  'opacity',
  'cornerRadius',
  'topLeftRadius',
  'topRightRadius',
  'bottomRightRadius',
  'bottomLeftRadius',
  'independentCorners',
  'layoutMode',
  'layoutDirection',
  'layoutWrap',
  'primaryAxisAlign',
  'counterAxisAlign',
  'primaryAxisSizing',
  'counterAxisSizing',
  'itemSpacing',
  'counterAxisSpacing',
  'paddingTop',
  'paddingRight',
  'paddingBottom',
  'paddingLeft',
  'gridTemplateColumns',
  'gridTemplateRows',
  'gridColumnGap',
  'gridRowGap',
  'gridPosition',
  'clipsContent',
  'independentStrokeWeights',
  'borderTopWeight',
  'borderRightWeight',
  'borderBottomWeight',
  'borderLeftWeight',
  'boundVariables',
  'variableModes'
]

export const INSTANCE_SYNC_FIELDS = [...INSTANCE_SYNC_PROPS, ...INSTANCE_SYNC_TEXT_PROPS] as const

function setSceneProp<K extends keyof SceneNode>(
  target: Partial<SceneNode>,
  key: K,
  value: SceneNode[K]
): void {
  target[key] = value
}

function copyProp(
  target: Partial<SceneNode> | SceneNode,
  source: SceneNode,
  key: keyof SceneNode
): void {
  if (key === 'fills') {
    setSceneProp(target, key, copyFills(source.fills))
  } else if (key === 'strokes') {
    setSceneProp(target, key, copyStrokes(source.strokes))
  } else if (key === 'effects') {
    setSceneProp(target, key, copyEffects(source.effects))
  } else if (key === 'styleRuns') {
    setSceneProp(target, key, copyStyleRuns(source.styleRuns))
  } else if (key === 'boundVariables') {
    // Shallow copy the binding map — values are variable IDs (strings), not objects
    setSceneProp(target, key, { ...source.boundVariables })
  } else if (key === 'variableModes') {
    setSceneProp(target, key, { ...source.variableModes })
  } else if (key === 'gridPosition') {
    // Shallow copy the grid position object — all fields are primitives
    setSceneProp(target, key, source.gridPosition ? { ...source.gridPosition } : null)
  } else {
    const value = source[key]
    setSceneProp(target, key, Array.isArray(value) ? structuredClone(value) : value)
  }
}

function cloneChildrenWithMapping(
  graph: SceneGraph,
  sourceParentId: string,
  destParentId: string,
  mode: NodeCloneMode = 'deep'
): void {
  // Guard against cloning a subtree into itself or its own descendant. Without this,
  // a self-referential or cyclic component (e.g. an INSTANCE whose componentId points
  // to an ancestor) causes unbounded recursion and eventual stack overflow / OOM.
  if (sourceParentId === destParentId || graph.isDescendant(destParentId, sourceParentId)) return

  const sourceParent = graph.nodes.get(sourceParentId)
  if (!sourceParent) return

  for (const childId of sourceParent.childIds) {
    const src = graph.nodes.get(childId)
    if (!src) continue

    const clone = graph.createNode(src.type, destParentId, cloneNodeProps(src, childId, mode))

    if (src.childIds.length > 0) {
      cloneChildrenWithMapping(graph, childId, clone.id, mode)
    }
  }
}

function linkMatchedChild(
  overrides: InstanceOverrideState,
  instParentId: string,
  instChild: SceneNode,
  compChildId: string
): void {
  if (instChild.type === 'INSTANCE') {
    setInstanceOverride(overrides, instParentId, instChild.id, 'sourceComponentId', compChildId)
  } else {
    instChild.componentId = compChildId
  }
}

function matchFallbackChildren(
  graph: SceneGraph,
  compParent: SceneNode,
  instParent: SceneNode,
  instParentId: string,
  overrides: InstanceOverrideState,
  instChildMap: Map<string, SceneNode>,
  usedInstChildIds: Set<string>
): void {
  const unmatchedCompChildIds = compParent.childIds.filter((id) => !instChildMap.has(id))
  const unmatchedInstChildren = instParent.childIds
    .map((id) => graph.nodes.get(id))
    .filter((n): n is SceneNode => n !== undefined && !usedInstChildIds.has(n.id))

  if (unmatchedCompChildIds.length === 0 || unmatchedInstChildren.length === 0) return

  // Match by name and type with forward (FIFO) iteration to preserve sibling order.
  for (const compChildId of unmatchedCompChildIds) {
    const compChild = graph.nodes.get(compChildId)
    if (!compChild) continue
    const matchIdx = unmatchedInstChildren.findIndex(
      (instChild) => instChild.type === compChild.type && instChild.name === compChild.name
    )
    if (matchIdx !== -1) {
      const [instChild] = unmatchedInstChildren.splice(matchIdx, 1)
      instChildMap.set(compChildId, instChild)
      usedInstChildIds.add(instChild.id)
      linkMatchedChild(overrides, instParentId, instChild, compChildId)
    }
  }
}

function sortInstanceChildren(
  graph: SceneGraph,
  instParent: SceneNode,
  instParentId: string,
  compChildOrder: string[],
  overrides: InstanceOverrideState
): void {
  const orderMap = new Map<string, number>()
  for (let i = 0; i < compChildOrder.length; i++) orderMap.set(compChildOrder[i], i)

  // Children whose resolved mapping (sourceComponentId override, else componentId)
  // is one of this component's children sort in component order; children with no
  // such mapping (e.g. imported extras or user-added nodes inside the instance)
  // sort to the END rather than the front, keeping their relative order among
  // themselves. This keeps component children in canonical order instead of yanking
  // unmapped extras to the front on every sync.
  instParent.childIds.sort((a, b) => {
    const nodeA = graph.nodes.get(a)
    const nodeB = graph.nodes.get(b)
    const sourceA = nodeA
      ? getInstanceOverride(overrides, instParentId, nodeA.id, 'sourceComponentId')
      : undefined
    const sourceB = nodeB
      ? getInstanceOverride(overrides, instParentId, nodeB.id, 'sourceComponentId')
      : undefined

    const mappedA = typeof sourceA === 'string' ? sourceA : nodeA?.componentId
    const mappedB = typeof sourceB === 'string' ? sourceB : nodeB?.componentId
    const idxA = mappedA ? (orderMap.get(mappedA) ?? -1) : -1
    const idxB = mappedB ? (orderMap.get(mappedB) ?? -1) : -1
    if (idxA === -1 && idxB === -1) return 0
    if (idxA === -1) return 1
    if (idxB === -1) return -1
    return idxA - idxB
  })
}

/** True when syncing `compParentId` into `instParentId` would form a cycle. */
function isCyclicSync(graph: SceneGraph, compParentId: string, instParentId: string): boolean {
  return compParentId === instParentId || graph.isDescendant(instParentId, compParentId)
}

function syncChildren(
  graph: SceneGraph,
  compParentId: string,
  instParentId: string,
  overrides: InstanceOverrideState
): void {
  // Guard against cyclic sync: if the instance parent is inside the component's own
  // subtree, syncing would clone the component into itself — a self-referential cycle
  // that causes unbounded recursion and OOM.
  if (isCyclicSync(graph, compParentId, instParentId)) return

  const compParent = graph.nodes.get(compParentId)
  const instParent = graph.nodes.get(instParentId)
  if (!compParent || !instParent) return

  const instChildMap = new Map<string, SceneNode>()
  const usedInstChildIds = new Set<string>()
  const compChildIdSet = new Set(compParent.childIds)

  // Pass 1: Direct matching via sourceComponentId or componentId
  for (const childId of instParent.childIds) {
    const child = graph.nodes.get(childId)
    if (!child) continue
    const sourceComponentId = getInstanceOverride(
      overrides,
      instParentId,
      child.id,
      'sourceComponentId'
    )

    const mappedComponentId =
      typeof sourceComponentId === 'string' ? sourceComponentId : child.componentId
    if (mappedComponentId && compChildIdSet.has(mappedComponentId)) {
      instChildMap.set(mappedComponentId, child)
      usedInstChildIds.add(child.id)
    }
  }

  // Pass 2: Fallback matching for unmatched children (e.g. from Figma imports)
  matchFallbackChildren(
    graph,
    compParent,
    instParent,
    instParentId,
    overrides,
    instChildMap,
    usedInstChildIds
  )

  // Pass 3: Clone only genuinely missing component children
  for (const compChildId of compParent.childIds) {
    if (!instChildMap.has(compChildId)) {
      const src = graph.nodes.get(compChildId)
      if (!src) continue
      const clone = graph.createNode(src.type, instParentId, cloneNodeProps(src, compChildId))
      if (src.childIds.length > 0) {
        cloneChildrenWithMapping(graph, compChildId, clone.id)
      }
      instChildMap.set(compChildId, clone)
      usedInstChildIds.add(clone.id)
    }
  }

  // Pass 4: Synchronize properties and recurse
  for (const compChildId of compParent.childIds) {
    const compChild = graph.nodes.get(compChildId)
    const instChild = instChildMap.get(compChildId)
    if (!compChild || !instChild) continue

    for (const key of INSTANCE_SYNC_FIELDS) {
      if (hasNodeInstanceOverride(overrides, instParentId, instChild.id, key)) continue

      copyProp(instChild, compChild, key)
    }

    if (
      compChild.childIds.length > 0 &&
      !hasNodeInstanceOverride(overrides, instParentId, instChild.id, 'componentId')
    ) {
      syncChildren(graph, compChildId, instChild.id, overrides)
    }
  }

  // Pass 5: Sort instance children to match component child order
  sortInstanceChildren(graph, instParent, instParentId, compParent.childIds, overrides)
}

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

export function swapInstanceComponent(
  graph: SceneGraph,
  instanceId: string,
  componentId: string
): void {
  const instance = graph.nodes.get(instanceId)
  const component = graph.nodes.get(componentId)
  if (!instance || component?.type !== 'COMPONENT' || instance.type !== 'INSTANCE') return

  const previousComponent = instance.componentId ? graph.nodes.get(instance.componentId) : undefined
  const updates: Partial<SceneNode> = { componentId }
  for (const key of INSTANCE_SYNC_PROPS) {
    if (hasNodeInstanceOverride(instance.instanceOverrides, instance.id, instance.id, key)) continue
    copyProp(updates, component, key)
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
      for (const key of INSTANCE_SYNC_PROPS) {
        if (hasNodeInstanceOverride(instance.instanceOverrides, instance.id, instance.id, key))
          continue
        copyProp(instance, component, key)
      }
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
