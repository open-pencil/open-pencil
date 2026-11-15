import type { RenderResult } from '@open-pencil/design-jsx'
import type { SceneGraph } from '@open-pencil/scene-graph'

import { findPageId } from '#core/io/subgraph'
import { layoutAuthoredNodes } from '#core/layout'

/** Placement fields shared by the render tool and its speculative preview. */
export interface RenderPlacementInput {
  parent_id?: string
  replace_id?: string
  insert_index?: number
  x?: number
  y?: number
}

export interface RenderPlacement {
  parentId: string
  /** Leave layout to `finishRenderPlacement`, which runs it once the roots are in order. */
  deferLayout?: boolean
  pageId: string
  replaceId?: string
  insertIndex?: number
  x?: number
  y?: number
}

function validateInsertIndex(index: number | undefined): void {
  if (index !== undefined && (!Number.isInteger(index) || index < 0)) {
    throw new Error('Render insertion index must be a non-negative integer')
  }
}

/** Resolve before creating nodes: replacement geometry/order must come from the original layout. */
export function resolveRenderPlacement(
  graph: SceneGraph,
  input: RenderPlacementInput,
  defaultPageId: string
): RenderPlacement {
  const replacement = input.replace_id ? graph.getNode(input.replace_id) : undefined
  if (input.replace_id && !replacement?.parentId)
    throw new Error('Render replacement target does not exist')
  const parentId = replacement?.parentId ?? input.parent_id ?? defaultPageId
  const parent = graph.getNode(parentId)
  const pageId = parent?.type === 'CANVAS' ? parent.id : findPageId(graph, parentId)
  if (!parent || !pageId) throw new Error('Render parent does not belong to a page')
  const insertIndex = replacement ? parent.childIds.indexOf(replacement.id) : input.insert_index
  validateInsertIndex(insertIndex)
  return {
    parentId,
    deferLayout: true,
    pageId,
    replaceId: replacement?.id,
    insertIndex,
    x: input.x ?? replacement?.x,
    y: input.y ?? replacement?.y
  }
}

/**
 * Where the roots go now: rendering can wait for fonts while other edits move or delete the
 * layer it replaces, so its place is read again once the roots exist. A render whose layer to
 * replace is gone is undone and throws.
 */
function currentPlacement(
  graph: SceneGraph,
  results: RenderResult[],
  placement: RenderPlacement
): RenderPlacement {
  if (!placement.replaceId) return placement
  const replaced = graph.getNode(placement.replaceId)
  const parent = replaced?.parentId ? graph.getNode(replaced.parentId) : undefined
  if (!replaced || !parent) {
    for (const result of results) graph.deleteNode(result.id)
    throw new Error('The layer to replace was deleted while the JSX rendered')
  }
  return { ...placement, parentId: parent.id, insertIndex: parent.childIds.indexOf(replaced.id) }
}

/** Complete hierarchy changes before layout so Fill/Hug and sibling positions use the final order. */
export function finishRenderPlacement(
  graph: SceneGraph,
  results: RenderResult[],
  resolved: RenderPlacement
): void {
  const placement = currentPlacement(graph, results, resolved)
  if (placement.insertIndex !== undefined) {
    for (const [offset, result] of results.entries()) {
      graph.insertChildAt(result.id, placement.parentId, placement.insertIndex + offset)
    }
  }
  if (placement.replaceId) graph.deleteNode(placement.replaceId)
  layoutAuthoredNodes(
    graph,
    results.map((result) => result.id)
  )
}
