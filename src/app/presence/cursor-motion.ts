import type { PresenceCursor } from '@open-pencil/core/canvas'
import type { Vector } from '@open-pencil/scene-graph/primitives'

import type { EditorStore } from '@/app/editor/active-store'
import { animationsEnabled } from '@/app/shell/motion'

import { CURSOR_GLIDE_MS, FOLLOW_GLIDE_MS, glideAt, retarget, type Glide } from './motion'

/** A cursor with the identity it keeps between updates, so it can glide rather than jump. */
export type TrackedCursor = PresenceCursor & { id: string }

interface ViewGlide {
  center: Glide
  fromZoom: number
  toZoom: number
  /** Applies one step; the registry marks it as following's own viewport change. */
  move: (x: number, y: number, zoom: number) => void
}

interface Motion {
  targets: TrackedCursor[]
  glides: Map<string, Glide>
  view: ViewGlide | null
  frame: number | null
}

const motions = new WeakMap<EditorStore, Motion>()

function motionOf(store: EditorStore): Motion {
  let motion = motions.get(store)
  if (!motion) {
    motion = { targets: [], glides: new Map(), view: null, frame: null }
    motions.set(store, motion)
  }
  return motion
}

function canAnimate(): boolean {
  return animationsEnabled.value && typeof requestAnimationFrame === 'function'
}

function schedule(store: EditorStore, motion: Motion): void {
  if (motion.frame !== null) return
  motion.frame = requestAnimationFrame(() => {
    motion.frame = null
    step(store, motion, performance.now())
  })
}

/** Draws every cursor where its glide is now, moves a following view, and asks for the next frame. */
function step(store: EditorStore, motion: Motion, now: number): void {
  let moving = false
  store.state.presenceCursors = motion.targets.map((cursor) => {
    const glide = motion.glides.get(cursor.id)
    if (!glide) return cursor
    const { point, done } = glideAt(glide, now)
    if (!done) moving = true
    return { ...cursor, x: point.x, y: point.y }
  })
  store.requestRepaint()
  const view = motion.view
  if (view) {
    const { point, done } = glideAt(view.center, now)
    const t = done ? 1 : (now - view.center.start) / view.center.duration
    // Zoom changes by ratio, so it eases evenly whether it doubles or halves.
    const zoom = view.fromZoom * (view.toZoom / view.fromZoom) ** Math.min(1, Math.max(0, t))
    view.move(point.x, point.y, zoom)
    if (done) motion.view = null
    else moving = true
  }
  if (moving) schedule(store, motion)
}

/**
 * Show people's and agents' cursors at `targets`. Each one glides from where it is drawn now;
 * a new one appears in place. With animations off, they move at once.
 */
export function showCursors(store: EditorStore, targets: TrackedCursor[]): void {
  const motion = motionOf(store)
  const now = performance.now()
  const animate = canAnimate()
  const ids = new Set(targets.map((cursor) => cursor.id))
  for (const id of motion.glides.keys()) if (!ids.has(id)) motion.glides.delete(id)
  for (const cursor of targets) {
    const to = { x: cursor.x, y: cursor.y }
    const previous = animate ? motion.glides.get(cursor.id) : undefined
    motion.glides.set(cursor.id, retarget(previous, to, now, CURSOR_GLIDE_MS))
  }
  motion.targets = targets
  step(store, motion, now)
}

/** The world point at the center of the view. */
function viewCenter(store: EditorStore): Vector {
  const screen = store.viewportCanvasCenter()
  return {
    x: (screen.x - store.state.panX) / store.state.zoom,
    y: (screen.y - store.state.panY) / store.state.zoom
  }
}

/**
 * Pan the view so `point` is centered, at `zoom`, gliding there from where it looks now. `move`
 * applies each step. With animations off, the view moves at once.
 */
export function glideViewTo(
  store: EditorStore,
  point: Vector,
  zoom: number,
  move: (x: number, y: number, zoom: number) => void
): void {
  const motion = motionOf(store)
  if (!canAnimate()) {
    motion.view = null
    move(point.x, point.y, zoom)
    return
  }
  const now = performance.now()
  const current = motion.view
    ? { center: glideAt(motion.view.center, now).point, zoom: store.state.zoom }
    : { center: viewCenter(store), zoom: store.state.zoom }
  if (current.center.x === point.x && current.center.y === point.y && current.zoom === zoom) return
  motion.view = {
    center: { from: current.center, to: point, start: now, duration: FOLLOW_GLIDE_MS },
    fromZoom: current.zoom,
    toZoom: zoom,
    move
  }
  schedule(store, motion)
}

/** Stop a view glide in place, as when following ends. */
export function stopViewGlide(store: EditorStore): void {
  motionOf(store).view = null
}
