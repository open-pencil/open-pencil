import type { Editor } from '@open-pencil/core'
import type { SceneNode } from '@open-pencil/scene-graph'
import { guideLineInWorld } from '@open-pencil/scene-graph/guides'
import { layoutGuideLines } from '@open-pencil/scene-graph/layout'
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

function axisAlignedTarget(
  kind: ExplicitSnapTarget['kind'],
  start: Vector,
  end: Vector
): ExplicitSnapTarget | null {
  const dx = Math.abs(end.x - start.x)
  const dy = Math.abs(end.y - start.y)
  if (dx <= AXIS_ALIGNMENT_EPSILON) {
    return {
      kind,
      axis: 'x',
      position: start.x,
      from: Math.min(start.y, end.y),
      to: Math.max(start.y, end.y)
    }
  }
  if (dy <= AXIS_ALIGNMENT_EPSILON) {
    return {
      kind,
      axis: 'y',
      position: start.y,
      from: Math.min(start.x, end.x),
      to: Math.max(start.x, end.x)
    }
  }
  return null
}

function layoutGuideTargets(parent: SceneNode, editor: Editor): ExplicitSnapTarget[] {
  return parent.layoutGrids.flatMap((grid) =>
    layoutGuideLines(parent, grid).flatMap((line) => {
      const { start, end } = guideLineInWorld(editor.graph, parent, line.axis, line.position)
      const target = axisAlignedTarget('layout-guide', start, end)
      return target ? [target] : []
    })
  )
}

/** The guides on the frame a layer sits in, which snap the layers in it alone (Figma, live). */
function frameGuideTargets(parent: SceneNode, editor: Editor): ExplicitSnapTarget[] {
  return parent.guides.flatMap((guide) => {
    const { start, end } = guideLineInWorld(editor.graph, parent, guide.axis, guide.position)
    const target = axisAlignedTarget('canvas-guide', start, end)
    return target ? [target] : []
  })
}

export function explicitSnapTargets(parentId: string | null | undefined, editor: Editor) {
  const parent = parentId ? editor.graph.getNode(parentId) : undefined
  return [
    ...pageGuideTargets(editor),
    ...(parent && parent.type !== 'CANVAS' ? frameGuideTargets(parent, editor) : []),
    ...(parent && !editor.isTopLevel(parent.id) ? layoutGuideTargets(parent, editor) : [])
  ]
}
