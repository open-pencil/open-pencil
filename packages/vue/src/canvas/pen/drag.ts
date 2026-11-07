import type { Editor } from '@open-pencil/core'
import { PEN_CLOSE_MIN_POINTS } from '@open-pencil/core/constants'
import type { Vector } from '@open-pencil/scene-graph/primitives'

import { isPastPointerDragThreshold } from '#vue/shared/input/drag-threshold'
import type { DragState } from '#vue/shared/input/types'

type PenDragState = Extract<DragState, { type: 'pen-drag' }>
type PenState = NonNullable<Editor['state']['penState']>
type PenModifierMode = PenDragState['modifierMode']

/**
 * A pen drag from the point at `start`, pressed at `press`: the press can land beside the point it
 * snaps to, and only movement from the press counts as a drag. `incoming` is the handle into the
 * point that the drag keeps, for a press back on the last point.
 */
export function createPenDrag(
  start: Vector,
  press: Vector,
  incoming: Vector | null = null
): DragState {
  return {
    type: 'pen-drag',
    startX: start.x,
    startY: start.y,
    pressX: press.x,
    pressY: press.y,
    incoming: incoming && { x: incoming.x, y: incoming.y },
    moved: false,
    modifierMode: 'default',
    frozenOppositeTangent: null,
    spaceDown: false,
    spaceStartX: 0,
    spaceStartY: 0,
    knotStartX: start.x,
    knotStartY: start.y
  }
}

function getPenAnchor(penState: PenState): Vector {
  const isClosing = !!penState.pendingClose && penState.vertices.length >= PEN_CLOSE_MIN_POINTS
  const anchorIndex = isClosing ? 0 : penState.vertices.length - 1
  return penState.vertices[anchorIndex]
}

function handleSpaceDrag(
  d: PenDragState,
  cx: number,
  cy: number,
  isSpace: boolean,
  anchor: Vector,
  editor: Editor
): boolean {
  if (!isSpace) return false
  if (!d.spaceDown) {
    d.spaceDown = true
    d.spaceStartX = cx
    d.spaceStartY = cy
    d.knotStartX = anchor.x
    d.knotStartY = anchor.y
  }

  const dx = cx - d.spaceStartX
  const dy = cy - d.spaceStartY
  editor.penSetKnotPosition(d.knotStartX + dx, d.knotStartY + dy)
  return true
}

function applySpaceDragOffset(d: PenDragState, anchor: Vector) {
  if (!d.spaceDown) return
  d.spaceDown = false
  d.startX += anchor.x - d.knotStartX
  d.startY += anchor.y - d.knotStartY
}

function getModifierMode(event: MouseEvent): PenModifierMode {
  if (event.metaKey || event.ctrlKey) return 'continuous'
  if (event.altKey) return 'independent'
  return 'default'
}

function freezeOppositeTangent(penState: PenState): Vector | null {
  const lastSeg = penState.segments.at(-1)
  return lastSeg ? { ...lastSeg.tangentEnd } : null
}

function updateModifierMode(d: PenDragState, mode: PenModifierMode, penState: PenState) {
  if (mode === d.modifierMode) return
  if (mode === 'default') {
    d.frozenOppositeTangent = null
  } else if (!d.frozenOppositeTangent) {
    d.frozenOppositeTangent = freezeOppositeTangent(penState)
  }
  d.modifierMode = mode
}

function applyPenDragTangent(
  editor: Editor,
  d: PenDragState,
  tx: number,
  ty: number,
  mode: PenModifierMode
) {
  if (mode === 'continuous') {
    editor.penSetDragTangent(tx, ty, {
      keepOpposite: true,
      constrainToOpposite: true,
      oppositeTangent: d.frozenOppositeTangent
    })
    return
  }

  if (mode === 'independent') {
    editor.penSetDragTangent(tx, ty, {
      keepOpposite: true,
      oppositeTangent: d.frozenOppositeTangent
    })
    return
  }

  if (d.incoming) {
    editor.penSetDragTangent(tx, ty, { keepOpposite: true, oppositeTangent: d.incoming })
    return
  }
  editor.penSetDragTangent(tx, ty)
}

export function handlePenDragMove(
  d: PenDragState,
  cx: number,
  cy: number,
  isSpace: boolean,
  event: MouseEvent,
  editor: Editor
): void {
  const penState = editor.state.penState
  if (!penState) return

  const anchor = getPenAnchor(penState)
  if (handleSpaceDrag(d, cx, cy, isSpace, anchor, editor)) return

  applySpaceDragOffset(d, anchor)

  // A press that hasn't moved past the threshold is a click; a drag that has can bring the handle
  // all the way back to its point.
  const { zoom } = editor.state
  d.moved ||= isPastPointerDragThreshold(d.pressX * zoom, d.pressY * zoom, cx * zoom, cy * zoom)
  if (!d.moved) return
  const tx = cx - d.startX
  const ty = cy - d.startY

  const mode = getModifierMode(event)
  updateModifierMode(d, mode, penState)
  applyPenDragTangent(editor, d, tx, ty, mode)
}
