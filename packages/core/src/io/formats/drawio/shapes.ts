import { styleNumber, type DrawioStyle } from './style'

/** The control point offset that makes a cubic curve trace a quarter of an ellipse. */
const KAPPA = 0.5522847498

export type ShapeKind = 'rect' | 'ellipse' | 'path'

export interface ShapeGeometry {
  kind: ShapeKind
  /** SVG path data in the shape's own box, for `path` shapes. */
  path?: string
  /** Whether the path is only an outline, with nothing to fill. */
  outlineOnly?: boolean
  /** Lines stroked over the shape and never filled, such as a swimlane's body. */
  outline?: string
}

/** The height (or, for a vertical lane, the width) of a swimlane's title bar, as draw.io sets it. */
export function swimlaneHeader(style: DrawioStyle, w: number, h: number): number {
  const horizontal = style.horizontal !== '0'
  return Math.min(Math.max(styleNumber(style, 'startSize', 26), 0), horizontal ? h : w)
}

function n(value: number): string {
  return String(Math.round(value * 100) / 100)
}

function ellipsePath(cx: number, cy: number, rx: number, ry: number): string {
  const kx = rx * KAPPA
  const ky = ry * KAPPA
  return [
    `M${n(cx - rx)} ${n(cy)}`,
    `C${n(cx - rx)} ${n(cy - ky)} ${n(cx - kx)} ${n(cy - ry)} ${n(cx)} ${n(cy - ry)}`,
    `C${n(cx + kx)} ${n(cy - ry)} ${n(cx + rx)} ${n(cy - ky)} ${n(cx + rx)} ${n(cy)}`,
    `C${n(cx + rx)} ${n(cy + ky)} ${n(cx + kx)} ${n(cy + ry)} ${n(cx)} ${n(cy + ry)}`,
    `C${n(cx - kx)} ${n(cy + ry)} ${n(cx - rx)} ${n(cy + ky)} ${n(cx - rx)} ${n(cy)}Z`
  ].join('')
}

function cylinderPath(w: number, h: number, size: number): string {
  const ry = Math.min(Math.max(size, 0), h / 2)
  const rx = w / 2
  const kx = rx * KAPPA
  const ky = ry * KAPPA
  const body = [
    `M0 ${n(ry)}`,
    `C0 ${n(ry - ky)} ${n(rx - kx)} 0 ${n(rx)} 0`,
    `C${n(rx + kx)} 0 ${n(w)} ${n(ry - ky)} ${n(w)} ${n(ry)}`,
    `L${n(w)} ${n(h - ry)}`,
    `C${n(w)} ${n(h - ry + ky)} ${n(rx + kx)} ${n(h)} ${n(rx)} ${n(h)}`,
    `C${n(rx - kx)} ${n(h)} 0 ${n(h - ry + ky)} 0 ${n(h - ry)}Z`
  ].join('')
  const rim = [
    `M0 ${n(ry)}`,
    `C0 ${n(ry + ky)} ${n(rx - kx)} ${n(2 * ry)} ${n(rx)} ${n(2 * ry)}`,
    `C${n(rx + kx)} ${n(2 * ry)} ${n(w)} ${n(ry + ky)} ${n(w)} ${n(ry)}`
  ].join('')
  return body + rim
}

function notePath(w: number, h: number, size: number): string {
  const fold = Math.min(Math.max(size, 0), w, h)
  return (
    `M0 0L${n(w - fold)} 0L${n(w)} ${n(fold)}L${n(w)} ${n(h)}L0 ${n(h)}Z` +
    `M${n(w - fold)} 0L${n(w - fold)} ${n(fold)}L${n(w)} ${n(fold)}`
  )
}

function actorPath(w: number, h: number): string {
  const head = Math.min(w / 2, h * 0.16)
  const neck = head * 2
  const hip = h * 0.62
  return (
    ellipsePath(w / 2, head, head, head) +
    `M${n(w / 2)} ${n(neck)}L${n(w / 2)} ${n(hip)}` +
    `M0 ${n(h * 0.38)}L${n(w)} ${n(h * 0.38)}` +
    `M${n(w / 2)} ${n(hip)}L0 ${n(h)}M${n(w / 2)} ${n(hip)}L${n(w)} ${n(h)}`
  )
}

/** draw.io's cloud outline, scaled into a box of `w` by `h`. */
function cloudPath(w: number, h: number): string {
  const curves = [
    [0.05, 0.25, 0, 0.5, 0.16, 0.55],
    [0, 0.66, 0.18, 0.9, 0.31, 0.8],
    [0.4, 1, 0.7, 1, 0.8, 0.8],
    [1, 0.8, 1, 0.6, 0.875, 0.5],
    [1, 0.3, 0.8, 0.1, 0.625, 0.25],
    [0.5, 0.05, 0.3, 0.05, 0.25, 0.25]
  ]
  const point = (x: number, y: number) => `${n(x * w)} ${n(y * h)}`
  const segments = curves.map(
    ([a, b, c, d, e, f]) => `C${point(a, b)} ${point(c, d)} ${point(e, f)}`
  )
  return `M${point(0.25, 0.25)}${segments.join('')}Z`
}

type Point = readonly [number, number]

