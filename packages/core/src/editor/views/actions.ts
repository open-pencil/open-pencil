import type { EditorContext } from '#core/editor/types'

import { EDIT_VIEW, resolveEditorProfile } from './profile'
import type { CanvasView } from './types'

export function createCanvasViewActions(ctx: EditorContext) {
  function setCanvasView(view: CanvasView): void {
    ctx.state.canvasView = view
    ctx.requestRepaint()
  }

  /** Leaves the canvas's view for the one it returns to; false when there is none to leave. */
  function leaveCanvasView(): boolean {
    const target = resolveEditorProfile(ctx.state).leaveTo
    if (!target) return false
    setCanvasView(target)
    return true
  }

  /** Preview this canvas: layers holding controls run as live components. */
  function startPlay(): void {
    if (ctx.state.canvasView.id === 'play') return
    ctx.state.hoveredNodeId = null
    setCanvasView({ id: 'play', revision: 0 })
  }

  /** Go back to editing; the canvas draws every layer again. */
  function stopPlay(): void {
    if (ctx.state.canvasView.id === 'play') setCanvasView(EDIT_VIEW)
  }

  function togglePlay(): void {
    if (ctx.state.canvasView.id === 'play') stopPlay()
    else startPlay()
  }

  /** Put every control back as designed by running the islands afresh. */
  function resetPlay(): void {
    const view = ctx.state.canvasView
    if (view.id === 'play') ctx.state.canvasView = { id: 'play', revision: view.revision + 1 }
  }

  // Another document's layers start from their designed state, not from the old islands'.
  ctx.onEditorEvent('graph:replaced', resetPlay)

  return { leaveCanvasView, startPlay, stopPlay, togglePlay, resetPlay }
}
