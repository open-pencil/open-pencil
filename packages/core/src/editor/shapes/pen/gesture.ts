import type { Vector } from '@open-pencil/scene-graph/primitives'

import { PEN_CLOSE_MIN_POINTS, PEN_CLOSE_THRESHOLD } from '#core/constants'
import type { EditorContext } from '#core/editor/types'
import type { CubicPoints } from '#core/vector/curve-math'

import type { PenHistory } from './history'

/**
 * What a press of the pen does: start a path, place a point, press the last point again to drag
 * its outgoing handle anew, or press the first point to close the path.
 */
export type PenPressKind = 'start' | 'point' | 'redo-handle' | 'close'

/** A press of the pen, before it acts. `at` is where it acts: the point it places, or the one it presses. */
export interface PenPressEvent {
  at: Vector
  kind: PenPressKind
}

/**
 * The release that ends a press, before it commits anything. `segment` is the one it finished,
 * the closing one for a close; a start or a handle drawn anew finishes none.
 */
export interface PenReleaseEvent extends PenPressEvent {
  segment: CubicPoints | null
}

/** Where the drag of a press starts, and the handle into the point it keeps, if any. */
export interface PenPress extends PenPressEvent {
  anchor: Vector
  incoming: Vector | null
}

interface PenGestureActions {
  penAddVertex: (x: number, y: number) => void
  penSetPendingClose: (pending: boolean) => void
  penSetClosingToFirst: (closing: boolean) => void
  penCommit: (closed: boolean) => void
}

const cubic = (p0: Vector, out: Vector, into: Vector, p3: Vector): CubicPoints => ({
  p0: { x: p0.x, y: p0.y },
  cp1: { x: p0.x + out.x, y: p0.y + out.y },
  cp2: { x: p3.x + into.x, y: p3.y + into.y },
  p3: { x: p3.x, y: p3.y }
})

/**
 * Presses and releases of the pen, as the canvas makes them, told to the host as `pen:pressed`
 * and `pen:released` so it can refuse one with `cancelGesture`: a refused press does nothing, and
 * a refused release takes its point or close back, leaving no undo step or redo.
 */
export function createPenGesture(
  ctx: EditorContext,
  history: PenHistory,
  actions: PenGestureActions
) {
  /** The press in progress, and whether the host refused it; listeners change it while it runs. */
  const press: { current: PenPressEvent | null; cancelled: boolean } = {
    current: null,
    cancelled: false
  }
  /** Whether the host refused the press, read after its event: a listener may have set it. */
  const refused = () => press.cancelled

  const near = (a: Vector, b: Vector) =>
    Math.hypot(a.x - b.x, a.y - b.y) < PEN_CLOSE_THRESHOLD / (ctx.state.zoom || 1)

  /** What a press at `at`, whose point snaps to `point`, does, and where. */
  function classify(at: Vector, point: Vector): PenPressEvent {
    const ps = ctx.state.penState
    if (!ps) return { at: point, kind: 'start' }
    const first = ps.vertices.at(0)
    if (first && ps.vertices.length >= PEN_CLOSE_MIN_POINTS && near(at, first)) {
      return { at: { x: first.x, y: first.y }, kind: 'close' }
    }
    // A press back on the last point drags its outgoing handle out again and keeps the one into
    // it, rather than stacking a point there (Figma).
    const last = ps.vertices.at(-1)
    if (last && near(at, last)) return { at: { x: last.x, y: last.y }, kind: 'redo-handle' }
    return { at: point, kind: 'point' }
  }

  /**
   * Presses the pen at `press`, its point snapped to `point`, and returns where the press's drag
   * starts; null when the host refused the press, which then did nothing.
   */
  function penPress(at: Vector, point: Vector = at): PenPress | null {
    // Each press, with its drag, is one undo step.
    history.begin()
    const event = classify(at, point)
    press.current = event
    press.cancelled = false
    ctx.emitEditorEvent('pen:pressed', { ...event, at: { ...event.at } })
    if (refused()) {
      press.current = null
      return null
    }
    const ps = ctx.state.penState
    if (event.kind === 'close') {
      actions.penSetPendingClose(true)
      actions.penSetClosingToFirst(true)
      return { ...event, anchor: event.at, incoming: null }
    }
    actions.penSetPendingClose(false)
    if (event.kind === 'redo-handle') {
      const incoming = ps?.segments.at(-1)?.tangentEnd ?? { x: 0, y: 0 }
      return { ...event, anchor: event.at, incoming: { ...incoming } }
    }
    actions.penAddVertex(event.at.x, event.at.y)
    return { ...event, anchor: event.at, incoming: null }
  }

  /** The segment the press finishes, as it stands at its release. */
  function finished(kind: PenPressKind): CubicPoints | null {
    const ps = ctx.state.penState
    if (!ps) return null
    if (kind === 'close') {
      const first = ps.vertices.at(0)
      const last = ps.vertices.at(-1)
      if (!first || !last) return null
      const drag = ps.dragTangent ?? { x: 0, y: 0 }
      return cubic(last, ps.closeTangent ?? { x: 0, y: 0 }, { x: -drag.x, y: -drag.y }, first)
    }
    if (kind !== 'point') return null
    const segment = ps.segments.at(-1)
    const from = segment && ps.vertices[segment.start]
    const to = segment && ps.vertices[segment.end]
    return segment && from && to ? cubic(from, segment.tangentStart, segment.tangentEnd, to) : null
  }

  /** Ends the press in progress: tells the host, then closes the path for a close it allowed. */
  function penRelease() {
    const event = press.current
    if (!event || press.cancelled) {
      press.current = null
      return
    }
    const ps = ctx.state.penState
    // A dragged point may have moved with Space held; the event reports where it is now.
    const at = event.kind === 'point' || event.kind === 'start' ? ps?.vertices.at(-1) : event.at
    try {
      ctx.emitEditorEvent('pen:released', {
        kind: event.kind,
        at: { x: at?.x ?? event.at.x, y: at?.y ?? event.at.y },
        segment: finished(event.kind)
      })
    } finally {
      press.current = null
    }
    if (refused()) return
    if (event.kind === 'close' && ctx.state.penState?.pendingClose) actions.penCommit(true)
  }

  /** Takes back the press in progress, if any; true when there was one. */
  function cancel(): boolean {
    if (!press.current) return false
    press.cancelled = true
    history.cancel()
    return true
  }

  return { penPress, penRelease, cancel }
}
