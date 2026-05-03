import type { DragState } from '#vue/shared/input/types'
import type { Editor } from '@open-pencil/core/editor'
import type { Vector } from '@open-pencil/core/types'

type PenDragState = Extract<DragState, { type: 'pen-drag' }>
type PenState = NonNullable<Editor['state']['penState']>
type PenModifierMode = PenDragState['modifierMode']

export function createPenDrag(startX: number, startY: number): DragState {
  return {
    type: 'pen-drag',
    startX,
    startY,
    modifierMode: 'default',
    frozenOppositeTangent: null,
    spaceDown: false,
    spaceStartX: 0,
    spaceStartY: 0,
    knotStartX: startX,
    knotStartY: startY
  } as DragState
}

function getPenAnchor(penState: PenState): Vector {
  const isClosing = !!penState.pendingClose && penState.vertices.length > 2
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

function getClosingOpposite(penState: PenState): Vector | null {
  const firstSeg = penState.segments[0]
  if (!penState.pendingClose) return null
  if (firstSeg.start === 0) return firstSeg.tangentStart
  if (firstSeg.end === 0) return firstSeg.tangentEnd
  return null
}

function getModifierMode(event: MouseEvent): PenModifierMode {
  if (event.metaKey || event.ctrlKey) return 'continuous'
  if (event.altKey) return 'independent'
  return 'default'
}

function freezeOppositeTangent(penState: PenState, closingOpposite: Vector | null): Vector {
  const lastSeg = penState.segments[penState.segments.length - 1]
  if (closingOpposite) return { ...closingOpposite }
  return { ...lastSeg.tangentEnd }
}

function updateModifierMode(d: PenDragState, mode: PenModifierMode, penState: PenState) {
  if (mode === d.modifierMode) return
  if (mode === 'default') {
    d.frozenOppositeTangent = null
  } else if (!d.frozenOppositeTangent) {
    d.frozenOppositeTangent = freezeOppositeTangent(penState, getClosingOpposite(penState))
  }
  d.modifierMode = mode
}

function applyPenDragTangent(
  editor: Editor,
  penState: PenState,
  d: PenDragState,
  tx: number,
  ty: number,
  mode: PenModifierMode,
  closingOpposite: Vector | null
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

  const options = penState.pendingClose
    ? { keepOpposite: true, oppositeTangent: closingOpposite }
    : undefined
  editor.penSetDragTangent(tx, ty, options)
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

  const tx = cx - d.startX
  const ty = cy - d.startY
  if (Math.hypot(tx, ty) <= 2) return

  const mode = getModifierMode(event)
  updateModifierMode(d, mode, penState)
  applyPenDragTangent(editor, penState, d, tx, ty, mode, getClosingOpposite(penState))
}
