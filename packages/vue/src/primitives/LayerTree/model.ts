import { readIcon, slotPropertyId } from '@open-pencil/scene-graph'
import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'

import type { LayerNode, LayerRow, LayerSelectionMode } from '#vue/primitives/LayerTree/context'

function nodeToLayerNode(node: SceneNode): LayerNode {
  return {
    id: node.id,
    name: node.name,
    type: node.type,
    layoutMode: node.layoutMode,
    slot: !!slotPropertyId(node),
    icon: !!readIcon(node),
    visible: node.visible,
    locked: node.locked
  }
}

export interface LayerTreeModel {
  items: LayerNode[]
  byId: Map<string, LayerNode>
}

export function buildLayerTreeModel(graph: SceneGraph, parentId: string): LayerTreeModel {
  const byId = new Map<string, LayerNode>()

  const buildChildren = (id: string): LayerNode[] => {
    const parent = graph.getNode(id)
    if (!parent) return []
    const children: LayerNode[] = []
    for (const childId of parent.childIds) {
      const sceneNode = graph.getNode(childId)
      if (!sceneNode || sceneNode.internalOnly) continue
      const node = nodeToLayerNode(sceneNode)
      byId.set(node.id, node)
      if (sceneNode.childIds.length > 0) node.children = buildChildren(node.id)
      children.push(node)
    }
    return children
  }

  return { items: buildChildren(parentId), byId }
}

export function indexLayerNodes(items: readonly LayerNode[]): Map<string, LayerNode> {
  const byId = new Map<string, LayerNode>()
  const visit = (nodes: readonly LayerNode[]) => {
    for (const node of nodes) {
      byId.set(node.id, node)
      if (node.children) visit(node.children)
    }
  }
  visit(items)
  return byId
}

export function patchLayerNode(target: LayerNode, source: SceneNode): boolean {
  const changed =
    target.name !== source.name ||
    target.type !== source.type ||
    target.layoutMode !== source.layoutMode ||
    target.slot !== !!slotPropertyId(source) ||
    target.icon !== !!readIcon(source) ||
    target.visible !== source.visible ||
    target.locked !== source.locked
  if (!changed) return false
  target.name = source.name
  target.type = source.type
  target.layoutMode = source.layoutMode
  target.slot = !!slotPropertyId(source)
  target.icon = !!readIcon(source)
  target.visible = source.visible
  target.locked = source.locked
  return true
}

export function visibleLayerRows(
  items: readonly LayerNode[],
  expandedIds: ReadonlySet<string>
): LayerRow[] {
  const rows: LayerRow[] = []
  const append = (nodes: readonly LayerNode[], level: number) => {
    for (const node of nodes) {
      const hasChildren = (node.children?.length ?? 0) > 0
      rows.push({ node, level, hasChildren })
      if (hasChildren && expandedIds.has(node.id)) append(node.children ?? [], level + 1)
    }
  }
  append(items, 1)
  return rows
}

export function layerSelectionForTarget(
  visibleIds: readonly string[],
  currentIds: ReadonlySet<string>,
  anchorId: string | null,
  targetId: string,
  mode: LayerSelectionMode
): Set<string> {
  if (!mode.range || !anchorId) {
    if (!mode.additive) return new Set([targetId])
    const next = new Set(currentIds)
    if (next.has(targetId)) next.delete(targetId)
    else next.add(targetId)
    return next
  }

  const anchorIndex = visibleIds.indexOf(anchorId)
  const targetIndex = visibleIds.indexOf(targetId)
  if (anchorIndex === -1 || targetIndex === -1) return new Set([targetId])
  const start = Math.min(anchorIndex, targetIndex)
  const end = Math.max(anchorIndex, targetIndex)
  const next = mode.additive ? new Set(currentIds) : new Set<string>()
  for (let index = start; index <= end; index++) {
    const id = visibleIds[index]
    if (id) next.add(id)
  }
  return next
}
