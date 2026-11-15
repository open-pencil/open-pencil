import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'

import type { ExportEffectWarning } from '#core/io/formats/svg'
import { unsupportedEffectWarning } from '#core/io/formats/svg/effects'

/** The layers draw.io export writes as draw.io's own cells, which draw no effects. */
const DRAWN_AS_CELL: ReadonlySet<SceneNode['type']> = new Set<SceneNode['type']>([
  'SHAPE_WITH_TEXT',
  'TEXT',
  'STICKY',
  'SECTION',
  'GROUP',
  'FRAME',
  'RECTANGLE',
  'ELLIPSE',
  'CONNECTOR'
])

/** Whether the layer and every layer above it on its page are shown. */
function shownOnPage(graph: SceneGraph, pageId: string, node: SceneNode): boolean {
  let current: SceneNode | undefined = node
  while (current && current.id !== pageId) {
    if (!current.visible) return false
    current = current.parentId ? graph.getNode(current.parentId) : undefined
  }
  return true
}

/**
 * The warnings for the visible effects a layer loses as a draw.io cell; none for a hidden layer,
 * or one drawn as an SVG image, whose SVG export reports what it leaves out.
 */
export function droppedEffectWarnings(
  graph: SceneGraph,
  pageId: string,
  node: SceneNode
): ExportEffectWarning[] {
  if (!DRAWN_AS_CELL.has(node.type) || !shownOnPage(graph, pageId, node)) return []
  return node.effects
    .filter((effect) => effect.visible)
    .map((effect) => unsupportedEffectWarning(node, effect, 'draw.io'))
}
