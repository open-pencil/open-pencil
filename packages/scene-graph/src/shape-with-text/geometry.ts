import type { PolygonOutlineCommand } from '../polygon'
import { databaseCap } from './fit'
import type { ShapeWithTextType } from './kinds'

export interface ShapeWithTextGeometry {
  /** The closed outline that is filled and stroked, and that connectors attach to. */
  outline: PolygonOutlineCommand[]
  /** Inner lines that are stroked only, such as a database's front rim. */
  details: PolygonOutlineCommand[]
}

/** Bezier handle length for a quarter ellipse. */
const KAPPA = 0.5522847498

type Point = readonly [number, number]

function polygon(points: Point[]): PolygonOutlineCommand[] {
  const commands: PolygonOutlineCommand[] = points.map(([x, y], index) => ({
    type: index === 0 ? 'M' : 'L',
    x,
    y
  }))
  commands.push({ type: 'Z' })
  return commands
}

function line(from: Point, to: Point): PolygonOutlineCommand[] {
  return [
    { type: 'M', x: from[0], y: from[1] },
    { type: 'L', x: to[0], y: to[1] }
  ]
}

function curve(x1: number, y1: number, x2: number, y2: number, x: number, y: number) {
  return { type: 'C', x1, y1, x2, y2, x, y } as const
}

function ellipse(x: number, y: number, w: number, h: number): PolygonOutlineCommand[] {
  const rx = w / 2
  const ry = h / 2
  const cx = x + rx
  const cy = y + ry
  const kx = rx * KAPPA
  const ky = ry * KAPPA
  return [
    { type: 'M', x: cx, y },
    curve(cx + kx, y, x + w, cy - ky, x + w, cy),
    curve(x + w, cy + ky, cx + kx, y + h, cx, y + h),
    curve(cx - kx, y + h, x, cy + ky, x, cy),
    curve(x, cy - ky, cx - kx, y, cx, y),
    { type: 'Z' }
  ]
}

function roundedRect(w: number, h: number, radius: number): PolygonOutlineCommand[] {
  const r = Math.max(0, Math.min(radius, w / 2, h / 2))
  const k = r * (1 - KAPPA)
  return [
    { type: 'M', x: r, y: 0 },
    { type: 'L', x: w - r, y: 0 },
    curve(w - k, 0, w, k, w, r),
    { type: 'L', x: w, y: h - r },
    curve(w, h - k, w - k, h, w - r, h),
    { type: 'L', x: r, y: h },
    curve(k, h, 0, h - k, 0, h - r),
    { type: 'L', x: 0, y: r },
    curve(0, k, k, 0, r, 0),
    { type: 'Z' }
  ]
}

/** A page with a wavy bottom edge, the flowchart "document" symbol. */
function documentPage(x: number, y: number, w: number, h: number): PolygonOutlineCommand[] {
  const wave = h * 0.1
  const base = y + h - wave
  return [
    { type: 'M', x, y },
    { type: 'L', x: x + w, y },
    { type: 'L', x: x + w, y: base },
    curve(x + w * 0.8, base - wave * 1.2, x + w * 0.7, base - wave * 1.2, x + w * 0.5, base),
    curve(x + w * 0.3, base + wave, x + w * 0.2, base + wave, x, base),
    { type: 'Z' }
  ]
}

function star(w: number, h: number): Point[] {
  const points: Point[] = []
  for (let i = 0; i < 10; i++) {
    const angle = -Math.PI / 2 + (i * Math.PI) / 5
    const radius = i % 2 === 0 ? 1 : 0.382
    points.push([
      w / 2 + (Math.cos(angle) * radius * w) / 2,
      h / 2 + (Math.sin(angle) * radius * h) / 2 + h * 0.05
    ])
  }
  return points
}

/** A point on the ellipse filling the box, at `angle` radians clockwise from the right. */
function onEllipse(w: number, h: number, angle: number): Point {
  return [w / 2 + (Math.cos(angle) * w) / 2, h / 2 + (Math.sin(angle) * h) / 2]
}

/** A plain box with stroke-only inner lines. */
function boxWithLines(
  w: number,
  h: number,
  details: PolygonOutlineCommand[]
): ShapeWithTextGeometry {
  return {
    outline: polygon([
      [0, 0],
      [w, 0],
      [w, h],
      [0, h]
    ]),
    details
  }
}

