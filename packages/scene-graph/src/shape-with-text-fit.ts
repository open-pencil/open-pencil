import type { ShapeWithTextType } from './shape-with-text'

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

/** Fractions of the box, left/top/right/bottom, left free around the label so it stays inside the shape. */
const LABEL_INSET: Partial<Record<ShapeWithTextType, readonly [number, number, number, number]>> = {
  ELLIPSE: [0.15, 0.15, 0.15, 0.15],
  SUMMING_JUNCTION: [0.15, 0.15, 0.15, 0.15],
  OR: [0.15, 0.15, 0.15, 0.15],
  TRIANGLE_UP: [0.25, 0.45, 0.25, 0.05],
  TRIANGLE_DOWN: [0.25, 0.05, 0.25, 0.45],
  TRAPEZOID: [0.2, 0, 0.2, 0],
  ENG_QUEUE: [0.15, 0, 0.3, 0],
  ENG_FOLDER: [0, 0.18, 0, 0],
  PREDEFINED_PROCESS: [0.1, 0, 0.1, 0],
  SHIELD: [0.1, 0, 0.1, 0.25],
  DOCUMENT_SINGLE: [0, 0, 0, 0.15],
  DOCUMENT_MULTIPLE: [0, 0.12, 0.12, 0.15],
  MANUAL_INPUT: [0, 0.25, 0, 0],
  HEXAGON: [0.2, 0, 0.2, 0],
  CHEVRON: [0.25, 0, 0.25, 0],
  PENTAGON: [0.15, 0.3, 0.15, 0],
  OCTAGON: [0.1, 0.1, 0.1, 0.1],
  STAR: [0.3, 0.35, 0.3, 0.25],
  PLUS: [0.33, 0.33, 0.33, 0.33],
  ARROW_LEFT: [0.3, 0.25, 0, 0.25],
  ARROW_RIGHT: [0, 0.25, 0.3, 0.25],
  SPEECH_BUBBLE: [0, 0, 0, 0.2],
  INTERNAL_STORAGE: [0.15, 0.15, 0, 0]
}

/** Padding FigJam leaves around a label, 16 px, less on small shapes. */
function labelPadding(size: number): number {
  return Math.min(16, size * 0.1)
}

/** Left, top, right and bottom insets of the label, in px, for kinds FigJam was measured on. */
function measuredInsets(
  type: ShapeWithTextType,
  width: number,
  height: number
): readonly [number, number, number, number] | null {
  const padX = labelPadding(width)
  const padY = labelPadding(height)
  switch (type) {
    case 'SQUARE':
    case 'ROUNDED_RECTANGLE':
      return [padX, padY, padX, padY]
    case 'DIAMOND': {
      // The middle half, 4 px in from it.
      const x = width * 0.25 + Math.min(4, width * 0.02)
      const y = height * 0.25 + Math.min(4, height * 0.02)
      return [x, y, x, y]
    }
    case 'PARALLELOGRAM_RIGHT':
    case 'PARALLELOGRAM_LEFT': {
      const x = Math.min(height * 0.35 + padX, width * 0.4)
      return [x, padY, x, padY]
    }
    case 'ENG_DATABASE': {
      // Below the cap and its rim, above the bottom curve.
      const cap = databaseCap(width, height)
      return [padX, cap * 2 + padY, padX, cap]
    }
    default:
      return null
  }
}

/** Where a shape's label sits inside its `width` × `height` box. */
export function shapeWithTextLabelBox(
  type: ShapeWithTextType,
  width: number,
  height: number
): LabelBox {
  const measured = measuredInsets(type, width, height)
  const [left, top, right, bottom] =
    measured ??
    (LABEL_INSET[type] ?? [0, 0, 0, 0]).map((free, side) => {
      const size = side % 2 === 0 ? width : height
      return size * free + labelPadding(size)
    })
  const x = Math.min(left, width / 2)
  const y = Math.min(top, height / 2)
  return {
    x,
    y,
    width: Math.max(0, width - x - right),
    height: Math.max(0, height - y - bottom)
  }
}

/** Kinds whose label area shrinks towards their corners; they grow in both directions to stay in shape. */
const GROWS_IN_PROPORTION = new Set<ShapeWithTextType>([
  'ELLIPSE',
  'DIAMOND',
  'TRIANGLE_UP',
  'TRIANGLE_DOWN',
  'HEXAGON',
  'PENTAGON',
  'OCTAGON',
  'STAR',
  'PLUS',
  'SUMMING_JUNCTION',
  'OR'
])

/** Measures a label wrapped at `maxWidth`; its height is what the wrapped lines take. */
export type LabelMeasure = (maxWidth: number) => { width: number; height: number }

export interface ShapeWithTextFit {
  /** The size the shape was given. */
  width: number
  height: number
  /** The width of the label's longest word, which is never split. */
  longestWord: number
  measure: LabelMeasure
}

const LARGEST = 100_000

/** The smallest `value` from `from` up for which `fits` holds, found by doubling then halving. */
function smallestFitting(from: number, fits: (value: number) => boolean): number {
  if (fits(from)) return from
  let low = from
  let high = Math.max(from * 2, from + 16)
  while (!fits(high)) {
    low = high
    high *= 2
    if (high > LARGEST) return LARGEST
  }
  while (high - low > 0.5) {
    const middle = (low + high) / 2
    if (fits(middle)) high = middle
    else low = middle
  }
  return Math.ceil(high)
}

/**
 * The size a shape of `type` takes for its label, as FigJam fits it: it keeps the size it was
 * given while the label fits, never splits a word (a word too wide widens the shape just enough),
 * and otherwise grows taller. Kinds whose label area narrows at their corners, such as ellipses and
 * diamonds, grow in both directions instead, so they keep their proportions.
 */
export function fitShapeWithText(
  type: ShapeWithTextType,
  { width, height, longestWord, measure }: ShapeWithTextFit
): { width: number; height: number } {
  const wordFits = (w: number, h: number) => shapeWithTextLabelBox(type, w, h).width >= longestWord
  const fits = (w: number, h: number) => {
    const box = shapeWithTextLabelBox(type, w, h)
    return box.width >= longestWord && measure(box.width).height <= box.height
  }
  if (width <= 0 || height <= 0 || fits(width, height)) return { width, height }
  if (GROWS_IN_PROPORTION.has(type)) {
    const scale = smallestFitting(1, (s) => fits(width * s, height * s) || width * s >= LARGEST)
    return { width: Math.ceil(width * scale), height: Math.ceil(height * scale) }
  }
  const fittedWidth = smallestFitting(width, (w) => wordFits(w, height) || w >= LARGEST)
  const fittedHeight = smallestFitting(height, (h) => fits(fittedWidth, h) || h >= LARGEST)
  return { width: fittedWidth, height: fittedHeight }
}
