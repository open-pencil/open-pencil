import type { ShapeWithTextType } from './kinds'

/** The height of a database's elliptical cap: FigJam keeps it 24 px tall at any size. */
export function databaseCap(w: number, h: number): number {
  return Math.min(24, h * 0.25, w * 0.25)
}

export interface LabelBox {
  x: number
  y: number
  width: number
  height: number
}

type Insets = readonly [left: number, top: number, right: number, bottom: number]

/** The 16 px FigJam leaves around a label, 8 px on a shape less than 100 px on a side. */
function labelPadding(width: number, height: number): number {
  return Math.min(width, height) < 100 ? 8 : 16
}

/** FigJam doubles some kinds' insets on a shape 300 px wide or more. */
function wide(width: number): boolean {
  return width >= 300
}

type InsetRule = (width: number, height: number, padding: number) => Insets

/** A triangle's label sits under its middle, 4 px in from its sides; returns its top and bottom. */
function triangleInsets(width: number, height: number): readonly [apex: number, base: number] {
  const lean = (4 * height) / width
  return [height / 2 + lean, 8 + lean]
}

/** The rectangle inscribed in an ellipse, its width rounded to a whole pixel. */
const ellipseInsets: InsetRule = (width, height) => {
  const label = Math.round(width / Math.SQRT2)
  const x = (width - label) / 2
  const y = (height - height * Math.sqrt(1 - (label / width) ** 2)) / 2
  return [x, y, x, y]
}

/**
 * The px FigJam leaves free on each side of a label in each kind, measured from its saved label
 * layouts. Insets that scale do so with the side they lie along.
 */
const LABEL_INSETS: Record<ShapeWithTextType, InsetRule> = {
  SQUARE: (_w, _h, p) => [p, p, p, p],
  ROUNDED_RECTANGLE: (w, _h, p) => {
    const inset = wide(w) ? p * 2 : p
    return [inset, inset, inset, inset]
  },
  ELLIPSE: ellipseInsets,
  SUMMING_JUNCTION: ellipseInsets,
  OR: ellipseInsets,
  DIAMOND: (w, h) => [w / 4 + 4, h / 4 + 4, w / 4 + 4, h / 4 + 4],
  TRIANGLE_UP: (w, h) => {
    const [apex, base] = triangleInsets(w, h)
    return [w / 4, apex, w / 4, base]
  },
  TRIANGLE_DOWN: (w, h) => {
    const [apex, base] = triangleInsets(w, h)
    return [w / 4, base, w / 4, apex]
  },
  PARALLELOGRAM_RIGHT: (w, _h, p) => [(13 * w) / 62 + 6, p, (13 * w) / 62 + 6, p],
  PARALLELOGRAM_LEFT: (w, _h, p) => [(13 * w) / 62 + 6, p, (13 * w) / 62 + 6, p],
  // Below the cap and its rim, above the bottom curve.
  ENG_DATABASE: (w, h, p) => [p, databaseCap(w, h) * 2 + p, p, databaseCap(w, h)],
  ENG_QUEUE: (_w, _h, p) => [24, p, 64, p],
  ENG_FILE: (_w, _h, p) => [p, 64, p, 64],
  ENG_FOLDER: (_w, _h, p) => [p, 60, p, p],
  TRAPEZOID: (w, _h, p) => [(16 * w) / 121, p, (16 * w) / 121, p],
  HEXAGON: (w, _h, p) => [(8 * w) / 121, p, (8 * w) / 121, p],
  PREDEFINED_PROCESS: (w) => (wide(w) ? [48, 24, 48, 24] : [32, 16, 32, 16]),
  INTERNAL_STORAGE: (w) => (wide(w) ? [40, 40, 24, 24] : [24, 24, 16, 16]),
  SHIELD: (_w, h, p) => [p, h * 0.075, p, h * 0.1977],
  DOCUMENT_SINGLE: (_w, _h, p) => [p, p, p, 28],
  DOCUMENT_MULTIPLE: (_w, _h, p) => [32, p, p, 28],
  MANUAL_INPUT: (_w, _h, p) => [p, 24, p, p],
  CHEVRON: (_w, _h, p) => [43, p, 43, p],
  PENTAGON: (w, h) => [w * 0.115, h * 0.27403, w * 0.115, h * 0.08454],
  OCTAGON: (w, h) => [w * 0.11466, h * 0.1193, w * 0.11466, h * 0.1193],
  STAR: (w, h) => [w * 0.19531, h * 0.3028, w * 0.19531, h * 0.109],
  PLUS: (_w, h, p) => [p, (h * 5) / 18, p, (h * 5) / 18],
  ARROW_LEFT: (_w, h, p) => [54, h * 0.25465, p, h * 0.25465],
  ARROW_RIGHT: (_w, h, p) => [p, h * 0.25465, 54, h * 0.25465],
  // Above the tail, an eighth of the shape and at most 32 px tall.
  SPEECH_BUBBLE: (w, h, p) => [p, p, p, p + Math.min(32, Math.min(w, h) / 8)]
}

/** Where a shape's label sits inside its `width` × `height` box. */
export function shapeWithTextLabelBox(
  type: ShapeWithTextType,
  width: number,
  height: number
): LabelBox {
  const [left, top, right, bottom] = LABEL_INSETS[type](width, height, labelPadding(width, height))
  const x = insetWithin(left, right, width)
  const y = insetWithin(top, bottom, height)
  return {
    x,
    y,
    width: Math.max(0, width - x - right),
    height: Math.max(0, height - y - bottom)
  }
}

/** The inset before a label, its share of `size` when both insets do not fit in it. */
function insetWithin(before: number, after: number, size: number): number {
  return before + after <= size ? before : (size * before) / (before + after)
}

/** Measures a label wrapped at `maxWidth`; its height is what the wrapped lines take. */
export type LabelMeasure = (maxWidth: number) => { width: number; height: number }

const LARGEST = 100_000

/** Whether a kind grows for its label; FigJam keeps summing junctions and ors round. */
export function shapeWithTextGrows(type: ShapeWithTextType): boolean {
  return type !== 'SUMMING_JUNCTION' && type !== 'OR'
}

/**
 * The height a `width`-wide shape of `type` takes for its label, as FigJam fits it: the height it
 * was given while the label fits its label box, else the smallest whole height whose label box
 * holds the label. FigJam never widens a shape for its label; a word too long for it breaks.
 */
export function fitShapeWithTextHeight(
  type: ShapeWithTextType,
  width: number,
  height: number,
  measure: LabelMeasure
): number {
  const fits = (h: number) => {
    const box = shapeWithTextLabelBox(type, width, h)
    return measure(box.width).height <= box.height
  }
  if (width <= 0 || height <= 0 || !shapeWithTextGrows(type) || fits(height)) return height
  let low = height
  let high = Math.max(height * 2, height + 16)
  while (!fits(high)) {
    low = high
    high *= 2
    if (high > LARGEST) return LARGEST
  }
  // The smallest whole height that fits, above a height that does not.
  low = Math.floor(low)
  while (high - low > 1) {
    const middle = Math.floor((low + high) / 2)
    if (fits(middle)) high = middle
    else low = middle
  }
  return Math.ceil(high)
}