function polygonPath(points: readonly Point[]): string {
  return `${points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${n(x)} ${n(y)}`).join('')}Z`
}

/** A size draw.io gives as a fraction of the side, or in pixels when the style has `fixedSize`. */
function sizeAlong(style: DrawioStyle, side: number, fallback: number): number {
  const size = styleNumber(style, 'size', fallback)
  const px = style.fixedSize === '1' ? size : size * side
  return Math.min(Math.max(px, 0), side / 2)
}

function trianglePath(direction: string | undefined, w: number, h: number): string {
  if (direction === 'north')
    return polygonPath([
      [0, h],
      [w / 2, 0],
      [w, h]
    ])
  if (direction === 'south')
    return polygonPath([
      [0, 0],
      [w, 0],
      [w / 2, h]
    ])
  if (direction === 'west')
    return polygonPath([
      [w, 0],
      [w, h],
      [0, h / 2]
    ])
  return polygonPath([
    [0, 0],
    [w, h / 2],
    [0, h]
  ])
}

/** draw.io's document: a page whose bottom edge waves, `size` of the height deep. */
function documentPath(w: number, h: number, size: number): string {
  const dy = h * Math.min(Math.max(size, 0), 1)
  const base = h - dy / 2
  return (
    `M0 0L${n(w)} 0L${n(w)} ${n(base)}` +
    `Q${n((w * 3) / 4)} ${n(base - dy * 1.4)} ${n(w / 2)} ${n(base)}` +
    `Q${n(w / 4)} ${n(base + dy * 1.4)} 0 ${n(base)}Z`
  )
}

/** draw.io's swimlane: a filled title bar above (or beside) a lane only outlined. */
function swimlane(style: DrawioStyle, w: number, h: number): ShapeGeometry {
  const header = swimlaneHeader(style, w, h)
  if (style.horizontal === '0') {
    return {
      kind: 'path',
      path: polygonPath([
        [0, 0],
        [header, 0],
        [header, h],
        [0, h]
      ]),
      outline: `M${n(header)} 0L${n(w)} 0L${n(w)} ${n(h)}L${n(header)} ${n(h)}`
    }
  }
  return {
    kind: 'path',
    path: polygonPath([
      [0, 0],
      [w, 0],
      [w, header],
      [0, header]
    ]),
    outline: `M0 ${n(header)}L0 ${n(h)}L${n(w)} ${n(h)}L${n(w)} ${n(header)}`
  }
}

/** Outlines for draw.io's basic and flowchart shapes, as its own shape definitions draw them. */
const POLYGON_SHAPES: Partial<
  Record<string, (style: DrawioStyle, w: number, h: number) => string>
> = {
  hexagon: (style, w, h) => {
    const dx = sizeAlong(style, w, 0.25)
    return polygonPath([
      [dx, 0],
      [w - dx, 0],
      [w, h / 2],
      [w - dx, h],
      [dx, h],
      [0, h / 2]
    ])
  },
  parallelogram: (style, w, h) => {
    const dx = sizeAlong(style, w, 0.2)
    return polygonPath([
      [0, h],
      [dx, 0],
      [w, 0],
      [w - dx, h]
    ])
  },
  trapezoid: (style, w, h) => {
    const dx = sizeAlong(style, w, 0.2)
    return polygonPath([
      [0, h],
      [dx, 0],
      [w - dx, 0],
      [w, h]
    ])
  },
  step: (style, w, h) => {
    const dx = sizeAlong(style, w, 0.2)
    return polygonPath([
      [0, 0],
      [w - dx, 0],
      [w, h / 2],
      [w - dx, h],
      [0, h],
      [dx, h / 2]
    ])
  },
  card: (style, w, h) => {
    const corner = Math.min(Math.max(styleNumber(style, 'size', 15), 0), w, h)
    return polygonPath([
      [corner, 0],
      [w, 0],
      [w, h],
      [0, h],
      [0, corner]
    ])
  },
  process: (style, w, h) => {
    const dx = sizeAlong(style, w, 0.1)
    return (
      polygonPath([
        [0, 0],
        [w, 0],
        [w, h],
        [0, h]
      ]) + `M${n(dx)} 0L${n(dx)} ${n(h)}M${n(w - dx)} 0L${n(w - dx)} ${n(h)}`
    )
  },
  doubleEllipse: (_style, w, h) => {
    const inset = Math.min(w, h) * 0.1
    return (
      ellipsePath(w / 2, h / 2, w / 2, h / 2) +
      ellipsePath(w / 2, h / 2, w / 2 - inset, h / 2 - inset)
    )
  }
}

/** The outline a draw.io shape style asks for, drawn in a box of `w` by `h`. */
export function shapeGeometry(style: DrawioStyle, w: number, h: number): ShapeGeometry {
  const shape = style.shape
  if (style.swimlane !== undefined || shape === 'swimlane') return swimlane(style, w, h)
  if (style.triangle !== undefined || shape === 'triangle') {
    return { kind: 'path', path: trianglePath(style.direction, w, h) }
  }
  const polygon = shape ? POLYGON_SHAPES[shape] : undefined
  if (polygon) return { kind: 'path', path: polygon(style, w, h) }
  if (shape === 'cylinder3') {
    return { kind: 'path', path: cylinderPath(w, h, styleNumber(style, 'size', 15)) }
  }
  if (shape === 'document') {
    return { kind: 'path', path: documentPath(w, h, styleNumber(style, 'size', 0.3)) }
  }
  if (shape === 'note') {
    return { kind: 'path', path: notePath(w, h, styleNumber(style, 'size', 30)) }
  }
  if (shape === 'umlActor') {
    return { kind: 'path', path: actorPath(w, h), outlineOnly: true }
  }
  if (shape === 'cloud') return { kind: 'path', path: cloudPath(w, h) }
  if (style.ellipse !== undefined || shape === 'ellipse') {
    return { kind: 'ellipse' }
  }
  if (style.rhombus !== undefined || shape === 'rhombus') {
    const path = `M${n(w / 2)} 0L${n(w)} ${n(h / 2)}L${n(w / 2)} ${n(h)}L0 ${n(h / 2)}Z`
    return { kind: 'path', path }
  }
  // A shape without an outline here, such as a stencil, keeps its box and colours.
  return { kind: 'rect' }
}
