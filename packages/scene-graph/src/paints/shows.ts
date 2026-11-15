import type { Fill } from '../types'

/**
 * Whether a paint shows anything: visible, above 0% opacity, and not wholly transparent in its own
 * color or every gradient stop. Figma casts no shadow from a paint that does not, counts it in no
 * render bounds, and does not click through it to its layer (Figma desktop, live).
 */
export function paintShows(paint: Fill): boolean {
  if (!paint.visible || !(paint.opacity > 0)) return false
  if (paint.gradientStops) return paint.gradientStops.some((stop) => stop.color.a > 0)
  if (paint.type === 'SOLID') return paint.color.a > 0
  return true
}
