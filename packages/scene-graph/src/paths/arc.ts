import { sweepsWholeTurn } from '../geometry'
import type { SceneNode } from '../types'

const FULL_TURN = Math.PI * 2

/** A sweep around the ellipse's centre, from `start` by `sweep` radians, negative to turn back. */
export interface ArcSweep {
  type: 'arc'
  rx: number
  ry: number
  start: number
  sweep: number
}

/** A step to the ellipse's centre, as a pie slice's sides run. */
export interface ArcCentre {
  type: 'centre'
}

export type ArcStep = ArcSweep | ArcCentre

/**
 * An ellipse or arc as the canvas, SVG export and hit testing draw it: contours of sweeps around
 * its centre, each closed. A whole turn is one sweep, and with a hole a second sweep wound back,
 * so a nonzero fill leaves the hole empty; a part ring is one contour whose ends run straight
 * across the ring; a pie slice runs its sweep, then to the centre.
 */
export interface ArcOutline {
  cx: number
  cy: number
  contours: ArcStep[][]
}

const WHOLE_ELLIPSE = { startingAngle: 0, endingAngle: FULL_TURN, innerRadius: 0 }

export function arcOutline(node: Pick<SceneNode, 'width' | 'height' | 'arcData'>): ArcOutline {
  const { startingAngle: start, endingAngle: end, innerRadius } = node.arcData ?? WHOLE_ELLIPSE
  const rx = node.width / 2
  const ry = node.height / 2
  const whole = sweepsWholeTurn(start, end)
  const sweep = whole ? FULL_TURN : end - start
  const outer: ArcSweep = { type: 'arc', rx, ry, start, sweep }
  if (innerRadius > 0) {
    const hole: ArcSweep = {
      type: 'arc',
      rx: rx * innerRadius,
      ry: ry * innerRadius,
      start: start + sweep,
      sweep: -sweep
    }
    return { cx: rx, cy: ry, contours: whole ? [[outer], [hole]] : [[outer, hole]] }
  }
  return { cx: rx, cy: ry, contours: [whole ? [outer] : [outer, { type: 'centre' }]] }
}

/** Whether a sweep goes all the way round, drawn as a whole ellipse rather than an arc. */
export function sweepsWholeEllipse(step: ArcSweep): boolean {
  return Math.abs(step.sweep) >= FULL_TURN
}
