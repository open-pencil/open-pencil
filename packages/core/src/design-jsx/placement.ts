import { omit } from 'es-toolkit'

import { reconcileRenderedLayers, type RenderResult } from '@open-pencil/design-jsx'
import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'

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
 * Move the layer to replace out of the rendered root an edit put it in: back where it was, or,
 * when that parent is gone or inside a root too, to where the outermost root holding it stands,
 * together with whatever holds it directly under that root, so an edit that moved its parent into
 * a root loses none of that parent's other layers.
 */
function leaveRoots(
  graph: SceneGraph,
  layerId: string,
  roots: ReadonlySet<string>,
  placement: RenderPlacement
): void {
  const inRoot = (id: string) =>
    graph.closest(id, (ancestor) => roots.has(ancestor.id)) !== undefined
  if (!inRoot(layerId)) return
  if (graph.getNode(placement.parentId) && !inRoot(placement.parentId)) {
    graph.insertChildAt(layerId, placement.parentId, placement.insertIndex ?? 0)
    return
  }
  // The walk visits every ancestor, keeping the last one whose parent is a root: the outermost.
  let escaping: SceneNode | undefined
  graph.closest(layerId, (node) => {
    if (node.parentId && roots.has(node.parentId)) escaping = node
    return false
  })
  const holder = escaping?.parentId ? graph.getNode(escaping.parentId) : undefined
  const parent = holder?.parentId ? graph.getNode(holder.parentId) : undefined
  if (escaping && holder && parent) {
    graph.insertChildAt(escaping.id, parent.id, parent.childIds.indexOf(holder.id))
  }
}

/**
 * Undo a render whose layer to replace changed while it rendered, keeping that layer: one an edit
 * moved into a rendered root leaves it before the roots are deleted, and a root it could not
 * leave stays.
 */
function refuseReplacement(
  graph: SceneGraph,
  results: RenderResult[],
  placement: RenderPlacement,
  reason: string
): never {
  const replaceId = placement.replaceId
  const roots = new Set(results.map((result) => result.id))
  if (replaceId && graph.getNode(replaceId)) leaveRoots(graph, replaceId, roots, placement)
  for (const result of results) {
    if (!replaceId || !graph.isDescendant(replaceId, result.id)) graph.deleteNode(result.id)
  }
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
  const roots = new Set(results.map((result) => result.id))
  if (graph.closest(parent.id, (ancestor) => roots.has(ancestor.id))) {
    refuseReplacement(graph, results, placement, 'moved into its replacement')
  }
  if (results.some((result) => !graph.getNode(result.id))) {
    refuseReplacement(graph, results, placement, 'lost its replacement')
  }
  for (const result of results) graph.insertChildAt(result.id, parent.id, parent.childIds.length)
  return { ...placement, insertIndex: parent.childIds.indexOf(replaced.id) }
}

/** What a result reports once reconciling has given its layer the id `id`. */
function finishedResult(graph: SceneGraph, result: RenderResult, id: string): RenderResult {
  const node = graph.getNode(id)
  if (!node) return result
  return {
    ...omit(result, ['keepChildrenIds']),
    id,
    name: node.name,
    type: node.type,
    childIds: node.childIds
  }
}

/** Reconcile the rendered roots into `replaceId`, or delete them and throw if that is refused. */
function reconcileOrUndo(graph: SceneGraph, results: RenderResult[], replaceId: string) {
  const renderedIds = results.map((result) => result.id)
  try {
    return reconcileRenderedLayers(graph, [replaceId], renderedIds, results[0]?.keepChildrenIds)
  } catch (error) {
    for (const id of renderedIds) graph.deleteNode(id)
    throw error
  }
}

/**
 * Fold the rendered roots into the layer they replace, so it keeps its id and the layers written
 * with `keepChildren` keep their children. A render that cannot is undone and throws.
 */
function replaceWithRendered(
  graph: SceneGraph,
  results: RenderResult[],
  placement: RenderPlacement & { replaceId: string }
): RenderResult[] {
  const { ids } = reconcileOrUndo(graph, results, placement.replaceId)
  const finished = results.map((result) =>
    finishedResult(graph, result, ids.get(result.id) ?? result.id)
  )
  // The replaced layer stays where it was, after the roots rendered in front of it.
  if (placement.insertIndex !== undefined) {
    for (const [offset, result] of finished.entries()) {
      graph.insertChildAt(result.id, placement.parentId, placement.insertIndex + offset)
    }
  }
  return finished
}

/**
 * Complete hierarchy changes before layout so Fill/Hug and sibling positions use the final order.
 * Returns the results by the layers they end up as: a replaced layer keeps its id.
 */
export function finishRenderPlacement(
  graph: SceneGraph,
  results: RenderResult[],
  resolved: RenderPlacement
): RenderResult[] {
  const placement = currentPlacement(graph, results, resolved)
  if (placement.insertIndex !== undefined) {
    for (const [offset, result] of results.entries()) {
      graph.insertChildAt(result.id, placement.parentId, placement.insertIndex + offset)
    }
  }
  const { replaceId } = placement
  let finished = results
  if (replaceId) {
    finished = replaceWithRendered(graph, results, { ...placement, replaceId })
  } else if (results[0]?.keepChildrenIds) {
    for (const result of results) graph.deleteNode(result.id)
    throw new Error(
      'keepChildren keeps the children of a layer the JSX replaces: render it with replace_id ' +
        'set to the layer it was read from.'
    )
  }
  layoutAuthoredNodes(
    graph,
    finished.map((result) => result.id)
  )
  return finished
}
