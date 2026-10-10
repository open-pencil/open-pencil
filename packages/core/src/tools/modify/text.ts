import * as v from 'valibot'

import type { SceneNode } from '@open-pencil/scene-graph'
import { parseColor } from '@open-pencil/scene-graph/color'

import { toolNumber, nodeIdInput } from '#core/tools/input'
import { defineTool, nodeNotFound, toolFailure } from '#core/tools/schema'

export const setText = defineTool({
  name: 'set_text',

  description: 'Set text content of a text node.',
  execution: { kind: 'sync', mutation: 'properties' },
  input: v.strictObject({
    id: nodeIdInput,
    text: v.pipe(v.string(), v.description('Text content'))
  }),
  execute: (figma, { id, text }) => {
    const node = figma.getNodeById(id)
    if (!node) return { error: `Node "${id}" not found` }
    node.characters = text
    return { id, text }
  }
})

export const setFont = defineTool({
  name: 'set_font',

  description: 'Set font properties of a text node.',
  execution: { kind: 'sync', mutation: 'properties' },
  input: v.strictObject({
    id: nodeIdInput,
    family: v.optional(v.pipe(v.string(), v.description('Font family name'))),
    size: v.optional(toolNumber(v.pipe(v.number(), v.minValue(1), v.description('Font size')))),
    style: v.optional(
      v.pipe(v.string(), v.description('Font style (e.g. "Bold", "Regular", "Bold Italic")'))
    )
  }),
  execute: (figma, args) => {
    const node = figma.getNodeById(args.id)
    if (!node) return nodeNotFound(args.id)
    if (args.size !== undefined) node.fontSize = args.size
    if (args.family || args.style) {
      // Text set in several fonts takes the given family or style for all of it, keeping the
      // rest from its first character.
      const fontName =
        typeof node.fontName === 'symbol' && node.characters.length > 0
          ? node.getRangeFontName(0, 1)
          : node.fontName
      const current = typeof fontName === 'symbol' ? null : fontName
      node.fontName = {
        family: args.family ?? current?.family ?? '',
        style: args.style ?? current?.style ?? 'Regular'
      }
    }
    return { id: args.id, fontName: node.fontName, fontSize: node.fontSize }
  }
})

export const setFontRange = defineTool({
  name: 'set_font_range',

  description: 'Set font properties for a text range.',
  execution: { kind: 'sync', mutation: 'properties' },
  input: v.strictObject({
    id: nodeIdInput,
    start: toolNumber(v.pipe(v.number(), v.minValue(0), v.description('Start character index'))),
    end: toolNumber(v.pipe(v.number(), v.minValue(0), v.description('End character index'))),
    family: v.optional(v.pipe(v.string(), v.description('Font family name'))),
    size: v.optional(toolNumber(v.pipe(v.number(), v.minValue(1), v.description('Font size')))),
    style: v.optional(v.pipe(v.string(), v.description('Font style'))),
    color: v.optional(v.pipe(v.string(), v.description('Text color (hex)')))
  }),
  execute: (figma, args) => {
    const node = figma.getNodeById(args.id)
    if (!node) return nodeNotFound(args.id)
    const { start, end } = args
    if (!args.family && !args.size && !args.style && !args.color) {
      return { error: 'set_font_range needs at least one of family, size, style, or color' }
    }
    // The range methods reject an empty range or one past the text, before changing anything.
    try {
      if (args.size) node.setRangeFontSize(start, end, args.size)
      if (args.family || args.style) {
        const current = node.getRangeFontName(start, start + 1)
        const fontName = typeof current === 'symbol' ? null : current
        node.setRangeFontName(start, end, {
          family: args.family ?? fontName?.family ?? '',
          style: args.style ?? fontName?.style ?? 'Regular'
        })
      }
      if (args.color) {
        node.setRangeFills(start, end, [
          { type: 'SOLID', color: parseColor(args.color), opacity: 1, visible: true }
        ])
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
    id: nodeIdInput,
    mode: v.pipe(
      v.picklist(['NONE', 'WIDTH_AND_HEIGHT', 'HEIGHT', 'TRUNCATE']),
      v.description('Resize mode')
    )
  }),
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
      node.textDirection = args.direction as SceneNode['textDirection']
      updated.push('textDirection')
    }
    if (args.text_decoration !== undefined) {
      node.textDecoration = args.text_decoration
      updated.push('textDecoration')
    }
    return { id: args.id, updated }
  }
})
