import type { Vector } from '@open-pencil/scene-graph/primitives'

/** How long a cursor takes to glide to where its owner last moved it. */
export const CURSOR_GLIDE_MS = 180
/** How long the view takes to pan to where the followed person or agent went. */
export const FOLLOW_GLIDE_MS = 260

/** A move from one point to another that started at `start` and lasts `duration` ms. */
export interface Glide {
  from: Vector
  to: Vector
  start: number
  duration: number
}

/** Fast start, gentle stop, so a cursor catches up quickly and settles without overshooting. */
export function easeOutCubic(t: number): number {
  const clamped = Math.min(1, Math.max(0, t))
  return 1 - (1 - clamped) ** 3
}

/** Where a glide is at `now`, and whether it has arrived. */
export function glideAt(glide: Glide, now: number): { point: Vector; done: boolean } {
  const t = glide.duration > 0 ? (now - glide.start) / glide.duration : 1
  const k = easeOutCubic(t)
  return {
    point: {
      x: glide.from.x + (glide.to.x - glide.from.x) * k,
      y: glide.from.y + (glide.to.y - glide.from.y) * k
    },
    done: t >= 1
  }
}

/**
 * A glide to `to` that starts wherever the previous one is now, so frequent updates never make a
 * cursor jump back. Without a previous glide the point simply appears at `to`.
 */
export function retarget(
  previous: Glide | undefined,
  to: Vector,
  now: number,
  duration: number
): Glide {
  if (!previous) return { from: to, to, start: now, duration: 0 }
  if (previous.to.x === to.x && previous.to.y === to.y) return previous
  return { from: glideAt(previous, now).point, to, start: now, duration }
}
