import { isEqual, pick } from 'es-toolkit'
import { toRaw } from 'vue'

import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import { isGeneratedFrame } from '@open-pencil/scene-graph/generated'
import { readIcon } from '@open-pencil/scene-graph/icons'
import type { ShapeWithTextType } from '@open-pencil/scene-graph/shape-with-text'
import { slotPropertyId } from '@open-pencil/scene-graph/slots'

import { LAYER_OUTLINE_FIELDS } from '#vue/primitives/LayerTree/context'
import type {
  LayerNode,
  LayerOutline,
  LayerRow,
  LayerSelectionMode
} from '#vue/primitives/LayerTree/context'

function explicitModeIds(node: SceneNode): string[] | undefined {
  const ids = Object.values(node.variableModes)
  return ids.length > 0 ? ids : undefined
}

function shapeWithTextTypeOf(node: SceneNode): ShapeWithTextType | undefined {
  return node.type === 'SHAPE_WITH_TEXT' ? node.shapeWithTextType : undefined
}

/** The layers whose rows draw their own outline, as Figma's do; others keep their kind's glyph. */
const OUTLINE_TYPES = new Set(['RECTANGLE', 'ELLIPSE', 'LINE', 'POLYGON', 'STAR', 'VECTOR'])

function outlineOf(node: SceneNode): LayerOutline | undefined {
  if (!OUTLINE_TYPES.has(node.type) || (node.type === 'VECTOR' && !node.vectorNetwork)) {
    return undefined
  }
  return pick(node, LAYER_OUTLINE_FIELDS)
}

/** A visible image paint, in fills or strokes, which Figma marks a layer's row with. */
function showsImage(node: SceneNode): boolean {
  return [...node.fills, ...node.strokes].some(
    (paint) => paint.type === 'IMAGE' && paint.visible && paint.opacity > 0
  )
}

function sameOutline(target: LayerOutline | undefined, source: LayerOutline | undefined) {
  if (!target || !source) return target === source
  // The target may be a reactive row, which hands back proxies of the objects it holds.
  return LAYER_OUTLINE_FIELDS.every((field) => toRaw(target[field]) === source[field])
}

function nodeToLayerNode(node: SceneNode): LayerNode {
  return {
    id: node.id,
    name: node.name,
    type: node.type,
    layoutMode: node.layoutMode,
    slot: !!slotPropertyId(node),
    icon: !!readIcon(node),
    shapeWithTextType: shapeWithTextTypeOf(node),
    outline: outlineOf(node),
    image: showsImage(node),
    mask: node.isMask,
    visible: node.visible,
    locked: node.locked,
    modeIds: explicitModeIds(node)
  }
}

export interface LayerTreeModel {
  items: LayerNode[]
  byId: Map<string, LayerNode>
}

/**
 * Whether a layer's rows follow its flow, as Figma lists a horizontal or vertical auto layout's
 * children: first in the flow first. Other layers, grids included, list theirs front-most first.
 */
export function listsChildrenInFlow(node: Pick<SceneNode, 'layoutMode'>): boolean {
  return node.layoutMode === 'HORIZONTAL' || node.layoutMode === 'VERTICAL'
}

export function buildLayerTreeModel(graph: SceneGraph, parentId: string): LayerTreeModel {
  const byId = new Map<string, LayerNode>()

  const buildChildren = (id: string): LayerNode[] => {
    const parent = graph.getNode(id)
    if (!parent) return []
    const children: LayerNode[] = []
    // `childIds` runs from back to front, which is also an auto layout's flow.
    const rowOrder = listsChildrenInFlow(parent) ? parent.childIds : parent.childIds.toReversed()
    for (const childId of rowOrder) {
      const sceneNode = graph.getNode(childId)
      if (!sceneNode || sceneNode.internalOnly) continue
      const node = nodeToLayerNode(sceneNode)
      byId.set(node.id, node)
      // A generated frame, such as a sticky note, is one layer; its template owns what is inside.
      if (sceneNode.childIds.length > 0 && !isGeneratedFrame(sceneNode)) {
        node.children = buildChildren(node.id)
      }
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
  const outline = outlineOf(source)
  const changed =
    target.name !== source.name ||
    target.type !== source.type ||
    target.layoutMode !== source.layoutMode ||
    target.slot !== !!slotPropertyId(source) ||
    target.icon !== !!readIcon(source) ||
    target.shapeWithTextType !== shapeWithTextTypeOf(source) ||
    !sameOutline(target.outline, outline) ||
    target.image !== showsImage(source) ||
    target.mask !== source.isMask ||
    target.visible !== source.visible ||
    target.locked !== source.locked ||
    !isEqual(target.modeIds, explicitModeIds(source))
  if (!changed) return false
  target.name = source.name
  target.type = source.type
  target.layoutMode = source.layoutMode
  target.slot = !!slotPropertyId(source)
  target.icon = !!readIcon(source)
  target.shapeWithTextType = shapeWithTextTypeOf(source)
  target.outline = outline
  target.image = showsImage(source)
  target.mask = source.isMask
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
