import type { SceneNode } from '@open-pencil/scene-graph'
import { readIcon } from '@open-pencil/scene-graph/icons'
import type { Rect, Vector } from '@open-pencil/scene-graph/primitives'

import {
  COMPONENT_LABEL_FONT_SIZE,
  COMPONENT_LABEL_GAP,
  COMPONENT_LABEL_ICON_GAP,
  COMPONENT_LABEL_ICON_SIZE,
  LABEL_FONT_SIZE,
  LABEL_OFFSET_Y,
  SECTION_TITLE_FONT_SIZE,
  SECTION_TITLE_GAP,
  SECTION_TITLE_HEIGHT,
  SECTION_TITLE_PADDING_X
} from '#core/constants'

import type { LabelParagraphCache } from './paragraph-cache'

export type LabelKind = 'section' | 'component' | 'frame'
export type LabelTextMetrics = ReturnType<LabelParagraphCache['measure']>
export interface LabelLayout {
  kind: LabelKind
  bounds: Rect
  text: Vector
  icon: Rect | null
  fontSize: number
  fontWeight: number
  maxTextWidth: number
}

const FRAME_TITLE_PARENT_TYPES = new Set(['CANVAS', 'SECTION'])

/**
 * Whether a frame shows its name above it: a frame on the page or in a section, as Figma titles
 * them. An icon is a glyph rather than an artboard, so it goes untitled like a vector.
 */
export function hasFrameTitle(node: SceneNode, parentType: string | undefined): boolean {
  return (
    node.type === 'FRAME' &&
    (parentType === undefined || FRAME_TITLE_PARENT_TYPES.has(parentType)) &&
    !readIcon(node)
  )
}

/** A label boxed as a section title is: where its box and text go, and how wide the text may get. */
export interface PillLayout {
  bounds: Rect
  text: Vector
  /** The text is cut short with an ellipsis past this width. */
  maxTextWidth: number
}

/**
 * A label boxed as a section title: padded text at the title's height, starting at `x` and no
 * wider than `width`, with room `before` and `after` the text for marks such as a status dot.
 * Without `metrics` it gives the widest the text may get, to lay the text out with.
 */
export function pillLayout(
  x: number,
  y: number,
  width: number,
  metrics?: LabelTextMetrics,
  before = 0,
  after = 0
): PillLayout | null {
  if (width <= 0) return null
  const chrome = SECTION_TITLE_PADDING_X * 2 + before + after
  const textWidth = metrics?.width ?? width
  return {
    bounds: { x, y, width: Math.min(textWidth + chrome, width), height: SECTION_TITLE_HEIGHT },
    text: {
      x: x + SECTION_TITLE_PADDING_X + before,
      y: y + (SECTION_TITLE_HEIGHT - (metrics?.height ?? SECTION_TITLE_FONT_SIZE)) / 2
    },
    maxTextWidth: Math.max(1, width - chrome)
  }
}

function sectionLabelLayout(
  screenWidth: number,
  inside: boolean,
  metrics?: LabelTextMetrics
): LabelLayout | null {
  const x = inside ? SECTION_TITLE_GAP : 0
  const y = inside ? SECTION_TITLE_GAP : -SECTION_TITLE_HEIGHT - SECTION_TITLE_GAP
  const pill = pillLayout(x, y, screenWidth - x, metrics)
  if (!pill) return null
  return {
    kind: 'section',
    ...pill,
    icon: null,
    fontSize: SECTION_TITLE_FONT_SIZE,
    fontWeight: 600
  }
}

/** Pixel-local geometry shared by drawing and hit-testing, including ellipsis and icon bounds. */
export function labelLayout(
  kind: LabelKind,
  screenWidth: number,
  inside = false,
  metrics?: LabelTextMetrics
): LabelLayout | null {
  if (screenWidth <= 0) return null
  if (kind === 'section') return sectionLabelLayout(screenWidth, inside, metrics)
  const textWidth = metrics?.width ?? screenWidth
  const component = kind === 'component'
  const fontSize = component ? COMPONENT_LABEL_FONT_SIZE : LABEL_FONT_SIZE
  const textX = component ? COMPONENT_LABEL_ICON_SIZE + COMPONENT_LABEL_ICON_GAP : 0
  const maxTextWidth = screenWidth - textX
  if (maxTextWidth <= 0) return null
  const outsideY = component ? -COMPONENT_LABEL_GAP - fontSize : -LABEL_OFFSET_Y - fontSize
  const textY = component && inside ? COMPONENT_LABEL_GAP : outsideY
  const icon = component
    ? {
        x: 0,
        y: textY + fontSize * 0.25,
        width: COMPONENT_LABEL_ICON_SIZE,
        height: COMPONENT_LABEL_ICON_SIZE
      }
    : null
  return {
    kind,
    bounds: {
      x: 0,
      y: textY,
      width: Math.min(textX + textWidth, screenWidth),
      height: Math.max(metrics?.height ?? fontSize, icon ? icon.y + icon.height - textY : 0)
    },
    text: { x: textX, y: textY },
    icon,
    fontSize,
    fontWeight: 400,
    maxTextWidth
  }
}

/** How far, in screen pixels, a label can reach outside the node it names. */
const LABEL_REACH = Math.max(
  LABEL_OFFSET_Y + LABEL_FONT_SIZE,
  SECTION_TITLE_HEIGHT + SECTION_TITLE_GAP,
  COMPONENT_LABEL_GAP + COMPONENT_LABEL_FONT_SIZE
)

/**
 * The viewport widened by how far labels reach outside their nodes, so a node just outside the
 * view whose name is inside it still has its name drawn and clickable.
 */
export function labelViewport<T extends { x: number; y: number; w: number; h: number }>(
  viewport: T,
  zoom: number
): T {
  const reach = LABEL_REACH / zoom
  return {
    ...viewport,
    x: viewport.x - reach,
    y: viewport.y - reach,
    w: viewport.w + reach * 2,
    h: viewport.h + reach * 2
  }
}
