import type { EditorContext } from '#core/editor/types'

/** A previewing canvas: its islands remount whenever the revision changes. */
export interface PlayState {
  revision: number
}

export function createPlayActions(ctx: EditorContext) {
  /** Preview this canvas: layers holding controls run as live components. */
  function startPlay(): void {
    if (ctx.state.play) return
    ctx.state.play = { revision: 0 }
    ctx.state.hoveredNodeId = null
    ctx.requestRepaint()
  }

  /** Go back to editing; the canvas draws every layer again. */
  function stopPlay(): void {
    if (!ctx.state.play) return
    ctx.state.play = null
    ctx.requestRepaint()
  }

  function togglePlay(): void {
    if (ctx.state.play) stopPlay()
    else startPlay()
  }

  /** Put every control back as designed by running the islands afresh. */
  function resetPlay(): void {
    if (ctx.state.play) ctx.state.play = { revision: ctx.state.play.revision + 1 }
  }

  // Another document's layers start from their designed state, not from the old islands'.
  ctx.onEditorEvent('graph:replaced', resetPlay)

  return { startPlay, stopPlay, togglePlay, resetPlay }
}
