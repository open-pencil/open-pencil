import { createTwoFilesPatch, FILE_HEADERS_ONLY } from 'diff'

import { sceneNodeToJSX } from '@open-pencil/design-jsx'
import type { SceneGraph } from '@open-pencil/scene-graph'

/** Unified diff of two JSX sources, as `diff_jsx` returns it; `null` when they match. */
export function jsxPatch(
  fromName: string,
  toName: string,
  fromJSX: string,
  toJSX: string
): string | null {
  if (fromJSX === toJSX) return null
  // Line-terminated sources keep "No newline at end of file" out of the patch.
  const lines = (jsx: string) => (jsx ? `${jsx}\n` : '')
  return createTwoFilesPatch(fromName, toName, lines(fromJSX), lines(toJSX), undefined, undefined, {
    context: 3,
    headerOptions: FILE_HEADERS_ONLY
  })
}

export interface LayerJSXChange {
  id: string
  /** Empty when the layer was added. */
  before: string
  /** Empty when the layer was removed. */
  after: string
  patch: string
}

function layerJSX(graph: SceneGraph, id: string): string {
  return graph.getNode(id) ? sceneNodeToJSX(id, graph) : ''
}

/**
 * Top-level layers of a page whose JSX differs between two states of a document, in their
 * order afterwards, then removed ones. Both graphs must share node IDs, as a snapshot does.
 */
export function diffPageLayersJSX(
  before: SceneGraph,
  after: SceneGraph,
  pageId: string
): LayerJSXChange[] {
  const ids = new Set([
    ...(after.getNode(pageId)?.childIds ?? []),
    ...(before.getNode(pageId)?.childIds ?? [])
  ])
  return [...ids].flatMap((id) => {
    const from = layerJSX(before, id)
    const to = layerJSX(after, id)
    const name = after.getNode(id)?.name ?? before.getNode(id)?.name ?? id
    const patch = jsxPatch(`${name} #${id}`, `${name} #${id}`, from, to)
    return patch === null ? [] : [{ id, before: from, after: to, patch }]
  })
}
