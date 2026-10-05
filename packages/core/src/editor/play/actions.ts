import type { InteractionState } from '@open-pencil/scene-graph'

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
  /** Instance ids of the control under the pointer, pressed, and with keyboard focus. */
  let hovered: string | null = null
  let pressed: string | null = null
  let focused: string | null = null
  /** Whether focus came from the keyboard, which is when a control shows its focus state. */
  let focusVisible = false

  function playing(): boolean {
    return ctx.state.play !== null
  }

  function forget(): void {
    drag = null
    hovered = null
    pressed = null
    focused = null
    focusVisible = false
  }

  /** Start previewing this canvas: instances with a behaviour respond to the pointer. */
  function startPlay(): void {
    if (playing()) return
    forget()
    ctx.state.play = createPlaySession(ctx.graph)
    ctx.state.hoveredNodeId = null
    ctx.requestRepaint()
  }

  /** Go back to editing; the canvas draws the document as it is. */
  function stopPlay(): void {
    if (!playing()) return
    forget()
    ctx.state.play = null
    ctx.requestRepaint()
  }

  function togglePlay(): void {
    if (playing()) stopPlay()
    else startPlay()
  }

  /** Put every control back to its designed state. */
  function resetPlay(): void {
    forget()
    ctx.state.play?.reset()
    ctx.requestRepaint()
  }

  function stateOf(target: PlayTarget): InteractionState {
    const id = target.instance.id
    if (ctx.state.play?.isDisabled(target)) return 'disabled'
    // Like :active, a control stays pressed while the pointer is held, even off it.
    if (pressed === id) return 'pressed'
    if (hovered === id) return 'hover'
    if (focused === id && focusVisible) return 'focus'
    return 'rest'
  }

  /** Show a control's interaction state, and its preview values again if its copy was rebuilt. */
  function refresh(instanceId: string | null): void {
    const session = ctx.state.play
    const target = instanceId ? playTarget(ctx.graph, instanceId) : null
    if (!session || !target) return
    if (session.setInteraction(target, stateOf(target)))
      PLAY_INTERACTIONS[target.behaviour.kind].restore?.({ graph: ctx.graph, session, target })
  }

  /** Move hover, pressed, or focus from one control to another, redrawing both. */
  function move(previous: string | null, next: string | null, assign: () => void): void {
    assign()
    if (previous === next) {
      refresh(next)
      return
    }
    refresh(previous)
    refresh(next)
  }

  /** The enabled control under a canvas point. */
  function controlAt(cx: number, cy: number): { target: PlayTarget; hitId: string } | null {
    const hit = ctx.graph.hitTestDeep(cx, cy, ctx.state.currentPageId)
    const target = hit ? playTarget(ctx.graph, hit.id) : null
    if (!hit || !target || ctx.state.play?.isDisabled(target)) return null
    return { target, hitId: hit.id }
  }

  /**
   * Press at a canvas point: the control under it shows its pressed state and answers as its
   * kind does (a switch flips, a tab is picked, a slider starts dragging). Returns whether a
   * control took the press.
   */
  function playPointerDown(cx: number, cy: number): boolean {
    const session = ctx.state.play
    const control = controlAt(cx, cy)
    if (!session || !control) {
      if (focused) move(focused, null, () => (focused = null))
      ctx.requestRepaint()
      return false
    }
    const { target, hitId } = control
    const id = target.instance.id
    const interaction = PLAY_INTERACTIONS[target.behaviour.kind]
    const previousFocus = focused
    focusVisible = interaction.focusOnPress === true
    move(previousFocus, id, () => {
      focused = id
      hovered = id
      pressed = id
    })
    const pointer = { graph: ctx.graph, session, target, hitId, x: cx, y: cy }
    if (interaction.press?.(pointer)) drag = { target, interaction }
    ctx.requestRepaint()
    return true
  }

  /**
   * Move the pointer: drag the pressed control, if it drags, and hover the control under the
   * pointer. Returns whether an enabled control is under it, for the pointer cursor.
   */
  function playPointerMove(cx: number, cy: number): boolean {
    const session = ctx.state.play
    if (!session) return false
    if (drag?.interaction.drag)
      drag.interaction.drag({ graph: ctx.graph, session, target: drag.target, x: cx, y: cy })
    const next = controlAt(cx, cy)?.target.instance.id ?? null
    if (next !== hovered) move(hovered, next, () => (hovered = next))
    ctx.requestRepaint()
    return next !== null
  }

  function playPointerUp(): void {
    drag = null
    const released = pressed
    pressed = null
    refresh(released)
    ctx.requestRepaint()
  }

  /** The pointer left the canvas: nothing is hovered. */
  function playPointerLeave(): void {
    if (!hovered) return
    move(hovered, null, () => (hovered = null))
    ctx.requestRepaint()
  }

  /** Enabled controls on the page, top to bottom and left to right, as Tab visits them. */
  function focusOrder(): PlayTarget[] {
    const session = ctx.state.play
    const targets: PlayTarget[] = []
    const visit = (id: string) => {
      const node = ctx.graph.getNode(id)
      if (!node?.visible) return
      if (node.type === 'INSTANCE') {
        const target = playTarget(ctx.graph, id)
        if (target?.instance.id === id && !session?.isDisabled(target)) targets.push(target)
      }
      for (const child of node.childIds) visit(child)
    }
    visit(ctx.state.currentPageId)
    const position = (target: PlayTarget) => ctx.graph.getAbsolutePosition(target.instance.id)
    return targets.sort((a, b) => position(a).y - position(b).y || position(a).x - position(b).x)
  }

  /** Tab to the next control, or the previous one with Shift; returns whether there is one. */
  function focusNext(backwards: boolean): boolean {
    const order = focusOrder()
    if (order.length === 0) return false
    const index = order.findIndex((target) => target.instance.id === focused)
    const step = backwards ? -1 : 1
    const first = backwards ? order.length - 1 : 0
    const next = index === -1 ? first : (index + step + order.length) % order.length
    focusVisible = true
    move(focused, order[next].instance.id, () => (focused = order[next].instance.id))
    return true
  }

  /**
   * A key pressed while previewing: Tab moves keyboard focus between controls, and the focused
   * control uses keys as its kind does: Space and Enter, arrows, Home and End, or typing in a
   * text field. Returns whether the key was used, so an unused Space can still pan the canvas.
   */
  function playKey(key: string, shift = false): boolean {
    const session = ctx.state.play
    if (!session) return false
    let used = false
    if (key === 'Tab') used = focusNext(shift)
    else if (focused) {
      const target = playTarget(ctx.graph, focused)
      used =
        !!target &&
        !session.isDisabled(target) &&
        !!PLAY_INTERACTIONS[target.behaviour.kind].key?.({
          graph: ctx.graph,
          session,
          target,
          key,
          shift
        })
    }
    if (used) ctx.requestRepaint()
    return used
  }

  /**
   * Take visible keyboard focus off the focused control, for Escape; returns whether a control
   * showed focus. Focus from a click is never shown, so Escape then leaves preview at once.
   */
  function playBlur(): boolean {
    if (!focused || !focusVisible) return false
    move(focused, null, () => (focused = null))
    ctx.requestRepaint()
    return true
  }

  return {
    startPlay,
    stopPlay,
    togglePlay,
    resetPlay,
    playPointerDown,
    playPointerMove,
    playPointerUp,
    playPointerLeave,
    playKey,
    playBlur
  }
}