/** A rounded box with a tail below its left side; the tail joins the bottom edge. */
function speechBubble(w: number, h: number): PolygonOutlineCommand[] {
  const body = h * 0.8
  const box = roundedRect(w, body, Math.min(w, body) * 0.2)
  // The fifth command draws the bottom edge leftwards; the tail goes just before it.
  const tail: PolygonOutlineCommand[] = [
    { type: 'L', x: w * 0.38, y: body },
    { type: 'L', x: w * 0.18, y: h },
    { type: 'L', x: w * 0.22, y: body }
  ]
  return [...box.slice(0, 5), ...tail, ...box.slice(5)]
}

const plain = (outline: PolygonOutlineCommand[]): ShapeWithTextGeometry => ({
  outline,
  details: []
})

type Builder = (w: number, h: number, min: number) => ShapeWithTextGeometry

/** How far a parallelogram's sides lean: FigJam leans them with the height, not the width. */
export function parallelogramSlant(w: number, h: number): number {
  return Math.min(h * 0.43, w * 0.45)
}

/** Each kind's outline and inner lines for a `w` × `h` box, `min` being its shorter side. */
const BUILDERS: Record<ShapeWithTextType, Builder> = {
  SQUARE: (w, h) =>
    plain(
      polygon([
        [0, 0],
        [w, 0],
        [w, h],
        [0, h]
      ])
    ),
  ELLIPSE: (w, h) => plain(ellipse(0, 0, w, h)),
  DIAMOND: (w, h) =>
    plain(
      polygon([
        [w / 2, 0],
        [w, h / 2],
        [w / 2, h],
        [0, h / 2]
      ])
    ),
  TRIANGLE_UP: (w, h) =>
    plain(
      polygon([
        [w / 2, 0],
        [w, h],
        [0, h]
      ])
    ),
  TRIANGLE_DOWN: (w, h) =>
    plain(
      polygon([
        [0, 0],
        [w, 0],
        [w / 2, h]
      ])
    ),
  // FigJam rounds the ends to 0.4 of the shorter side, as its saved outlines show.
  ROUNDED_RECTANGLE: (w, h, min) => plain(roundedRect(w, h, min * 0.4)),
  PARALLELOGRAM_RIGHT: (w, h) => {
    const s = parallelogramSlant(w, h)
    return plain(
      polygon([
        [s, 0],
        [w, 0],
        [w - s, h],
        [0, h]
      ])
    )
  },
  PARALLELOGRAM_LEFT: (w, h) => {
    const s = parallelogramSlant(w, h)
    return plain(
      polygon([
        [0, 0],
        [w - s, 0],
        [w, h],
        [s, h]
      ])
    )
  },
  ENG_DATABASE: (w, h) => {
    const ry = databaseCap(w, h)
    const kx = (w / 2) * KAPPA
    const ky = ry * KAPPA
    return {
      outline: [
        { type: 'M', x: 0, y: ry },
        curve(0, ry - ky, w / 2 - kx, 0, w / 2, 0),
        curve(w / 2 + kx, 0, w, ry - ky, w, ry),
        { type: 'L', x: w, y: h - ry },
        curve(w, h - ry + ky, w / 2 + kx, h, w / 2, h),
        curve(w / 2 - kx, h, 0, h - ry + ky, 0, h - ry),
        { type: 'Z' }
      ],
      details: [
        { type: 'M', x: 0, y: ry },
        curve(0, ry + ky, w / 2 - kx, ry * 2, w / 2, ry * 2),
        curve(w / 2 + kx, ry * 2, w, ry + ky, w, ry)
      ]
    }
  },
  ENG_QUEUE: (w, h) => {
    const rx = Math.min(w * 0.15, h * 0.25)
    const kx = rx * KAPPA
    const ky = (h / 2) * KAPPA
    return {
      outline: [
        { type: 'M', x: rx, y: 0 },
        { type: 'L', x: w - rx, y: 0 },
        curve(w - rx + kx, 0, w, h / 2 - ky, w, h / 2),
        curve(w, h / 2 + ky, w - rx + kx, h, w - rx, h),
        { type: 'L', x: rx, y: h },
        curve(rx - kx, h, 0, h / 2 + ky, 0, h / 2),
        curve(0, h / 2 - ky, rx - kx, 0, rx, 0),
        { type: 'Z' }
      ],
      details: [
        { type: 'M', x: w - rx, y: 0 },
        curve(w - rx - kx, 0, w - rx * 2, h / 2 - ky, w - rx * 2, h / 2),
        curve(w - rx * 2, h / 2 + ky, w - rx - kx, h, w - rx, h)
      ]
    }
  },
  ENG_FILE: (w, h, min) => {
    const f = min * 0.25
    return {
      outline: polygon([
        [0, 0],
        [w - f, 0],
        [w, f],
        [w, h],
        [0, h]
      ]),
      details: [...line([w - f, 0], [w - f, f]), { type: 'L', x: w, y: f }]
    }
  },
  ENG_FOLDER: (w, h) => {
    const tab = Math.min(h * 0.18, w * 0.2)
    return plain(
      polygon([
        [0, 0],
        [w * 0.4, 0],
        [w * 0.4 + tab, tab],
        [w, tab],
        [w, h],
        [0, h]
      ])
    )
  },
  TRAPEZOID: (w, h) => {
    const s = Math.min(w * 0.2, h)
    return plain(
      polygon([
        [s, 0],
        [w - s, 0],
        [w, h],
        [0, h]
      ])
    )
  },
  PREDEFINED_PROCESS: (w, h) => {
    const e = Math.min(w * 0.1, h * 0.5)
    return boxWithLines(w, h, [...line([e, 0], [e, h]), ...line([w - e, 0], [w - e, h])])
  },
  SHIELD: (w, h) =>
    plain([
      { type: 'M', x: 0, y: 0 },
      { type: 'L', x: w, y: 0 },
      { type: 'L', x: w, y: h * 0.45 },
      curve(w, h * 0.75, w * 0.75, h * 0.9, w / 2, h),
      curve(w * 0.25, h * 0.9, 0, h * 0.75, 0, h * 0.45),
      { type: 'Z' }
    ]),
  DOCUMENT_SINGLE: (w, h) => plain(documentPage(0, 0, w, h)),
  DOCUMENT_MULTIPLE: (w, h, min) => {
    const o = min * 0.06
    return {
      outline: documentPage(0, o * 2, w - o * 2, h - o * 2),
      details: [
        ...line([o, o * 2], [o, o]),
        { type: 'L', x: w - o, y: o },
        { type: 'L', x: w - o, y: h - o * 2 },
        ...line([o * 2, o], [o * 2, 0]),
        { type: 'L', x: w, y: 0 },
        { type: 'L', x: w, y: h - o * 3 }
      ]
    }
  },
  MANUAL_INPUT: (w, h) =>
    plain(
      polygon([
        [0, h * 0.25],
        [w, 0],
        [w, h],
        [0, h]
      ])
    ),
  HEXAGON: (w, h) => {
    const s = Math.min(w * 0.25, h * 0.5)
    return plain(
      polygon([
        [s, 0],
        [w - s, 0],
        [w, h / 2],
        [w - s, h],
        [s, h],
        [0, h / 2]
      ])
    )
  },
  CHEVRON: (w, h) => {
    const p = Math.min(w * 0.25, h * 0.5)
    return plain(
      polygon([
        [0, 0],
        [w - p, 0],
        [w, h / 2],
        [w - p, h],
        [0, h],
        [p, h / 2]
      ])
    )
  },
  PENTAGON: (w, h) =>
    plain(
      polygon([
        [w / 2, 0],
        [w, h * 0.38],
        [w * 0.81, h],
        [w * 0.19, h],
        [0, h * 0.38]
      ])
    ),
  OCTAGON: (w, h, min) => {
    const c = min * 0.29
    return plain(
      polygon([
        [c, 0],
        [w - c, 0],
        [w, c],
        [w, h - c],
        [w - c, h],
        [c, h],
        [0, h - c],
        [0, c]
      ])
    )
  },
  STAR: (w, h) => plain(polygon(star(w, h))),
  PLUS: (w, h) => {
    const a = w / 3
    const b = h / 3
    return plain(
      polygon([
        [a, 0],
        [a * 2, 0],
        [a * 2, b],
        [w, b],
        [w, b * 2],
        [a * 2, b * 2],
        [a * 2, h],
        [a, h],
        [a, b * 2],
        [0, b * 2],
        [0, b],
        [a, b]
      ])
    )
  },
  ARROW_RIGHT: (w, h) => {
    const head = Math.min(w * 0.4, h * 0.5)
    return plain(
      polygon([
        [0, h * 0.25],
        [w - head, h * 0.25],
        [w - head, 0],
        [w, h / 2],
        [w - head, h],
        [w - head, h * 0.75],
        [0, h * 0.75]
      ])
    )
  },
  ARROW_LEFT: (w, h) => {
    const head = Math.min(w * 0.4, h * 0.5)
    return plain(
      polygon([
        [w, h * 0.25],
        [head, h * 0.25],
        [head, 0],
        [0, h / 2],
        [head, h],
        [head, h * 0.75],
        [w, h * 0.75]
      ])
    )
  },
  SUMMING_JUNCTION: (w, h) => {
    const q = Math.PI / 4
    return {
      outline: ellipse(0, 0, w, h),
      details: [
        ...line(onEllipse(w, h, -q), onEllipse(w, h, Math.PI - q)),
        ...line(onEllipse(w, h, q), onEllipse(w, h, Math.PI + q))
      ]
    }
  },
  OR: (w, h) => ({
    outline: ellipse(0, 0, w, h),
    details: [...line([w / 2, 0], [w / 2, h]), ...line([0, h / 2], [w, h / 2])]
  }),
  SPEECH_BUBBLE: (w, h) => plain(speechBubble(w, h)),
  INTERNAL_STORAGE: (w, h, min) => {
    const e = min * 0.15
    return boxWithLines(w, h, [...line([e, 0], [e, h]), ...line([0, e], [w, e])])
  }
}

