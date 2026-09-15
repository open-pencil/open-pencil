import type { SceneNode } from '@open-pencil/scene-graph'
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

export function hasFrameTitle(node: SceneNode, parent?: SceneNode | null): boolean {
  return node.type === 'FRAME' && (!parent || parent.type === 'CANVAS' || parent.type === 'SECTION')
}

function sectionLabelLayout(
  screenWidth: number,
  inside: boolean,
  metrics?: LabelTextMetrics
): LabelLayout | null {
  const x = inside ? SECTION_TITLE_GAP : 0
  if (screenWidth <= x) return null
  const y = inside ? SECTION_TITLE_GAP : -SECTION_TITLE_HEIGHT - SECTION_TITLE_GAP
  const textWidth = metrics?.width ?? screenWidth
  return {
    kind: 'section',
    bounds: {
      x,
      y,
      width: Math.min(textWidth + SECTION_TITLE_PADDING_X * 2, screenWidth - x),
      height: SECTION_TITLE_HEIGHT
    },
    text: {
      x: x + SECTION_TITLE_PADDING_X,
      y: y + (SECTION_TITLE_HEIGHT - (metrics?.height ?? SECTION_TITLE_FONT_SIZE)) / 2
    },
    icon: null,
    fontSize: SECTION_TITLE_FONT_SIZE,
    fontWeight: 600,
    maxTextWidth: Math.max(1, screenWidth - x - SECTION_TITLE_PADDING_X * 2)
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
