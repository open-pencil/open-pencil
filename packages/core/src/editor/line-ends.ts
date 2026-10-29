import type { SceneNode } from '@open-pencil/scene-graph'
import { layerRotates } from '@open-pencil/scene-graph/generated'
import type { Vector } from '@open-pencil/scene-graph/primitives'

import type { NodePreview } from '#core/editor/node-preview'
import type { EditorContext } from '#core/editor/types'
import {
  aimLine,
  draggedLineEnds,
  isLineLike,
  lineWorldEnds,
  type LineEnd
} from '#core/geometry/line-ends'

type BeginNodePreview = (label?: string) => NodePreview

/**
 * Drags an end of a line, as Figma does for lines and arrows: the end follows the pointer and the
 * other stays, turning and stretching the line as one undo step. Shift holds it to 45° steps and
 * Alt keeps its midpoint.
 */
export function createLineEndActions(ctx: EditorContext, beginNodePreview: BeginNodePreview) {
  let drag: {
    line: SceneNode
    end: LineEnd
    ends: [Vector, Vector]
    press: Vector
    preview: NodePreview
  } | null = null

  function lineEndBegin(nodeId: string, end: LineEnd, x: number, y: number) {
    lineEndCancel()
    const line = ctx.graph.getNode(nodeId)
    if (!line || !isLineLike(line) || !layerRotates(line)) return
    drag = {
      line: { ...line },
      end,
      ends: lineWorldEnds(ctx.graph, line),
      press: { x, y },
      preview: beginNodePreview('Move line end')
    }
  }

  function lineEndDrag(x: number, y: number, modifiers: { shift?: boolean; alt?: boolean } = {}) {
    if (!drag) return
    const delta = { x: x - drag.press.x, y: y - drag.press.y }
    const [start, end] = draggedLineEnds(drag.ends, drag.end, delta, modifiers)
    const changes = aimLine(ctx.graph, drag.line, start, end)
    if (changes) drag.preview.update(drag.line.id, changes)
    ctx.requestRender()
  }

  function lineEndCommit() {
    const current = drag
    drag = null
    current?.preview.commit()
    ctx.requestRender()
  }

  function lineEndCancel() {
    const current = drag
    drag = null
    current?.preview.cancel()
    ctx.requestRender()
  }

  return { lineEndBegin, lineEndDrag, lineEndCommit, lineEndCancel }
}
