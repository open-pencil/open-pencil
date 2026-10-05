import type { EditorContext } from '#core/editor/types'

import { PLAY_INTERACTIONS, type PlayInteraction } from './kinds'
import { createPlaySession, playTarget, type PlayTarget } from './session'

/** The control being dragged in preview, such as a slider thumb. */
interface PlayDrag {
  target: PlayTarget
  interaction: PlayInteraction
}

export function createPlayActions(ctx: EditorContext) {
  let drag: PlayDrag | null = null

  function playing(): boolean {
    return ctx.state.play !== null
  }

  /** Start previewing this canvas: instances with a behaviour respond to the pointer. */
  function startPlay(): void {
    if (playing()) return
    ctx.state.play = createPlaySession(ctx.graph)
    ctx.state.hoveredNodeId = null
    ctx.requestRepaint()
  }

  /** Go back to editing; the canvas draws the document as it is. */
  function stopPlay(): void {
    if (!playing()) return
    drag = null
    ctx.state.play = null
    ctx.requestRepaint()
  }

  function togglePlay(): void {
    if (playing()) stopPlay()
    else startPlay()
  }

  /** Put every control back to its designed state. */
  function resetPlay(): void {
    ctx.state.play?.reset()
    ctx.requestRepaint()
  }

  /**
   * Press at a canvas point: the control under it answers as its kind does (a switch flips, a
   * tab is picked, a slider starts dragging). Returns whether a control took the press.
   */
  function playPointerDown(cx: number, cy: number): boolean {
    const session = ctx.state.play
    if (!session) return false
    const hit = ctx.graph.hitTestDeep(cx, cy, ctx.state.currentPageId)
    const target = hit ? playTarget(ctx.graph, hit.id) : null
    if (!hit || !target) return false
    const interaction = PLAY_INTERACTIONS[target.behaviour.kind]
    const pointer = {
      graph: ctx.graph,
      session,
      target,
      hitId: hit.id,
      x: cx,
      y: cy
    }
    if (interaction.press(pointer)) drag = { target, interaction }
    ctx.requestRepaint()
    return true
  }

  function playPointerMove(cx: number, cy: number): void {
    const session = ctx.state.play
    if (!session || !drag?.interaction.drag) return
    drag.interaction.drag({
      graph: ctx.graph,
      session,
      target: drag.target,
      x: cx,
      y: cy
    })
    ctx.requestRepaint()
  }

  function playPointerUp(): void {
    drag = null
  }

  /** Whether a control is under a canvas point, for the pointer cursor. */
  function playHitsControl(cx: number, cy: number): boolean {
    const hit = ctx.graph.hitTestDeep(cx, cy, ctx.state.currentPageId)
    return !!hit && !!playTarget(ctx.graph, hit.id)
  }

  return {
    startPlay,
    stopPlay,
    togglePlay,
    resetPlay,
    playPointerDown,
    playPointerMove,
    playPointerUp,
    playHitsControl
  }
}
