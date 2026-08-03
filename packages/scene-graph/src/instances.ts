import { isEqual } from 'es-toolkit/predicate'

import type { SceneGraph, SceneNode } from './'
import { cloneNodeProps, copyEffects, copyFills, copyStrokes, copyStyleRuns } from './copy'
import type { NodeCloneMode } from './copy'
import {
  changesInvalidateFigmaDerivedTextGlyphs,
  invalidatesFigmaDerivedTextGlyphs,
  invalidatesTextPicture
} from './text-picture'

export type { NodeCloneMode } from './copy'

const INSTANCE_SYNC_PROPS: (keyof SceneNode)[] = [
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

const INSTANCE_TEXT_SYNC_PROPS = [
  'name',
  'text',
  'fontSize',
  'fontWeight',
  'fontFamily',
  'textDirection'
] as const satisfies readonly (keyof SceneNode)[]

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

/**
 * Clear text-derived caches for a prop that is about to be copied from `source` onto `target`.
 * Must run BEFORE the copy so `target` still holds its previous value — `styleRuns` invalidation
 * is content-aware and compares the pre-copy target against the incoming source.
 */
function clearTextDerivedDataForProp(
  target: SceneNode,
  key: keyof SceneNode,
  source: SceneNode
): void {
  if (target.type !== 'TEXT') return
  const keyName = String(key)
  if (invalidatesTextPicture(keyName)) target.textPicture = null
  if (keyName === 'styleRuns') {
    if (changesInvalidateFigmaDerivedTextGlyphs(target, { styleRuns: source.styleRuns })) {
      target.figmaDerivedTextGlyphs = null
    }
  } else if (invalidatesFigmaDerivedTextGlyphs(keyName)) {
    target.figmaDerivedTextGlyphs = null
  }
}

function copyPropIfChanged(target: SceneNode, source: SceneNode, key: keyof SceneNode): boolean {
  if (isEqual(target[key], source[key])) return false
  if (target.type === 'TEXT') clearTextDerivedDataForProp(target, key, source)
  copyProp(target, source, key)
  return true
}

function syncPropList(
  target: SceneNode,
  source: SceneNode,
  keys: readonly (keyof SceneNode)[],
  overrides: Record<string, unknown>
): void {
  for (const key of keys) {
    const overrideKey = `${target.id}:${key}`
    if (overrideKey in overrides) continue
    // copyPropIfChanged clears text-derived data before copying, so styleRuns
    // content-aware invalidation compares the previous target against the source.
    copyPropIfChanged(target, source, key)
  }
}

function cloneChildrenWithMapping(
  graph: SceneGraph,
  sourceParentId: string,
  destParentId: string,
  mode: NodeCloneMode = 'deep'
): void {
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
    if (!child) continue
    const sourceComponentId = overrides[`${child.id}:sourceComponentId`]
    const mappedComponentId =
      typeof sourceComponentId === 'string' ? sourceComponentId : child.componentId
    if (mappedComponentId) instChildMap.set(mappedComponentId, child)
  }

  for (const compChildId of compParent.childIds) {
    if (!instChildMap.has(compChildId)) {
      const src = graph.nodes.get(compChildId)
      if (!src) continue
      const clone = graph.createNode(src.type, instParentId, cloneNodeProps(src, compChildId))
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

    syncPropList(instChild, compChild, INSTANCE_SYNC_PROPS, overrides)
    syncPropList(instChild, compChild, INSTANCE_TEXT_SYNC_PROPS, overrides)

    if (compChild.childIds.length > 0 && !(`${instChild.id}:componentId` in overrides)) {
      syncChildren(graph, compChildId, instChild.id, overrides)
    }
  }

  const compChildOrder = compParent.childIds
  instParent.childIds.sort((a, b) => {
    const nodeA = graph.nodes.get(a)
    const nodeB = graph.nodes.get(b)
    const sourceA = nodeA ? overrides[`${nodeA.id}:sourceComponentId`] : undefined
    const sourceB = nodeB ? overrides[`${nodeB.id}:sourceComponentId`] : undefined
    const mappedA = typeof sourceA === 'string' ? sourceA : nodeA?.componentId
    const mappedB = typeof sourceB === 'string' ? sourceB : nodeB?.componentId
    const idxA = mappedA ? compChildOrder.indexOf(mappedA) : -1
    const idxB = mappedB ? compChildOrder.indexOf(mappedB) : -1
    return idxA - idxB
  })
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
    if (key in instance.overrides) continue
    copyProp(updates, component, key)
  }
  if (!previousComponent || instance.name === previousComponent.name) updates.name = component.name

  const childIds = Array.from(instance.childIds)
  for (const childId of childIds) graph.deleteNode(childId)
  graph.updateNode(instanceId, updates)
  cloneChildrenWithMapping(graph, componentId, instanceId)
}

export function syncInstances(graph: SceneGraph, componentId: string): void {
  const component = graph.nodes.get(componentId)
  if (component?.type !== 'COMPONENT') return

  for (const instance of getInstances(graph, componentId)) {
    for (const key of INSTANCE_SYNC_PROPS) {
      if (key in instance.overrides) continue
      copyPropIfChanged(instance, component, key)
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
