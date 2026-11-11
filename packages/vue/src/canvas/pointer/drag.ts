import type { Editor } from '@open-pencil/core'

import type { createGuideInput } from '#vue/canvas/guides/input'
import { selectedTopLevelGuideFrameId } from '#vue/canvas/guides/input'
import { handlePenDragMove } from '#vue/canvas/pen/input'
import { handlePencilDragMove } from '#vue/canvas/pencil/input'
import type { createCanvasTransformInput } from '#vue/canvas/transform/input'
import { cancelRotationDrag, handleSelectionRotateMove } from '#vue/canvas/transform/rotation'
import { cancelNodeEditDrag, handleBendHandleMove } from '#vue/canvas/vector-input/input'
import { attachModifiers, handleConnectorDrawMove } from '#vue/shared/input/connector/draw'
import { handleDrawMove } from '#vue/shared/input/draw'
import { cancelMove, handleMoveMove } from '#vue/shared/input/move/drag'
import { applyResize } from '#vue/shared/input/resize'
import { applySelectionResize, cancelResizeDrag } from '#vue/shared/input/resize/selection'
import { applyScale } from '#vue/shared/input/scale'
import { applyStickyScale } from '#vue/shared/input/sticky/scale'
import type { DragState } from '#vue/shared/input/types'
import { handleNodeEditMarqueeMove, handleNodeEditMove } from '#vue/shared/input/vector'

type DragType = DragState['type']

/** Drags Escape abandons, leaving the document as it was before the press. */
export const ESCAPABLE_DRAGS: ReadonlySet<DragType> = new Set<DragType>([
  'draw',
  'gradient',
  'blur-ramp',
  'rotate',
  'rotate-selection',
  'connector-draw',
  'connector-end',
  'connector-line',
  'line-end',
  'scale'
])

/** Drags that move, resize, or rotate layers, while which layout chrome steps aside. */
export const TRANSFORMING_DRAGS: ReadonlySet<DragType> = new Set<DragType>([
  'move',
  'resize',
  'resize-selection',
  'scale',
  'rotate',
  'rotate-selection'
])

/**
 * Drags a change of selection, page, or document abandons: what they draw or turn belongs to the
 * layers they started on.
 */
export const SELECTION_BOUND_DRAGS: ReadonlySet<DragType> = new Set<DragType>([
  'draw',
  'sticky-draw',
  'rotate',
  'rotate-selection',
  'shape-handle',
  'sticky-scale',
  'scale'
])

/** What a drag in progress needs from the canvas input that owns it. */
export interface CanvasDragMoveContext {
  editor: Editor
  guideInput: ReturnType<typeof createGuideInput>
  transform: ReturnType<typeof createCanvasTransformInput>
  /** Whether Space is held, which moves the pen anchor whose handle is being dragged out. */
  spaceHeld: () => boolean
}

/** Moves a drag in progress to the pointer at `coords`, by its kind. */
// Dispatching the full drag union is intentionally centralized here.
// eslint-disable-next-line complexity
export function moveCanvasDrag(
  d: DragState,
  e: MouseEvent,
  coords: { sx: number; sy: number; cx: number; cy: number },
  { editor, guideInput, transform, spaceHeld }: CanvasDragMoveContext
): void {
  if (d.type === 'pan') {
    transform.handlePanMove(d, e)
    return
  }

  const { sx, sy, cx, cy } = coords

  if (d.type === 'gradient' || d.type === 'shape-handle') {
    d.update(sx, sy, e.shiftKey)
    return
  }

  if (d.type === 'blur-ramp') {
    d.update(sx, sy)
    return
  }

  if (d.type === 'guide') {
    const frameId = e.altKey && !d.guideId ? selectedTopLevelGuideFrameId(editor) : null
    guideInput.handleMove(
      d,
      sx,
      sy,
      cx,
      cy,
      frameId ? { frameId, deep: e.metaKey || e.ctrlKey } : undefined
    )
    return
  }

  if (d.type === 'rotate-selection') {
    handleSelectionRotateMove(editor, d, cx, cy, e.shiftKey)
    return
  }
  if (d.type === 'rotate') {
    transform.handleRotateMove(d, cx, cy, e.shiftKey)
    return
  }
  if (d.type === 'move') {
    handleMoveMove(d, cx, cy, sx, sy, editor, { ctrlKey: e.ctrlKey, shiftKey: e.shiftKey })
    return
  }
  if (d.type === 'text-select') {
    transform.handleTextSelectMove(cx, cy)
    return
  }
  if (d.type === 'resize') {
    applyResize(d, cx, cy, e.shiftKey, editor, e.ctrlKey)
    return
  }
  if (d.type === 'resize-selection') {
    applySelectionResize(d, cx, cy, e.shiftKey, editor, e.ctrlKey)
    return
  }

  if (d.type === 'pen-drag') {
    handlePenDragMove(d, cx, cy, spaceHeld(), e, editor)
    return
  }

  if (d.type === 'pencil-drag') {
    handlePencilDragMove(cx, cy, e.shiftKey, editor)
    return
  }

  if (d.type === 'edit-node' || d.type === 'edit-handle') {
    handleNodeEditMove(d, cx, cy, editor, e.altKey, e.metaKey || e.ctrlKey, e.shiftKey, e.ctrlKey)
    return
  }

  if (d.type === 'bend-handle') {
    handleBendHandleMove(d, cx, cy, e, editor)
    return
  }

  if (d.type === 'edit-marquee') {
    handleNodeEditMarqueeMove(d, cx, cy, editor)
    return
  }

  if (d.type === 'draw') {
    handleDrawMove(d, cx, cy, e.shiftKey)
    return
  }

  if (d.type === 'sticky-draw') {
    d.move(cx, cy)
    return
  }

  if (d.type === 'connector-draw') {
    handleConnectorDrawMove(d, cx, cy, sx, sy, editor, attachModifiers(e))
    return
  }

  if (d.type === 'connector-end') {
    editor.connectorEndpointDrag(cx, cy, attachModifiers(e))
    return
  }

  if (d.type === 'connector-line') {
    editor.connectorLineDrag(cx, cy)
    return
  }

  if (d.type === 'line-end') {
    editor.lineEndDrag(cx, cy, { shift: e.shiftKey, alt: e.altKey })
    return
  }

  if (d.type === 'sticky-scale') {
    applyStickyScale(d, cx, cy, editor, e.ctrlKey)
    return
  }

  if (d.type === 'scale') {
    applyScale(d, cx, cy, editor, { centred: e.altKey, disableSnapping: e.ctrlKey })
    return
  }

  transform.handleMarqueeMove(d, cx, cy)
}

/** Drops what a drag showed without changing the document. */
function discardDrawnPreview(d: DragState, editor: Editor) {
  if (d.type === 'resize' || d.type === 'resize-selection') cancelResizeDrag(d, editor)
  else if ('cancel' in d) d.cancel()
  else if (d.type === 'pencil-drag') editor.pencilCancel()
}

/** Takes back what a drag in progress has previewed, by its kind. */
export function discardCanvasDrag(d: DragState, editor: Editor): void {
  discardDrawnPreview(d, editor)
  if (d.type === 'move') cancelMove(d, editor)
  else if (d.type === 'rotate' || d.type === 'rotate-selection') cancelRotationDrag(editor, d)
  else cancelNodeEditDrag(d, editor)
}
