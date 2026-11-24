import type { SceneGraph } from '@open-pencil/scene-graph'
import { svgPathSink } from '@open-pencil/scene-graph/paths'

import { makeBooleanOperationPath, windingRuleOf } from '#core/canvas/boolean'
import { tracePath } from '#core/canvas/paths/verbs'
import { getCanvasKit } from '#core/canvaskit'
import { withHeadlessExport } from '#core/io/formats/raster/headless'
import { round } from '#core/io/formats/svg/paths'

import type { SVGBooleanOutlines } from './outline'

function containsBoolean(graph: SceneGraph, nodeIds: readonly string[]): boolean {
  return nodeIds.some((id) => {
    const node = graph.getNode(id)
    if (!node?.visible) return false
    return node.type === 'BOOLEAN_OPERATION' || containsBoolean(graph, node.childIds)
  })
}

/**
 * Runs `render` with the boolean operations under `nodeIds` combined as the canvas combines them,
 * starting a renderer only when there are any. Without CanvasKit, `render` gets none.
 */
export async function withBooleanOutlines<T>(
  graph: SceneGraph,
  nodeIds: readonly string[],
  render: (outlines: SVGBooleanOutlines | undefined) => Promise<T>
): Promise<T> {
  if (!containsBoolean(graph, nodeIds)) return render(undefined)
  const ck = await getCanvasKit().catch(() => null)
  if (!ck) return render(undefined)
  return withHeadlessExport((renderer) =>
    render((node) => {
      const path = makeBooleanOperationPath(renderer, node, graph)
      if (!path) return []
      try {
        const parts: string[] = []
        tracePath(
          renderer.ck,
          path,
          svgPathSink(parts, (value) => round(value))
        )
        const d = parts.join('')
        return d ? [{ d, windingRule: windingRuleOf(renderer, path) }] : []
      } finally {
        path.delete()
      }
    })
  )
}
