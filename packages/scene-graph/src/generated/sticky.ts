import { BLACK } from '../constants'
import type { SceneGraph } from '../graph'
import type { Color } from '../primitives'
import { lineHeightPixels, percentLength, pixelLength } from '../text/lengths'
import type { Effect, Fill, SceneNode } from '../types'
import type { GeneratedFrameKind } from './kind'

/**
 * A FigJam sticky note as Figma lays it out: a fixed-width card that grows to fit its body, with
 * the author pinned to the bottom. Every length scales with the note, which `rescale` changes;
 * the values here are those of a note at scale 1, measured in Figma.
 */
export const STICKY_SIZE = 240
export const STICKY_WIDE_WIDTH = 416
const STICKY_PADDING = 20
const STICKY_GAP = 16

export const STICKY_FONT_FAMILY = 'Inter'
export const STICKY_FONT_WEIGHT = 500
export const STICKY_BODY_FONT_SIZE = 16
export const STICKY_AUTHOR_FONT_SIZE = 12

/** FigJam's sticky palette, in its picker's order. */
export const STICKY_COLORS = {
  white: { r: 1, g: 1, b: 1, a: 1 },
  gray: { r: 230 / 255, g: 230 / 255, b: 230 / 255, a: 1 },
  red: { r: 1, g: 175 / 255, b: 163 / 255, a: 1 },
  orange: { r: 1, g: 211 / 255, b: 168 / 255, a: 1 },
  yellow: { r: 1, g: 226 / 255, b: 153 / 255, a: 1 },
  green: { r: 179 / 255, g: 239 / 255, b: 189 / 255, a: 1 },
  teal: { r: 179 / 255, g: 244 / 255, b: 239 / 255, a: 1 },
  blue: { r: 168 / 255, g: 218 / 255, b: 1, a: 1 },
  violet: { r: 211 / 255, g: 189 / 255, b: 1, a: 1 },
  pink: { r: 1, g: 168 / 255, b: 219 / 255, a: 1 }
} as const satisfies Record<string, Color>

export const DEFAULT_STICKY_COLOR: Color = STICKY_COLORS.blue

function solid(color: Color, opacity = 1): Fill {
  return { type: 'SOLID', color: { ...color }, opacity, visible: true }
}

function dropShadow(y: number, radius: number, alpha: number): Effect {
  return {
    type: 'DROP_SHADOW',
    color: { ...BLACK, a: alpha },
    offset: { x: 0, y },
    radius,
    spread: 0,
    visible: true,
    blendMode: 'NORMAL',
    showShadowBehindNode: true
  }
}

/** The three soft shadows Figma gives every sticky. */
export function stickyShadows(): Effect[] {
  return [dropShadow(2.5, 2, 0.02), dropShadow(3, 5, 0.04), dropShadow(8, 10, 0.08)]
}

/**
 * The note's own fields: a vertical auto layout that hugs its sublayers above a minimum height,
 * spreading them apart so the author sits at the bottom. A generated frame keeps its gap with
 * space between, which keeps the author clear of a long body.
 */
export function stickyFrameFields(scale = 1): Partial<SceneNode> {
  const padding = STICKY_PADDING * scale
  return {
    layoutMode: 'VERTICAL',
    primaryAxisAlign: 'SPACE_BETWEEN',
    counterAxisAlign: 'MIN',
    primaryAxisSizing: 'HUG',
    counterAxisSizing: 'FIXED',
    itemSpacing: STICKY_GAP * scale,
    paddingTop: padding,
    paddingRight: padding,
    paddingBottom: padding,
    paddingLeft: padding,
    minHeight: STICKY_SIZE * scale,
    cornerRadius: 0,
    clipsContent: false
  }
}

export type StickyTextRole = 'body' | 'author'

/** How a sublayer sits in the note: as wide as the padding allows, as tall as its text. */
export const STICKY_SUBLAYER_LAYOUT = {
  textAutoResize: 'HEIGHT',
  layoutAlignSelf: 'STRETCH'
} as const satisfies Partial<SceneNode>