/**
 * The outline with each straight corner rounded to `radius` (FigJam rounds them all to its corner
 * radius), shortened where an edge is too short for it. Outlines with curves keep their shape.
 */
function roundCorners(commands: PolygonOutlineCommand[], radius: number): PolygonOutlineCommand[] {
  if (radius <= 0 || commands.some((command) => command.type === 'C')) return commands
  const points: Point[] = []
  for (const command of commands) if (command.type !== 'Z') points.push([command.x, command.y])
  if (points.length < 3) return commands
  const rounded: PolygonOutlineCommand[] = []
  points.forEach((vertex, index) => {
    const before = points[(index + points.length - 1) % points.length]
    const after = points[(index + 1) % points.length]
    const toward = (to: Point): Point => {
      const length = Math.hypot(to[0] - vertex[0], to[1] - vertex[1])
      const t = length > 0 ? Math.min(radius, length / 2) / length : 0
      return [vertex[0] + (to[0] - vertex[0]) * t, vertex[1] + (to[1] - vertex[1]) * t]
    }
    const [inX, inY] = toward(before)
    const [outX, outY] = toward(after)
    rounded.push({ type: index === 0 ? 'M' : 'L', x: inX, y: inY })
    rounded.push(
      curve(
        inX + (vertex[0] - inX) * KAPPA,
        inY + (vertex[1] - inY) * KAPPA,
        outX + (vertex[0] - outX) * KAPPA,
        outY + (vertex[1] - outY) * KAPPA,
        outX,
        outY
      )
    )
  })
  rounded.push({ type: 'Z' })
  return rounded
}

/**
 * The outline and inner lines of a shape of `type` filling a `width` × `height` box. Outlines
 * made only of straight segments have their corners rounded to `cornerRadius`; outlines with
 * curves, such as a rounded rectangle, keep their own shape.
 */
export function shapeWithTextGeometry(
  type: ShapeWithTextType,
  width: number,
  height: number,
  cornerRadius = 0
): ShapeWithTextGeometry {
  const w = Math.max(0, width)
  const h = Math.max(0, height)
  const geometry = BUILDERS[type](w, h, Math.min(w, h))
  return { ...geometry, outline: roundCorners(geometry.outline, cornerRadius) }
}
