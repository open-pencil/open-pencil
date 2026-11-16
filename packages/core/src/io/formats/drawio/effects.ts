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

/** Cells that draw their sublayers themselves, as a label or a sticky's text, without effects. */
const FOLDS_SUBLAYERS: ReadonlySet<SceneNode['type']> = new Set<SceneNode['type']>([
  'SHAPE_WITH_TEXT',
  'STICKY',
  'CONNECTOR'
])

/** The layer and, for a cell that folds them in, its shown sublayers. */
function cellLayers(graph: SceneGraph, node: SceneNode): SceneNode[] {
  if (!FOLDS_SUBLAYERS.has(node.type)) return [node]
  const layers = [node]
  for (const layer of layers) {
    for (const child of graph.getChildren(layer.id)) if (child.visible) layers.push(child)
  }
  return layers
}

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
 * The warnings for the visible effects a layer loses in draw.io: every effect of one drawn as a
 * draw.io cell and of the sublayers the cell folds in, and the background blur of one drawn as an
 * SVG image, which sees only itself behind it. The image's SVG export reports the rest of what it
 * leaves out. None for a hidden layer.
 */
export function droppedEffectWarnings(
  graph: SceneGraph,
  pageId: string,
  node: SceneNode
): ExportEffectWarning[] {
  if (!shownOnPage(graph, pageId, node)) return []
  const cell = DRAWN_AS_CELL.has(node.type)
  return (cell ? cellLayers(graph, node) : [node]).flatMap((layer) =>
    layer.effects
      .filter((effect) => effect.visible && (cell || effect.type === 'BACKGROUND_BLUR'))
      .map((effect) => unsupportedEffectWarning(layer, effect, 'draw.io'))
  )
}