/** A sublayer's text style; the body follows the size preset, the author only the scale. */
export function stickyTextFields(
  role: StickyTextRole,
  scale = 1,
  fontSize = role === 'body' ? STICKY_BODY_FONT_SIZE * scale : STICKY_AUTHOR_FONT_SIZE * scale
): Partial<SceneNode> {
  return {
    name: role === 'body' ? 'Text' : 'Author',
    fontFamily: STICKY_FONT_FAMILY,
    fontWeight: STICKY_FONT_WEIGHT,
    fontSize,
    // As Figma writes a note: the body at 150% and the author at 16 px a scale, tracked -1.1%.
    lineHeight: role === 'body' ? percentLength(150) : pixelLength(16 * scale),
    letterSpacing: percentLength(-1.1),
    textAlignHorizontal: 'LEFT',
    textAlignVertical: 'TOP',
    ...STICKY_SUBLAYER_LAYOUT,
    fills: [solid(BLACK, role === 'body' ? 0.8 : 128 / 255)]
  }
}

/** The scale a note was drawn at, read from its author line, whose size only the scale sets. */
export function stickyScale(author: Pick<SceneNode, 'fontSize'> | undefined): number {
  return author ? author.fontSize / STICKY_AUTHOR_FONT_SIZE : 1
}

/** A note's width at a scale, square or wide, as FigJam's side handles switch between them. */
export function stickyWidth(scale: number, wide: boolean): number {
  return (wide ? STICKY_WIDE_WIDTH : STICKY_SIZE) * scale
}

/** Whether a note is wide: nearer FigJam's wide width than its square one at its scale. */
export function isWideSticky(graph: SceneGraph, sticky: SceneNode): boolean {
  const scale = stickyScale(stickySublayers(graph, sticky)?.author)
  return sticky.width > ((STICKY_SIZE + STICKY_WIDE_WIDTH) / 2) * scale
}

export interface StickySublayers {
  body: SceneNode
  author: SceneNode
}

/** A note's body and author, in the order Figma generates them. */
export function stickySublayers(graph: SceneGraph, sticky: SceneNode): StickySublayers | null {
  const children = graph.getChildren(sticky.id)
  if (children.length !== 2) return null
  const [body, author] = children
  if (body.type !== 'TEXT' || author.type !== 'TEXT') return null
  return { body, author }
}

/** A sticky note scales as a whole from its own handles and stays upright, as in FigJam. */
export const STICKY_KIND: GeneratedFrameKind = {
  complete: (graph, frame) => stickySublayers(graph, frame) !== null,
  text: (graph, frame) => stickySublayers(graph, frame)?.body,
  rotates: false,
  resizes: false,
  strokesAndEffects: false,
  namedByText: true
}

export interface StickyContent {
  text?: string
  author?: string
  authorVisible?: boolean
  color?: Color
  wide?: boolean
  scale?: number
}

/** Adds a note's sublayers to a STICKY the caller created, styled as Figma generates them. */
export function buildStickySublayers(
  graph: SceneGraph,
  sticky: SceneNode,
  content: Pick<StickyContent, 'text' | 'author' | 'authorVisible' | 'scale'> = {},
  overrides: { body?: Partial<SceneNode>; author?: Partial<SceneNode> } = {}
): StickySublayers {
  const scale = content.scale ?? 1
  const inner = sticky.width - 2 * STICKY_PADDING * scale
  // One line tall until text is measured, so a note laid out without fonts keeps Figma's square.
  const bodyFields = stickyTextFields('body', scale)
  const authorFields = stickyTextFields('author', scale)
  const body = graph.createNode('TEXT', sticky.id, {
    ...bodyFields,
    width: inner,
    height: lineHeightPixels(bodyFields.lineHeight ?? null, bodyFields.fontSize ?? 0) ?? undefined,
    text: content.text ?? '',
    ...overrides.body
  })
  const author = graph.createNode('TEXT', sticky.id, {
    ...authorFields,
    width: inner,
    height:
      lineHeightPixels(authorFields.lineHeight ?? null, authorFields.fontSize ?? 0) ?? undefined,
    text: content.author ?? '',
    visible: content.authorVisible ?? true,
    ...overrides.author
  })
  return { body, author }
}

/** A new note with its sublayers; the caller lays it out to grow it to its text. */
export function createSticky(
  graph: SceneGraph,
  parentId: string,
  content: StickyContent = {},
  props: Partial<SceneNode> = {}
): SceneNode {
  const scale = content.scale ?? 1
  const size = STICKY_SIZE * scale
  const sticky = graph.createNode('STICKY', parentId, {
    name: 'Sticky',
    width: (content.wide ? STICKY_WIDE_WIDTH : STICKY_SIZE) * scale,
    height: size,
    fills: [solid(content.color ?? DEFAULT_STICKY_COLOR)],
    effects: stickyShadows(),
    ...stickyFrameFields(scale),
    ...props
  })
  buildStickySublayers(graph, sticky, content)
  return sticky
}
