import * as v from 'valibot'

import { parseColor } from '@open-pencil/scene-graph/color'

import type { FigmaAPI, FigmaNodeProxy } from '#core/figma-api'
import type { FigmaFontName, FigmaFontNameInput } from '#core/figma-api/fonts/names'
import type { FigmaVariationSettings } from '#core/figma-api/fonts/variations'
import { OpenPencilAPI } from '#core/openpencil-api'
import { textMarkdownChanges } from '#core/openpencil-api/nodes'
import { collectNodeFontFaces } from '#core/text/requirements/collect'
import {
  toolNumber,
  nodeIdInputSchema,
  defineTool,
  nodeNotFound,
  toolFailure
} from '#core/tools/schema'

/** The fonts a text layer uses, which an edit that lays it out again needs loaded. */
export function textFonts(figma: FigmaAPI, id: string): FigmaFontNameInput[] {
  const node = figma.graph.getNode(id)
  return node ? collectNodeFontFaces(node) : []
}

export const setText = defineTool({
  name: 'set_text',

  description:
    "Set text content of a text node. With markdown, the text is Markdown: # and ## headings, **bold**, *italic*, ~~strike~~, `code`, [links](url), lists, and > quotes become styled ranges and paragraphs over the text's own style.",
  execution: { kind: 'sync', mutation: 'properties' },
  input: v.strictObject({
    id: nodeIdInputSchema,
    text: v.pipe(v.string(), v.description('Text content')),
    markdown: v.optional(v.pipe(v.boolean(), v.description('Read the text as Markdown')))
  }),
  fonts: (figma, { id, text, markdown }) => {
    const node = figma.graph.getNode(id)
    if (!markdown || node?.type !== 'TEXT') return textFonts(figma, id)
    return collectNodeFontFaces({ ...node, ...textMarkdownChanges(node, text) })
  },
  execute: (figma, { id, text, markdown }) => {
    const node = figma.getNodeById(id)
    if (!node) return { error: `Node "${id}" not found` }
    try {
      if (markdown) new OpenPencilAPI(figma).setTextMarkdown(node, text)
      else node.characters = text
    } catch (error) {
      return toolFailure(error)
    }
    return { id, text: node.characters }
  }
})

/** Variable font axes a font tool can set, as Figma's `variationSettings`. */
const variationsInputSchema = v.optional(
  v.pipe(
    v.record(v.pipe(v.string(), v.length(4)), v.number()),
    v.description(
      'Variable font axis values by OpenType tag (e.g. {"wght": 550, "wdth": 75}); axes left out keep the style\'s values. Without a style, the nearest named style is picked.'
    )
  )
)

/**
 * The font a font tool gives text: what it names, the rest from `current`. Axes without a style
 * leave the style out, for the nearest named style to be picked.
 */
function fontNameInput(
  args: { family?: string; style?: string; variations?: FigmaVariationSettings },
  current: FigmaFontName | null
): FigmaFontNameInput {
  return {
    family: args.family ?? current?.family ?? '',
    style: args.style ?? (args.variations ? undefined : (current?.style ?? 'Regular')),
    variationSettings: args.variations
  }
}

/**
 * The font `set_font` gives the text, or null when it keeps the text's. Text set in several fonts
 * takes the given family or style for all of it, keeping the rest from its first character. Axes
 * without a style are set per range, each range taking its nearest named style, as in Figma.
 */
function requestedFont(
  node: FigmaNodeProxy,
  args: { family?: string; style?: string; variations?: FigmaVariationSettings }
): { whole: FigmaFontName } | { perRange: FigmaFontNameInput } | null {
  if (!args.family && !args.style && !args.variations) return null
  const fontName =
    typeof node.fontName === 'symbol' && node.characters.length > 0
      ? node.getRangeFontName(0, 1)
      : node.fontName
  const current = typeof fontName === 'symbol' ? null : fontName
  const family = args.family ?? current?.family ?? ''
  if (args.variations && !args.style && node.characters.length > 0) {
    return { perRange: { family, variationSettings: args.variations } }
  }
  const style = args.style ?? current?.style ?? 'Regular'
  return { whole: { family, style, variationSettings: args.variations } }
}

export const setFont = defineTool({
  name: 'set_font',

  description: 'Set font properties of a text node.',
  execution: { kind: 'sync', mutation: 'properties' },
  input: v.strictObject({
    id: nodeIdInputSchema,
    family: v.optional(v.pipe(v.string(), v.description('Font family name'))),
    size: v.optional(toolNumber(v.pipe(v.number(), v.minValue(1), v.description('Font size')))),
    style: v.optional(
      v.pipe(v.string(), v.description('Font style (e.g. "Bold", "Regular", "Bold Italic")'))
    ),
    variations: variationsInputSchema
  }),
  // A new font replaces the text's, which then need not be loaded, so a missing font can be
  // replaced; a size or per-range axes lay out the text in its own fonts.
  fonts: (figma, args) => {
    const node = figma.getNodeById(args.id)
    const font = node && requestedFont(node, args)
    if (font && 'whole' in font) return [font.whole]
    return [...(font ? [font.perRange] : []), ...textFonts(figma, args.id)]
  },
  execute: (figma, args) => {
    const node = figma.getNodeById(args.id)
    if (!node) return nodeNotFound(args.id)
    const font = requestedFont(node, args)
    try {
      if (font && 'whole' in font) node.fontName = font.whole
      else if (font) node.setRangeFontName(0, node.characters.length, font.perRange)
      // The size comes after the font, so it lays the text out in the font it ends up in.
      if (args.size !== undefined) node.fontSize = args.size
    } catch (error) {
      return toolFailure(error)
    }
    return { id: args.id, fontName: node.fontName, fontSize: node.fontSize }
  }
})

