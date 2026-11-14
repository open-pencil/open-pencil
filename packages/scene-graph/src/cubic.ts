import type { Vector } from './primitives'

/** The point at `t` along the cubic from `p0` to `p3` with control points `p1` and `p2`. */
export function cubicPoint(p0: Vector, p1: Vector, p2: Vector, p3: Vector, t: number): Vector {
  const u = 1 - t
  const a = u * u * u
  const b = 3 * u * u * t
  const c = 3 * u * t * t
  const d = t * t * t
  return {
    x: a * p0.x + b * p1.x + c * p2.x + d * p3.x,
    y: a * p0.y + b * p1.y + c * p2.y + d * p3.y
  }
}

/**
 * Parameters in (0, 1) where a cubic is level on one axis. `p0` to `p3` are that axis.
 * The derivative is `at² + bt + c`, with `a = -p0 + 3p1 - 3p2 + p3`, `b = 2(p0 - 2p1 + p2)`,
 * and `c = -p0 + p1`.
 */
export function cubicExtrema(p0: number, p1: number, p2: number, p3: number): number[] {
  const a = -p0 + 3 * p1 - 3 * p2 + p3
  const b = 2 * (p0 - 2 * p1 + p2)
  const c = -p0 + p1
  const roots: number[] = []
  const epsilon = 1e-12

  if (Math.abs(a) < epsilon) {
    if (Math.abs(b) > epsilon) {
      const t = -c / b
      if (t > 0 && t < 1) roots.push(t)
    }
  } else {
    const discriminant = b * b - 4 * a * c
    if (discriminant >= 0) {
      const root = Math.sqrt(discriminant)
      const first = (-b + root) / (2 * a)
      const second = (-b - root) / (2 * a)
      if (first > 0 && first < 1) roots.push(first)
      if (second > 0 && second < 1 && Math.abs(second - first) > epsilon) roots.push(second)
    }
  }

  return roots
}
