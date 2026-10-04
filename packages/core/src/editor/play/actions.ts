import { instanceSlotFrames, slotPropertyId, type SceneNode } from '@open-pencil/scene-graph'

import { numberSettings } from '#core/behaviours'
import type { EditorContext } from '#core/editor/types'

import { createPlaySession, playTarget, type PlayTarget } from './session'

/** The control being dragged in preview, such as a slider thumb. */
interface PlayDrag {
  target: PlayTarget
  valueId: string
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

  /** The document instance's slot frame bound to a part, for its position on the canvas. */
  function partFrame(target: PlayTarget, partId: string): SceneNode | undefined {
    const propertyId = target.behaviour.parts[partId]
    return propertyId
      ? instanceSlotFrames(ctx.graph, target.instance).find(
          (frame) => slotPropertyId(frame) === propertyId
        )
      : undefined
  }

  /** The slider value under a canvas x, from the track's position and the thumb's width. */
  function sliderValue(target: PlayTarget, valueId: string, cx: number): number | null {
    const settings = numberSettings(target.behaviour, valueId)
    const track = partFrame(target, 'track')
    const thumb = partFrame(target, 'thumb')
    if (!settings || !track) return null
    const start = ctx.graph.getAbsolutePosition(track.id).x + (thumb?.width ?? 0) / 2
    const length = Math.max(1, track.width - (thumb?.width ?? 0))
    const ratio = Math.min(1, Math.max(0, (cx - start) / length))
    return settings.min + ratio * (settings.max - settings.min)
  }

  /** Which item of the trigger slot the pointer is over, for tabs. */
  function triggerIndex(target: PlayTarget, hitId: string): number | null {
    const trigger = partFrame(target, 'trigger')
    if (!trigger) return null
    let current = ctx.graph.getNode(hitId)
    while (current?.parentId && current.parentId !== trigger.id)
      current = ctx.graph.getNode(current.parentId)
    return current?.parentId === trigger.id ? trigger.childIds.indexOf(current.id) : null
  }

  /**
   * Press at a canvas point: toggle a switch or checkbox, pick a tab, or start dragging a
   * slider. Returns whether a control took the press.
   */
  function playPointerDown(cx: number, cy: number): boolean {
    const session = ctx.state.play
    if (!session) return false
    const hit = ctx.graph.hitTestDeep(cx, cy, ctx.state.currentPageId)
    const target = hit ? playTarget(ctx.graph, hit.id) : null
    if (!hit || !target) return false
    const { kind } = target.behaviour
    if (kind === 'switch' || kind === 'checkbox') {
      session.setBoolean(target, 'value', !session.getBoolean(target, 'value'))
    } else if (kind === 'slider') {
      const value = sliderValue(target, 'value', cx)
      if (value !== null) session.setNumber(target, 'value', value)
      drag = { target, valueId: 'value' }
    } else {
      const index = triggerIndex(target, hit.id)
      if (index !== null) session.setChoice(target, 'value', index)
    }
    ctx.requestRepaint()
    return true
  }

  function playPointerMove(cx: number): void {
    const session = ctx.state.play
    if (!session || !drag) return
    const value = sliderValue(drag.target, drag.valueId, cx)
    if (value === null) return
    session.setNumber(drag.target, drag.valueId, value)
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
