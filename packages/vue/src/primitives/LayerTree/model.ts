import { isEqual } from 'es-toolkit'

import { vectorIconPath } from '@open-pencil/core/vector'
import { readIcon, slotPropertyId } from '@open-pencil/scene-graph'
import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'

import type { LayerNode, LayerRow, LayerSelectionMode } from '#vue/primitives/LayerTree/context'

function explicitModeIds(node: SceneNode): string[] | undefined {
  const ids = Object.values(node.variableModes)
  return ids.length > 0 ? ids : undefined
}

/** A vector's row shows its own shape, as in Figma; other layers show their kind's glyph. */
function layerIconPath(node: SceneNode): string | undefined {
  if (node.type !== 'VECTOR' || !node.vectorNetwork) return undefined
  return vectorIconPath(node.vectorNetwork) ?? undefined
}

function nodeToLayerNode(node: SceneNode): LayerNode {
  return {
    id: node.id,
    name: node.name,
    type: node.type,
    layoutMode: node.layoutMode,
    slot: !!slotPropertyId(node),
    icon: !!readIcon(node),
    iconPath: layerIconPath(node),
    visible: node.visible,
    locked: node.locked,
    modeIds: explicitModeIds(node)
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
  const iconPath = layerIconPath(source)
  const changed =
    target.iconPath !== iconPath ||
    target.name !== source.name ||
    target.type !== source.type ||
    target.layoutMode !== source.layoutMode ||
    target.slot !== !!slotPropertyId(source) ||
    target.icon !== !!readIcon(source) ||
    target.visible !== source.visible ||
    target.locked !== source.locked ||
    !isEqual(target.modeIds, explicitModeIds(source))
  if (!changed) return false
  target.name = source.name
  target.type = source.type
  target.layoutMode = source.layoutMode
  target.slot = !!slotPropertyId(source)
  target.icon = !!readIcon(source)
  target.iconPath = iconPath
  target.visible = source.visible
  target.locked = source.locked
  target.modeIds = explicitModeIds(source)
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

/**
 * Where a dropped layer goes among its new siblings: `index` in `childIds` counted without the
 * layer, so one dragged from earlier in the same parent lands one slot sooner.
 */
export function dropIndex(childIds: readonly string[], sourceId: string, index: number): number {
  const sourceIndex = childIds.indexOf(sourceId)
  return sourceIndex !== -1 && sourceIndex < index ? index - 1 : index
}
