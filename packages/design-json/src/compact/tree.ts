import { compactLayer, type CompactLayer } from '#design-json/compact/layer'
import { inferNesting } from '#design-json/compact/overlap'
import type { CompactDesignOptions, CompactNode } from '#design-json/compact/types'

import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import { getAxisAlignedWorldBounds } from '@open-pencil/scene-graph/coordinate'
import type { Rect, Vector } from '@open-pencil/scene-graph/primitives'

/** A compact layer with its box still on the canvas, while its nesting can still change. */
export interface Draft {
  layer: CompactLayer
  bounds: Rect
  children: Draft[]
}

/** The visible layers with these IDs, each with its visible children, in drawing order. */
export function draftLayers(
  graph: SceneGraph,
  nodeIds: readonly string[],
  options: CompactDesignOptions
): Draft[] {
  return nodeIds.flatMap((id) => {
    const draft = draftLayer(graph, graph.getNode(id), options)
    return draft ? [draft] : []
  })
}

function draftLayer(
  graph: SceneGraph,
  node: SceneNode | undefined,
  options: CompactDesignOptions
): Draft | null {
  // A hidden layer renders nothing, so the compact view leaves it out.
  if (!node?.visible) return null
  return {
    layer: compactLayer(graph, node),
    bounds: getAxisAlignedWorldBounds(node, graph),
    children: draftChildren(graph, node, options)
  }
}

/** The children, with nesting inferred among them unless their parent lays them out itself. */
function draftChildren(graph: SceneGraph, node: SceneNode, options: CompactDesignOptions) {
  const children = draftLayers(graph, node.childIds, options)
  if (!options.inferNesting || node.layoutMode !== 'NONE') return children
  return inferNesting(children)
}

/** The finished node: its box relative to `origin`, its parent's corner, and its children. */
export function finishDraft(draft: Draft, origin: Vector): CompactNode {
  const { bounds } = draft
  const box = {
    x: bounds.x - origin.x,
    y: bounds.y - origin.y,
    width: bounds.width,
    height: bounds.height
  }
  const children = draft.children.map((child) => finishDraft(child, bounds))
  if (children.length === 0) return { ...draft.layer, box }
  return { ...draft.layer, box, children }
}
