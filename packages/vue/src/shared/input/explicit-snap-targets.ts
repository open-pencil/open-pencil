import type { Editor } from '@open-pencil/core/editor'
import type { SceneNode } from '@open-pencil/scene-graph'
import { getWorldMatrix } from '@open-pencil/scene-graph/coordinate'
import { layoutGuideLines } from '@open-pencil/scene-graph/layout-guides'
import Matrix from '@open-pencil/scene-graph/matrix'
import type { Vector } from '@open-pencil/scene-graph/primitives'

import type { ExplicitSnapTarget } from '#vue/shared/input/snap'

function pageGuideTargets(editor: Editor): ExplicitSnapTarget[] {
  const page = editor.graph.getNode(editor.state.currentPageId)
  if (!page) return []
  return page.guides.map((guide) => ({
    kind: 'canvas-guide',
    axis: guide.axis,
    position: guide.position,
    from: -1e6,
    to: 1e6
  }))
}

const AXIS_ALIGNMENT_EPSILON = 1e-6

function axisAlignedTarget(start: Vector, end: Vector): ExplicitSnapTarget | null {
  const dx = Math.abs(end.x - start.x)
  const dy = Math.abs(end.y - start.y)
  if (dx <= AXIS_ALIGNMENT_EPSILON) {
    return {
      kind: 'layout-guide',
      axis: 'x',
      position: start.x,
      from: Math.min(start.y, end.y),
      to: Math.max(start.y, end.y)
    }
  }
  if (dy <= AXIS_ALIGNMENT_EPSILON) {
    return {
      kind: 'layout-guide',
      axis: 'y',
      position: start.y,
      from: Math.min(start.x, end.x),
      to: Math.max(start.x, end.x)
    }
  }
  return null
}

function layoutGuideTargets(parent: SceneNode, editor: Editor): ExplicitSnapTarget[] {
  const matrix = getWorldMatrix(parent, editor.graph)
  return parent.layoutGrids.flatMap((grid) =>
    layoutGuideLines(parent, grid).flatMap((line) => {
      const start = Matrix.mapPoint(
        matrix,
        line.axis === 'x' ? { x: line.position, y: 0 } : { x: 0, y: line.position }
      )
      const end = Matrix.mapPoint(
        matrix,
        line.axis === 'x'
          ? { x: line.position, y: parent.height }
          : { x: parent.width, y: line.position }
      )
      const target = axisAlignedTarget(start, end)
      return target ? [target] : []
    })
  )
}

export function explicitSnapTargets(parentId: string | null | undefined, editor: Editor) {
  const parent = parentId ? editor.graph.getNode(parentId) : undefined
  return [
    ...pageGuideTargets(editor),
    ...(parent && !editor.isTopLevel(parent.id) ? layoutGuideTargets(parent, editor) : [])
  ]
}
