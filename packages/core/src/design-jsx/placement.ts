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
 * Undo a render whose layer to replace changed while it rendered, keeping that layer: one an edit
 * moved into a rendered root goes back where it was before the roots are deleted.
 */
function refuseReplacement(
  graph: SceneGraph,
  results: RenderResult[],
  placement: RenderPlacement,
  reason: string
): never {
  const replaced = placement.replaceId ? graph.getNode(placement.replaceId) : undefined
  const roots = new Set(results.map((result) => result.id))
  if (replaced && graph.closest(replaced.id, (ancestor) => roots.has(ancestor.id))) {
    graph.insertChildAt(replaced.id, placement.parentId, placement.insertIndex ?? 0)
  }
  for (const result of results) graph.deleteNode(result.id)
  throw new Error(`The layer to replace ${reason} while the JSX rendered`)
}

/**
 * Where the roots go now: rendering can wait for fonts while other edits move siblings, so the
 * place of the layer it replaces is read again once the roots exist, with the roots moved out of
 * the way so they go in as one block. A render whose layer to replace was deleted or moved to
 * another parent, or whose roots were deleted, is undone and throws, and the layer stays.
 */
function currentPlacement(
  graph: SceneGraph,
  results: RenderResult[],
  placement: RenderPlacement
): RenderPlacement {
  if (!placement.replaceId) return placement
  const replaced = graph.getNode(placement.replaceId)
  const parent = replaced?.parentId ? graph.getNode(replaced.parentId) : undefined
  if (!replaced || !parent) refuseReplacement(graph, results, placement, 'was deleted')
  // The roots are placed in its parent's coordinates, captured before rendering.
  if (parent.id !== placement.parentId) refuseReplacement(graph, results, placement, 'moved')
  if (results.some((result) => !graph.getNode(result.id))) {
    refuseReplacement(graph, results, placement, 'lost its replacement')
  }
  for (const result of results) graph.insertChildAt(result.id, parent.id, parent.childIds.length)
  return { ...placement, insertIndex: parent.childIds.indexOf(replaced.id) }
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
