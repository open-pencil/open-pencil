import { parseColor } from '#core/color'
import type { CharacterStyleOverride, SceneNode } from '#core/scene-graph'
import { styleToWeight } from '#core/text/fonts'
import { applyStyleToRange } from '#core/text/style-runs'
import { defineTool, nodeNotFound } from '#core/tools/schema'

export const setText = defineTool({
  name: 'set_text',
  mutates: true,
  description: 'Set text content of a text node.',
  params: {
    id: { type: 'string', description: 'Node ID', required: true },
    text: { type: 'string', description: 'Text content', required: true }
  },
  execute: (figma, { id, text }) => {
    const node = figma.getNodeById(id)
    if (!node) return { error: `Node "${id}" not found` }
    node.characters = text
    return { id, text }
  }
})

export const setFont = defineTool({
  name: 'set_font',
  mutates: true,
  description: 'Set font properties of a text node.',
  params: {
    id: { type: 'string', description: 'Node ID', required: true },
    family: { type: 'string', description: 'Font family name' },
    size: { type: 'number', description: 'Font size', min: 1 },
    style: { type: 'string', description: 'Font style (e.g. "Bold", "Regular", "Bold Italic")' }
  },
  execute: (figma, args) => {
    const node = figma.getNodeById(args.id)
    if (!node) return nodeNotFound(args.id)
    if (args.size !== undefined) node.fontSize = args.size
    if (args.family || args.style) {
      const current = node.fontName
      node.fontName = {
        family: args.family ?? current.family,
        style: args.style ?? current.style
      }
    }
    return { id: args.id, fontName: node.fontName, fontSize: node.fontSize }
  }
})

export const setFontRange = defineTool({
  name: 'set_font_range',
  mutates: true,
  description: 'Set font properties for a text range.',
  params: {
    id: { type: 'string', description: 'Node ID', required: true },
    start: { type: 'number', description: 'Start character index', required: true, min: 0 },
    end: { type: 'number', description: 'End character index', required: true, min: 0 },
    family: { type: 'string', description: 'Font family name' },
    size: { type: 'number', description: 'Font size', min: 1 },
    style: { type: 'string', description: 'Font style' },
    color: { type: 'color', description: 'Text color (hex)' }
  },
  execute: (figma, args) => {
    const node = figma.getNodeById(args.id)
    if (!node) return nodeNotFound(args.id)
    const override: CharacterStyleOverride = {}
    if (args.family) override.fontFamily = args.family
    if (args.size) override.fontSize = args.size
    if (args.style) {
      const s = args.style.toLowerCase()
      if (s.includes('italic')) override.italic = true
      override.fontWeight = styleToWeight(args.style)
    }
    if (args.color) {
      override.fills = [{ type: 'SOLID', color: parseColor(args.color), opacity: 1, visible: true }]
    }
    const raw = figma.graph.getNode(node.id)
    if (!raw) return { error: `Node "${args.id}" not found` }
    const runs = applyStyleToRange(raw.styleRuns, args.start, args.end, override, raw.text.length)
    figma.graph.updateNode(node.id, { styleRuns: runs })
    return { id: args.id, range: { start: args.start, end: args.end } }
  }
})

export const setTextResize = defineTool({
  name: 'set_text_resize',
  mutates: true,
  description: 'Set text auto-resize mode.',
  params: {
    id: { type: 'string', description: 'Node ID', required: true },
    mode: {
      type: 'string',
      description: 'Resize mode',
      required: true,
      enum: ['NONE', 'WIDTH_AND_HEIGHT', 'HEIGHT', 'TRUNCATE']
    }
  },
  execute: (figma, { id, mode }) => {
    const node = figma.getNodeById(id)
    if (!node) return { error: `Node "${id}" not found` }
    node.textAutoResize = mode
    return { id, textAutoResize: mode }
  }
})

export const setTextProperties = defineTool({
  name: 'set_text_properties',
  mutates: true,
  description:
    'Set text layout properties: alignment, auto-resize, text case, decoration, truncation.',
  params: {
    id: { type: 'string', description: 'Text node ID', required: true },
    align_horizontal: {
      type: 'string',
      description: 'Horizontal text alignment',
      enum: ['LEFT', 'CENTER', 'RIGHT', 'JUSTIFIED']
    },
    align_vertical: {
      type: 'string',
      description: 'Vertical text alignment',
      enum: ['TOP', 'CENTER', 'BOTTOM']
    },
    auto_resize: {
      type: 'string',
      description: 'Text auto-resize mode',
      enum: ['NONE', 'WIDTH_AND_HEIGHT', 'HEIGHT', 'TRUNCATE']
    },
    direction: {
      type: 'string',
      description: 'Text direction',
      enum: ['AUTO', 'LTR', 'RTL']
    },
    text_decoration: {
      type: 'string',
      description: 'Text decoration',
      enum: ['NONE', 'UNDERLINE', 'STRIKETHROUGH']
    }
  },
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
