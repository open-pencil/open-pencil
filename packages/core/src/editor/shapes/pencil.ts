import { pick } from 'es-toolkit'

import type { SceneNode } from '@open-pencil/scene-graph'
import { compositeOver, readableForeground } from '@open-pencil/scene-graph/color'
import type { Color, Vector } from '@open-pencil/scene-graph/primitives'

import { PEN_CLOSE_THRESHOLD, PENCIL_STROKE_WEIGHT, PENCIL_TOLERANCE } from '#core/constants'
import { createVectorFromNetwork, type CreateShape } from '#core/editor/shapes/vector'
import { nextNumberedName } from '#core/editor/structure/rename'
import type { EditorContext } from '#core/editor/types'
import { freehandNetwork, simplifyFreehand } from '#core/vector/freehand'

const STYLE_FIELDS = ['strokes', 'strokeCap', 'strokeJoin'] as const

type PencilStyle = Pick<SceneNode, (typeof STYLE_FIELDS)[number]>

/** `point` moved onto the horizontal or vertical line through `anchor`, whichever is nearer. */
function axisLocked(anchor: Vector, point: Vector): Vector {
  return Math.abs(point.x - anchor.x) >= Math.abs(point.y - anchor.y)
    ? { x: point.x, y: anchor.y }
    : { x: anchor.x, y: point.y }
}

/**
 * Freehand strokes, as Figma's pencil draws them: each stroke becomes its own outlined vector
 * whose curve is fitted to the samples at the zoom it was drawn at, and the tool stays active.
 * New strokes contrast with what they are drawn on until the last pencil layer is restyled; from
 * then on they take its strokes, cap, and join, even after that layer is gone.
 */
export function createPencilActions(ctx: EditorContext, createShape: CreateShape) {
  let lastNodeId: string | null = null
  let remembered: PencilStyle | null = null

  function pencilBegin(x: number, y: number) {
    const stroke = strokeStyle(undefined).strokes.find((paint) => paint.visible)
    ctx.state.pencilState = {
      points: [{ x, y }],
      straightFrom: null,
      preview: {
        color: stroke?.color ?? readableForeground(ctx.state.pageColor),
        weight: stroke?.weight ?? PENCIL_STROKE_WEIGHT
      }
    }
    ctx.requestRepaint()
  }

  /** Adds a sample; while `straight`, the stroke runs from where Shift was pressed along an axis. */
  function pencilAddPoint(x: number, y: number, straight = false) {
    const pencil = ctx.state.pencilState
    if (!pencil) return
    if (!straight) {
      pencil.straightFrom = null
      pencil.points.push({ x, y })
    } else {
      pencil.straightFrom ??= pencil.points.length - 1
      const anchor = pencil.points[pencil.straightFrom]
      pencil.points.length = pencil.straightFrom + 1
      pencil.points.push(axisLocked(anchor, { x, y }))
    }
    ctx.requestRepaint()
  }

  function background(parentId: string | undefined): Color {
    const page = ctx.state.pageColor
    const parent = parentId ? ctx.graph.getNode(parentId) : undefined
    const fill = parent?.fills.findLast((paint) => paint.visible && paint.type === 'SOLID')
    return fill ? compositeOver(fill.color, page, fill.color.a * fill.opacity) : page
  }

  ctx.onEditorEvent('node:updated', (id, changes) => {
    if (id !== lastNodeId || !STYLE_FIELDS.some((field) => field in changes)) return
    const node = ctx.graph.getNode(id)
    if (node) remembered = structuredClone(pick(node, STYLE_FIELDS))
  })

  function strokeStyle(parentId: string | undefined): PencilStyle {
    return structuredClone(remembered ?? contrastingStyle(parentId))
  }

  function contrastingStyle(parentId: string | undefined): PencilStyle {
    return {
      strokes: [
        {
          type: 'SOLID',
          color: readableForeground(background(parentId)),
          weight: PENCIL_STROKE_WEIGHT,
          opacity: 1,
          visible: true,
          align: 'CENTER'
        }
      ],
      strokeCap: 'ROUND',
      strokeJoin: 'ROUND'
    }
  }

  function pencilCancel() {
    ctx.state.pencilState = null
    ctx.requestRepaint()
  }

  /**
   * Turns the stroke into a vector layer in `parentId`, the current page when omitted. A press
   * without movement draws nothing.
   */
  function pencilCommit(parentId?: string): string | null {
    const points = ctx.state.pencilState?.points ?? []
    ctx.state.pencilState = null
    const zoom = ctx.state.zoom
    const first = points.at(0)
    const last = points.at(-1)
    const ends = first && last ? Math.hypot(last.x - first.x, last.y - first.y) * zoom : 0
    const tolerance = PENCIL_TOLERANCE / zoom
    let controls = simplifyFreehand(points, tolerance)
    const closed = controls.length > 3 && ends <= PEN_CLOSE_THRESHOLD
    if (closed) controls = simplifyFreehand(points, tolerance, true)
    if (controls.length < 2) {
      ctx.requestRepaint()
      return null
    }

    const pageId = parentId ?? ctx.state.currentPageId
    const nodeId = createVectorFromNetwork(
      ctx,
      createShape,
      freehandNetwork(controls, closed),
      { ...strokeStyle(parentId), name: nextNumberedName(ctx.graph, pageId, 'Vector'), fills: [] },
      parentId
    )
    lastNodeId = nodeId
    ctx.setSelectedIds(new Set())
    ctx.requestRender()
    return nodeId
  }

  return { pencilBegin, pencilAddPoint, pencilCommit, pencilCancel }
}
