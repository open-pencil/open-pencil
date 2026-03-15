import { copyEffects, copyFills, copyStrokes, copyStyleRuns } from './copy'

import type { SceneGraph, SceneNode, Fill, Stroke, Effect, StyleRun } from './scene-graph'

const INSTANCE_SYNC_PROPS: (keyof SceneNode)[] = [
  'width',
  'height',
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
  'borderLeftWeight'
]

function copyProp(
  target: Partial<SceneNode> | SceneNode,
  source: SceneNode,
  key: keyof SceneNode
): void {
  const val = source[key]
  if (key === 'fills') {
    ;(target as Record<string, unknown>)[key] = copyFills(val as Fill[])
  } else if (key === 'strokes') {
    ;(target as Record<string, unknown>)[key] = copyStrokes(val as Stroke[])
  } else if (key === 'effects') {
    ;(target as Record<string, unknown>)[key] = copyEffects(val as Effect[])
  } else if (key === 'styleRuns') {
    ;(target as Record<string, unknown>)[key] = copyStyleRuns(val as StyleRun[])
  } else {
    if (Array.isArray(val)) {
      ;(target as Record<string, unknown>)[key] = structuredClone(val)
    } else if (val !== null && typeof val === 'object') {
      ;(target as Record<string, unknown>)[key] = { ...val as Record<string, unknown> }
    } else {
      ;(target as Record<string, unknown>)[key] = val
    }
  }
}

function cloneChildrenWithMapping(graph: SceneGraph, sourceParentId: string, destParentId: string): void {
  const sourceParent = graph.nodes.get(sourceParentId)
  if (!sourceParent) return

  for (const childId of sourceParent.childIds) {
    const src = graph.nodes.get(childId)
    if (!src) continue

    const { id: _, parentId: _p, childIds: _c, boundVariables: bv, ...rest } = src
    const clone = graph.createNode(src.type, destParentId, {
      ...rest,
      boundVariables: { ...bv },
      componentId: childId
    })

    if (src.childIds.length > 0) {
      cloneChildrenWithMapping(graph, childId, clone.id)
    }
  }
}

function syncChildren(
  graph: SceneGraph,
  compParentId: string,
  instParentId: string,
  overrides: Record<string, unknown>
): void {
  const compParent = graph.nodes.get(compParentId)
  const instParent = graph.nodes.get(instParentId)
  if (!compParent || !instParent) return

  const instChildMap = new Map<string, SceneNode>()
  for (const childId of instParent.childIds) {
    const child = graph.nodes.get(childId)
    if (child?.componentId) instChildMap.set(child.componentId, child)
  }

  for (const compChildId of compParent.childIds) {
    if (!instChildMap.has(compChildId)) {
      const src = graph.nodes.get(compChildId)
      if (!src) continue
      const { id: _, parentId: _p, childIds: _c, boundVariables: bv2, ...rest } = src
      const clone = graph.createNode(src.type, instParentId, {
        ...rest,
        boundVariables: { ...bv2 },
        componentId: compChildId
      })
      if (src.childIds.length > 0) {
        cloneChildrenWithMapping(graph, compChildId, clone.id)
      }
      instChildMap.set(compChildId, clone)
    }
  }

  for (const compChildId of compParent.childIds) {
    const compChild = graph.nodes.get(compChildId)
    const instChild = instChildMap.get(compChildId)
    if (!compChild || !instChild) continue

    for (const key of INSTANCE_SYNC_PROPS) {
      const overrideKey = `${instChild.id}:${key}`
      if (overrideKey in overrides) continue
      copyProp(instChild, compChild, key)
    }

    for (const key of ['name', 'text', 'fontSize', 'fontWeight', 'fontFamily'] as const) {
      const overrideKey = `${instChild.id}:${key}`
      if (overrideKey in overrides) continue
      copyProp(instChild, compChild, key)
    }

    if (compChild.childIds.length > 0) {
      syncChildren(graph, compChildId, instChild.id, overrides)
    }
  }

  const compChildOrder = compParent.childIds
  instParent.childIds.sort((a, b) => {
    const nodeA = graph.nodes.get(a)
    const nodeB = graph.nodes.get(b)
    const idxA = nodeA?.componentId ? compChildOrder.indexOf(nodeA.componentId) : -1
    const idxB = nodeB?.componentId ? compChildOrder.indexOf(nodeB.componentId) : -1
    return idxA - idxB
  })
}

export function createInstance(
  graph: SceneGraph,
  componentId: string,
  parentId: string,
  overrides: Partial<SceneNode> = {}
): SceneNode | null {
  const component = graph.nodes.get(componentId)
  if (component?.type !== 'COMPONENT') return null

  const props: Partial<SceneNode> = { name: component.name, componentId }
  for (const key of INSTANCE_SYNC_PROPS) {
    copyProp(props, component, key)
  }

  const instance = graph.createNode('INSTANCE', parentId, { ...props, ...overrides })

  cloneChildrenWithMapping(graph, component.id, instance.id)

  return instance
}

export function populateInstanceChildren(graph: SceneGraph, instanceId: string, componentId: string): void {
  const instance = graph.nodes.get(instanceId)
  const component = graph.nodes.get(componentId)
  if (!instance || !component || instance.type !== 'INSTANCE') return
  cloneChildrenWithMapping(graph, componentId, instanceId)
}

export function syncInstances(graph: SceneGraph, componentId: string): void {
  const component = graph.nodes.get(componentId)
  if (component?.type !== 'COMPONENT') return

  for (const instance of getInstances(graph, componentId)) {
    for (const key of INSTANCE_SYNC_PROPS) {
      if (key in instance.overrides) continue
      copyProp(instance, component, key)
    }

    syncChildren(graph, component.id, instance.id, instance.overrides)
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
  node.overrides = {}
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