/** The font `set_font_range` gives its range: what it names, the rest from the range's start. */
function rangeFont(
  node: FigmaNodeProxy,
  args: { start: number; family?: string; style?: string; variations?: FigmaVariationSettings }
): FigmaFontNameInput {
  const inText = args.start < node.characters.length
  const current = inText ? node.getRangeFontName(args.start, args.start + 1) : node.fontName
  return fontNameInput(args, typeof current === 'symbol' ? null : current)
}

export const setFontRange = defineTool({
  name: 'set_font_range',

  description: 'Set font properties for a text range.',
  execution: { kind: 'sync', mutation: 'properties' },
  input: v.strictObject({
    id: nodeIdInputSchema,
    start: toolNumber(v.pipe(v.number(), v.minValue(0), v.description('Start character index'))),
    end: toolNumber(v.pipe(v.number(), v.minValue(0), v.description('End character index'))),
    family: v.optional(v.pipe(v.string(), v.description('Font family name'))),
    size: v.optional(toolNumber(v.pipe(v.number(), v.minValue(1), v.description('Font size')))),
    style: v.optional(v.pipe(v.string(), v.description('Font style'))),
    variations: variationsInputSchema,
    color: v.optional(v.pipe(v.string(), v.description('Text color (hex)')))
  }),
  fonts: (figma, args) => {
    const node = figma.getNodeById(args.id)
    if (!node) return []
    const font = args.family || args.style || args.variations ? rangeFont(node, args) : null
    // A colour alone is a paint and lays nothing out, so text in a missing font can still take it.
    const laysOut = font !== null || args.size !== undefined
    return [...(font ? [font] : []), ...(laysOut ? textFonts(figma, args.id) : [])]
  },
  execute: (figma, args) => {
    const node = figma.getNodeById(args.id)
    if (!node) return nodeNotFound(args.id)
    const { start, end } = args
    if (!args.family && !args.size && !args.style && !args.variations && !args.color) {
      return {
        error: 'set_font_range needs at least one of family, size, style, variations, or color'
      }
    }
    // The range methods reject an empty range or one past the text, before changing anything.
    try {
      if (args.size) node.setRangeFontSize(start, end, args.size)
      if (args.family || args.style || args.variations) {
        node.setRangeFontName(start, end, rangeFont(node, args))
      }
      if (args.color) {
        node.setRangeFills(start, end, [{ type: 'SOLID', color: parseColor(args.color) }])
      }
    } catch (error) {
      return toolFailure(error)
    }
    return { id: args.id, range: { start, end } }
  }
})

export const setTextResize = defineTool({
  name: 'set_text_resize',

  description: 'Set text auto-resize mode.',
  execution: { kind: 'sync', mutation: 'properties' },
  input: v.strictObject({
    id: nodeIdInputSchema,
    mode: v.pipe(
      v.picklist(['NONE', 'WIDTH_AND_HEIGHT', 'HEIGHT', 'TRUNCATE']),
      v.description('Resize mode')
    )
  }),
  fonts: (figma, { id }) => textFonts(figma, id),
  execute: (figma, { id, mode }) => {
    const node = figma.getNodeById(id)
    if (!node) return { error: `Node "${id}" not found` }
    node.textAutoResize = mode
    return { id, textAutoResize: mode }
  }
})

export const setTextProperties = defineTool({
  name: 'set_text_properties',

  description:
    'Set text layout properties: alignment, auto-resize, text case, decoration, truncation.',
  execution: { kind: 'sync', mutation: 'properties' },
  input: v.strictObject({
    id: v.pipe(v.string(), v.description('Text node ID')),
    align_horizontal: v.optional(
      v.pipe(
        v.picklist(['LEFT', 'CENTER', 'RIGHT', 'JUSTIFIED']),
        v.description('Horizontal text alignment')
      )
    ),
    align_vertical: v.optional(
      v.pipe(v.picklist(['TOP', 'CENTER', 'BOTTOM']), v.description('Vertical text alignment'))
    ),
    auto_resize: v.optional(
      v.pipe(
        v.picklist(['NONE', 'WIDTH_AND_HEIGHT', 'HEIGHT', 'TRUNCATE']),
        v.description('Text auto-resize mode')
      )
    ),
    direction: v.optional(
      v.pipe(v.picklist(['AUTO', 'LTR', 'RTL']), v.description('Text direction'))
    ),
    text_decoration: v.optional(
      v.pipe(v.picklist(['NONE', 'UNDERLINE', 'STRIKETHROUGH']), v.description('Text decoration'))
    )
  }),
  fonts: (figma, { id }) => textFonts(figma, id),
  execute: (figma, args) => {
    const node = figma.getNodeById(args.id)
    if (!node) return nodeNotFound(args.id)
    if (node.type !== 'TEXT') return { error: `Node "${args.id}" is not a TEXT node` }
    const updated: string[] = []
    if (args.align_horizontal !== undefined) {
      node.textAlignHorizontal = args.align_horizontal
      updated.push('textAlignHorizontal')
    }
    if (args.align_vertical !== undefined) {
      node.textAlignVertical = args.align_vertical
      updated.push('textAlignVertical')
    }
    if (args.auto_resize !== undefined) {
      node.textAutoResize = args.auto_resize
      updated.push('textAutoResize')
    }
    if (args.direction !== undefined) {
      new OpenPencilAPI(figma).setTextDirection(node, args.direction)
      updated.push('textDirection')
    }
    if (args.text_decoration !== undefined) {
      node.textDecoration = args.text_decoration
      updated.push('textDecoration')
    }
    return { id: args.id, updated }
  }
})
