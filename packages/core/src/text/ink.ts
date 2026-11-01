import { geometryCommandCoordCount } from '@open-pencil/scene-graph/geometry'

import type { OutlineCommand } from '#core/text/font/glyphs'

/** Straight pieces a curve is followed in: a fraction of a pixel off at display sizes. */
const CURVE_STEPS = 24

/** Where a glyph's ink crosses a horizontal band: its leftmost and rightmost x there. */
export type InkSpan = [number, number]

/** Collects the x where outline edges run through the band `[top, bottom]`. */
class BandInk {
  private left = Infinity
  private right = -Infinity
  private x = 0
  private y = 0

  constructor(
    private readonly top: number,
    private readonly bottom: number
  ) {}

  moveTo(x: number, y: number): void {
    this.x = x
    this.y = y
  }

  lineTo(x: number, y: number): void {
    const { x: x0, y: y0, top, bottom } = this
    if (y0 >= top && y0 <= bottom) this.include(x0)
    if (y >= top && y <= bottom) this.include(x)
    for (const edge of [top, bottom]) {
      if ((y0 - edge) * (y - edge) < 0) this.include(x0 + ((edge - y0) / (y - y0)) * (x - x0))
    }
    this.x = x
    this.y = y
  }

  /** A quadratic is the cubic whose control points lie two thirds of the way to its own. */
  quadTo(x1: number, y1: number, x: number, y: number): void {
    const { x: x0, y: y0 } = this
    this.cubicTo(
      x0 + (2 / 3) * (x1 - x0),
      y0 + (2 / 3) * (y1 - y0),
      x + (2 / 3) * (x1 - x),
      y + (2 / 3) * (y1 - y),
      x,
      y
    )
  }

  cubicTo(x1: number, y1: number, x2: number, y2: number, x: number, y: number): void {
    const { x: x0, y: y0 } = this
    for (let step = 1; step <= CURVE_STEPS; step++) {
      const t = step / CURVE_STEPS
      const u = 1 - t
      const a = u * u * u
      const b = 3 * u * u * t
      const c = 3 * u * t * t
      const d = t * t * t
      this.lineTo(a * x0 + b * x1 + c * x2 + d * x, a * y0 + b * y1 + c * y2 + d * y)
    }
  }

  span(): InkSpan | null {
    return this.left <= this.right ? [this.left, this.right] : null
  }

  private include(x: number): void {
    this.left = Math.min(this.left, x)
    this.right = Math.max(this.right, x)
  }
}

/**
 * The ink of a font outline in the band, given in pixels below the baseline as HarfBuzz
 * draws it, for a glyph at `x`, `y`.
 */
export function outlineInk(
  commands: readonly OutlineCommand[],
  x: number,
  y: number,
  top: number,
  bottom: number
): InkSpan | null {
  const ink = new BandInk(top, bottom)
  let startX = 0
  let startY = 0
  for (const command of commands) {
    const px = x + (command.x ?? 0)
    const py = y + (command.y ?? 0)
    if (command.type === 'M') {
      ink.moveTo(px, py)
      startX = px
      startY = py
    } else if (command.type === 'L') ink.lineTo(px, py)
    else if (command.type === 'Q') ink.quadTo(x + (command.x1 ?? 0), y + (command.y1 ?? 0), px, py)
    else if (command.type === 'C') {
      ink.cubicTo(
        x + (command.x1 ?? 0),
        y + (command.y1 ?? 0),
        x + (command.x2 ?? 0),
        y + (command.y2 ?? 0),
        px,
        py
      )
    } else if (command.type === 'Z') ink.lineTo(startX, startY)
  }
  return ink.span()
}

/**
 * The ink of a saved glyph in the band: its outline is in ems with y up, drawn at `size` and
 * stretched by `scaleX` and `scaleY`.
 */
export function savedGlyphInk(
  blob: Uint8Array,
  glyph: { x: number; y: number; fontSize: number; scaleX?: number; scaleY?: number },
  top: number,
  bottom: number
): InkSpan | null {
  const ink = new BandInk(top, bottom)
  const view = new DataView(blob.buffer, blob.byteOffset, blob.byteLength)
  const sx = glyph.fontSize * (glyph.scaleX ?? 1)
  const sy = glyph.fontSize * (glyph.scaleY ?? 1)
  const points: number[] = []
  let startX = 0
  let startY = 0
  let offset = 0
  while (offset < blob.length) {
    const command = blob[offset++]
    const count = geometryCommandCoordCount(command)
    if (count === null || offset + count * 8 > blob.length) break
    points.length = 0
    for (let index = 0; index < count; index++) {
      points.push(glyph.x + view.getFloat32(offset, true) * sx)
      points.push(glyph.y - view.getFloat32(offset + 4, true) * sy)
      offset += 8
    }
    if (command === 0) ink.lineTo(startX, startY)
    else if (command === 1) {
      ink.moveTo(points[0], points[1])
      startX = points[0]
      startY = points[1]
    } else if (command === 2) ink.lineTo(points[0], points[1])
    else if (command === 3) ink.quadTo(points[0], points[1], points[2], points[3])
    else ink.cubicTo(points[0], points[1], points[2], points[3], points[4], points[5])
  }
  return ink.span()
}
