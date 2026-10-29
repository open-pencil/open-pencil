import type { Canvas, Paragraph } from 'canvaskit-wasm'

import Matrix, { type Mat3 } from '@open-pencil/scene-graph/matrix'
import type { Color, Rect, Vector } from '@open-pencil/scene-graph/primitives'
import type { StatusState } from '@open-pencil/scene-graph/statuses'

import type { SkiaRenderer } from '#core/canvas/renderer'
import {
  SECTION_TITLE_FONT_SIZE,
  SECTION_TITLE_PADDING_X,
  SECTION_TITLE_RADIUS
} from '#core/constants'

import { pillLayout, type LabelTextMetrics, type PillLayout } from './layout'

/** Space between a section's title and its status pill, in screen pixels. */
const PILL_GAP = 4
/** A frame's or component's status dot: its radius and its gap after the name. */
const DOT_RADIUS = 3.5
const DOT_GAP = 5

/** A status label drawn in the last frame, in canvas-element CSS pixels, for hit testing. */
export interface PlacedStatusLabel {
  nodeId: string
  rect: Rect
}

/** Records where a label drawn under `matrix` went, so a click on it finds its layer. */
export function placeStatusLabel(r: SkiaRenderer, nodeId: string, matrix: Mat3, local: Rect): void {
  const corners = [
    Matrix.mapPoint(matrix, { x: local.x, y: local.y }),
    Matrix.mapPoint(matrix, { x: local.x + local.width, y: local.y }),
    Matrix.mapPoint(matrix, { x: local.x, y: local.y + local.height }),
    Matrix.mapPoint(matrix, { x: local.x + local.width, y: local.y + local.height })
  ]
  const xs = corners.map((corner) => corner.x)
  const ys = corners.map((corner) => corner.y)
  const x = Math.min(...xs)
  const y = Math.min(...ys)
  r.statusLabels.push({
    nodeId,
    rect: { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y }
  })
}

/** The topmost status label under a point; labels drawn last are on top. */
export function hitTestStatusLabels(
  placed: readonly PlacedStatusLabel[],
  x: number,
  y: number
): PlacedStatusLabel | null {
  return (
    placed.findLast(
      ({ rect }) =>
        x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height
    ) ?? null
  )
}

/** A pill with no name, only the dot. */
const NO_TEXT = { width: 0, height: SECTION_TITLE_FONT_SIZE }

/**
 * Room a section's title leaves for its status, a compact pill with the dot alone: zoomed out,
 * the title is cut short rather than the status left out, as Figma keeps its Ready for dev icon.
 */
export const SECTION_STATUS_ROOM = PILL_GAP + SECTION_TITLE_PADDING_X * 2 + DOT_RADIUS * 2

/** Room a frame's or component's name leaves for its status dot. */
export const TITLE_STATUS_ROOM = DOT_GAP + DOT_RADIUS * 2

/** Narrowest a state's name gets before the pill keeps only its dot: about a letter and "…". */
const MIN_NAME_WIDTH = 16

/** A section's status pill, laid out as the title is, and whether it has room for the name. */
export interface SectionStatusPill extends PillLayout {
  compact: boolean
}

/**
 * Where a section's status pill goes, beside its title, in the title's pixel space: the dot and
 * the state's name, padded like the title. The name is cut short with an ellipsis as the title
 * is; with no room for even a letter, the pill keeps the dot alone, and null when not even that
 * fits. Without `metrics` it gives the widest the name may get.
 */
export function sectionStatusPill(
  title: Rect,
  screenWidth: number,
  metrics?: LabelTextMetrics
): SectionStatusPill | null {
  const x = title.x + title.width + PILL_GAP
  const width = screenWidth - x
  const full = pillLayout(x, title.y, width, metrics, DOT_RADIUS * 2 + DOT_GAP)
  if (full && full.maxTextWidth >= MIN_NAME_WIDTH) return { ...full, compact: false }
  const compact = pillLayout(x, title.y, width, NO_TEXT, DOT_RADIUS * 2)
  if (!compact || compact.bounds.width < SECTION_TITLE_PADDING_X * 2 + DOT_RADIUS * 2) return null
  return { ...compact, compact: true }
}

/** Where a frame's or component's status dot goes, after its name, in the label's pixel space. */
export function statusDotCenter(
  textX: number,
  textY: number,
  textWidth: number,
  fontSize: number,
  screenWidth: number
): Vector | null {
  const x = textX + textWidth + DOT_GAP + DOT_RADIUS
  if (x + DOT_RADIUS > screenWidth) return null
  return { x, y: textY + fontSize / 2 + 1 }
}

/** The area around a status dot a click takes, a little larger than the dot. */
export function statusDotHitRect(center: Vector): Rect {
  const reach = DOT_RADIUS + 3
  return { x: center.x - reach, y: center.y - reach, width: reach * 2, height: reach * 2 }
}

/** The title's own look, which the pill beside it shares. */
export interface SectionTitleColors {
  background: Color
  foreground: Float32Array
  border: Float32Array
}

/**
 * A section's status as Figma draws Ready for dev: a pill beside the title, in the title's colors
 * so any state color stays readable, with a dot in the state's color and its name. Drawn in the
 * title's space.
 */
export function drawSectionStatus(
  r: SkiaRenderer,
  canvas: Canvas,
  provider: NonNullable<SkiaRenderer['fontProvider']>,
  label: StatusState,
  title: Rect,
  colors: SectionTitleColors,
  screenWidth: number,
  place: (rect: Rect) => void
): void {
  const widest = sectionStatusPill(title, screenWidth)
  if (!widest) return
  const draw = (pill: SectionStatusPill, paragraph?: Paragraph) => {
    const { x, y, width, height } = pill.bounds
    place(pill.bounds)
    const bounds = r.ck.RRectXY(
      r.ck.LTRBRect(x, y, x + width, y + height),
      SECTION_TITLE_RADIUS,
      SECTION_TITLE_RADIUS
    )
    const { background } = colors
    r.auxFill.setColor(r.ck.Color4f(background.r, background.g, background.b, background.a))
    canvas.drawRRect(bounds, r.auxFill)
    r.auxStroke.setColor(colors.border)
    r.auxStroke.setStrokeWidth(1)
    r.auxStroke.setPathEffect(null)
    canvas.drawRRect(bounds, r.auxStroke)
    r.auxFill.setColor(r.ck.Color4f(label.color.r, label.color.g, label.color.b, 1))
    canvas.drawCircle(
      x + SECTION_TITLE_PADDING_X + DOT_RADIUS,
      y + height / 2,
      DOT_RADIUS,
      r.auxFill
    )
    if (paragraph) canvas.drawParagraph(paragraph, pill.text.x, pill.text.y)
  }
  if (widest.compact) {
    draw(widest)
    return
  }
  r.labelParagraphCache.use(
    r.ck,
    provider,
    label.name,
    SECTION_TITLE_FONT_SIZE,
    widest.maxTextWidth,
    colors.foreground,
    r.fontGeneration,
    ({ paragraph, metrics }) => {
      const pill = sectionStatusPill(title, screenWidth, metrics)
      if (pill) draw(pill, paragraph)
    },
    600
  )
}

/** A frame's or component's status: a dot in the state's color after its name. */
export function drawStatusDot(
  r: SkiaRenderer,
  canvas: Canvas,
  label: StatusState,
  center: Vector
): void {
  r.auxFill.setColor(r.ck.Color4f(label.color.r, label.color.g, label.color.b, 1))
  canvas.drawCircle(center.x, center.y, DOT_RADIUS, r.auxFill)
}
