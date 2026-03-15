/* eslint-disable max-lines -- property setters share common patterns, splitting would scatter related tools */
import { parseColor } from '../color'
import { DEFAULT_SHADOW_COLOR } from '../constants'
import type { CharacterStyleOverride, Effect, StyleRun } from '../scene-graph'
import type { Matrix } from '../types'

import { defineTool } from './schema'

export const setFill = defineTool({
  name: 'set_fill',
  mutates: true,
  description: 'Set fill on a node. Solid: color="#ff0000". Linear gradient: gradient="top-bottom" or "left-right" with color (start) and color_end (end).',
  params: {
    id: { type: 'string', description: 'Node ID', required: true },
    color: { type: 'color', description: 'Color (hex). For gradient: start color.', required: true },
    color_end: { type: 'color', description: 'End color for gradient (if omitted, solid fill)' },
    gradient: {
      type: 'string',
      description: 'Gradient direction',
      enum: ['top-bottom', 'bottom-top', 'left-right', 'right-left']
    }
  },
  execute: (figma, { id, color, color_end, gradient }) => {
    const node = figma.getNodeById(id)
    if (!node) return { error: `Node "${id}" not found` }

    const c = parseColor(color)

    if (gradient && color_end) {
      const cEnd = parseColor(color_end)
      const transforms: Record<string, Matrix> = {
        'top-bottom': { m00: 0, m01: 1, m02: 0, m10: -1, m11: 0, m12: 1 },
        'bottom-top': { m00: 0, m01: -1, m02: 1, m10: 1, m11: 0, m12: 0 },
        'left-right': { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 },
        'right-left': { m00: -1, m01: 0, m02: 1, m10: 0, m11: -1, m12: 1 }
      }
      node.fills = [{
        type: 'GRADIENT_LINEAR',
        color: c,
        opacity: 1,
        visible: true,
        gradientStops: [
          { position: 0, color: c },
          { position: 1, color: cEnd }
        ],
        gradientTransform: transforms[gradient] ?? transforms['top-bottom']
      }]
      return { id, gradient, start: c, end: cEnd }
    }

    node.fills = [{ type: 'SOLID', color: c, opacity: 1, visible: true }]
    return { id, color: c }
  }
})

export const setStroke = defineTool({
  name: 'set_stroke',
  mutates: true,
  description: 'Set the stroke (border) of a node.',
  params: {
    id: { type: 'string', description: 'Node ID', required: true },
    color: { type: 'color', description: 'Stroke color (hex)', required: true },
    weight: { type: 'number', description: 'Stroke weight', default: 1, min: 0.1 },
    align: {
      type: 'string',
      description: 'Stroke alignment',
      default: 'INSIDE',
      enum: ['INSIDE', 'CENTER', 'OUTSIDE']
    }
  },
  execute: (figma, { id, color, weight, align }) => {
    const node = figma.getNodeById(id)
    if (!node) return { error: `Node "${id}" not found` }

    const c = parseColor(color)
    node.strokes = [
      {
        color: c,
        weight: weight ?? 1,
        opacity: 1,
        visible: true,
        align: (align ?? 'INSIDE') as 'INSIDE' | 'CENTER' | 'OUTSIDE'
      }
    ]
    return { id, color: c, weight: weight ?? 1 }
  }
})

export const setEffects = defineTool({
  name: 'set_effects',
  mutates: true,
  description:
    'Set effects on a node (drop shadow, inner shadow, blur). Pass an array or a single effect.',
  params: {
    id: { type: 'string', description: 'Node ID', required: true },
    type: {
      type: 'string',
      description: 'Effect type',
      required: true,
      enum: ['DROP_SHADOW', 'INNER_SHADOW', 'FOREGROUND_BLUR', 'BACKGROUND_BLUR']
    },
    color: { type: 'color', description: 'Shadow color (hex). Ignored for blur.' },
    offset_x: { type: 'number', description: 'Shadow X offset', default: 0 },
    offset_y: { type: 'number', description: 'Shadow Y offset', default: 4 },
    radius: { type: 'number', description: 'Blur radius', default: 4, min: 0 },
    spread: { type: 'number', description: 'Shadow spread', default: 0 }
  },
  execute: (figma, args) => {
    const node = figma.getNodeById(args.id)
    if (!node) return { error: `Node "${args.id}" not found` }

    const isBlur = args.type === 'FOREGROUND_BLUR' || args.type === 'BACKGROUND_BLUR'
    const color = isBlur
      ? { r: 0, g: 0, b: 0, a: 0 }
      : (args.color ? parseColor(args.color) : { ...DEFAULT_SHADOW_COLOR })
    const effect: Effect = {
      type: args.type as Effect['type'],
      visible: true,
      radius: args.radius ?? 4,
      color,
      offset: { x: isBlur ? 0 : (args.offset_x ?? 0), y: isBlur ? 0 : (args.offset_y ?? 4) },
      spread: isBlur ? 0 : (args.spread ?? 0)
    }

    node.effects = [...node.effects, effect]
    return { id: args.id, effects: node.effects.length }
  }
})

export const updateNode = defineTool({
  name: 'update_node',
  mutates: true,
  description:
    'Update properties of an existing node: position, size, opacity, corner radius, visibility, text, font.',
  params: {
    id: { type: 'string', description: 'Node ID', required: true },
    x: { type: 'number', description: 'X position' },
    y: { type: 'number', description: 'Y position' },
    width: { type: 'number', description: 'Width', min: 1 },
    height: { type: 'number', description: 'Height', min: 1 },
    opacity: { type: 'number', description: 'Opacity (0-1)', min: 0, max: 1 },
    corner_radius: { type: 'number', description: 'Corner radius', min: 0 },
    visible: { type: 'boolean', description: 'Visibility' },
    text: { type: 'string', description: 'Text content (TEXT nodes)' },
    font_size: { type: 'number', description: 'Font size', min: 1 },
    font_weight: { type: 'number', description: 'Font weight (100-900)' },
    name: { type: 'string', description: 'Layer name' }
  },
  execute: (figma, args) => {
    const node = figma.getNodeById(args.id)
    if (!node) return { error: `Node "${args.id}" not found` }
    const updated: string[] = []
    if (args.x !== undefined) {
      node.x = args.x
      updated.push('x')
    }
    if (args.y !== undefined) {
      node.y = args.y
      updated.push('y')
    }
    if (args.width !== undefined || args.height !== undefined) {
      node.resize(args.width ?? node.width, args.height ?? node.height)
      updated.push('size')
    }
    if (args.opacity !== undefined) {
      node.opacity = args.opacity
      updated.push('opacity')
    }
    if (args.corner_radius !== undefined) {
      node.cornerRadius = args.corner_radius
      updated.push('cornerRadius')
    }
    if (args.visible !== undefined) {
      node.visible = args.visible
      updated.push('visible')
    }
    if (args.name !== undefined) {
      node.name = args.name
      updated.push('name')
    }
    if (args.text !== undefined) {
      figma.graph.updateNode(node.id, { text: args.text })
      updated.push('text')
    }
    if (args.font_size !== undefined) {
      figma.graph.updateNode(node.id, { fontSize: args.font_size })
      updated.push('fontSize')
    }
    if (args.font_weight !== undefined) {
      figma.graph.updateNode(node.id, { fontWeight: args.font_weight })
      updated.push('fontWeight')
    }
    return { id: args.id, updated }
  }
})

export const setLayout = defineTool({
  name: 'set_layout',
  mutates: true,
  description: 'Set auto-layout (flexbox) on a frame. Direction, alignment, spacing, padding.',
  params: {
    id: { type: 'string', description: 'Frame node ID', required: true },
    direction: {
      type: 'string',
      description: 'Layout direction (keeps current if omitted)',
      enum: ['HORIZONTAL', 'VERTICAL']
    },
    spacing: { type: 'number', description: 'Gap between items (only changes if provided)', min: 0 },
    padding: { type: 'number', description: 'Equal padding on all sides (only changes if provided)', min: 0 },
    padding_horizontal: { type: 'number', description: 'Horizontal padding', min: 0 },
    padding_vertical: { type: 'number', description: 'Vertical padding', min: 0 },
    align: {
      type: 'string',
      description: 'Primary axis alignment (only changes if provided)',
      enum: ['MIN', 'CENTER', 'MAX', 'SPACE_BETWEEN']
    },
    counter_align: {
      type: 'string',
      description: 'Cross axis alignment (only changes if provided)',
      enum: ['MIN', 'CENTER', 'MAX', 'STRETCH']
    }
  },
  execute: (figma, args) => {
    const node = figma.getNodeById(args.id)
    if (!node) return { error: `Node "${args.id}" not found` }

    const raw = figma.graph.getNode(args.id)
    if (!args.direction && raw?.layoutMode === 'NONE') {
      return { error: 'Frame has no auto-layout. Pass direction ("HORIZONTAL" or "VERTICAL") to enable it.' }
    }

    if (args.direction) node.layoutMode = args.direction as 'HORIZONTAL' | 'VERTICAL'
    if (args.spacing !== undefined) node.itemSpacing = args.spacing
    if (args.align !== undefined) node.primaryAxisAlignItems = args.align
    if (args.counter_align !== undefined) node.counterAxisAlignItems = args.counter_align

    if (args.padding !== undefined) {
      node.paddingTop = args.padding
      node.paddingRight = args.padding
      node.paddingBottom = args.padding
      node.paddingLeft = args.padding
    }
    if (args.padding_horizontal !== undefined) {
      node.paddingLeft = args.padding_horizontal
      node.paddingRight = args.padding_horizontal
    }
    if (args.padding_vertical !== undefined) {
      node.paddingTop = args.padding_vertical
      node.paddingBottom = args.padding_vertical
    }

    return { id: args.id, spacing: node.itemSpacing }
  }
})

export const setConstraints = defineTool({
  name: 'set_constraints',
  mutates: true,
  description: 'Set resize constraints for a node within its parent.',
  params: {
    id: { type: 'string', description: 'Node ID', required: true },
    horizontal: {
      type: 'string',
      description: 'Horizontal constraint',
      enum: ['MIN', 'CENTER', 'MAX', 'STRETCH', 'SCALE']
    },
    vertical: {
      type: 'string',
      description: 'Vertical constraint',
      enum: ['MIN', 'CENTER', 'MAX', 'STRETCH', 'SCALE']
    }
  },
  execute: (figma, args) => {
    const node = figma.getNodeById(args.id)
    if (!node) return { error: `Node "${args.id}" not found` }
    if (args.horizontal || args.vertical) {
      node.constraints = {
        horizontal: args.horizontal ?? node.constraints.horizontal,
        vertical: args.vertical ?? node.constraints.vertical
      }
    }
    return { id: args.id, constraints: node.constraints }
  }
})

export const setRotation = defineTool({
  name: 'set_rotation',
  mutates: true,
  description: 'Set rotation angle of a node in degrees.',
  params: {
    id: { type: 'string', description: 'Node ID', required: true },
    angle: { type: 'number', description: 'Rotation angle in degrees', required: true }
  },
  execute: (figma, { id, angle }) => {
    const node = figma.getNodeById(id)
    if (!node) return { error: `Node "${id}" not found` }
    node.rotation = angle
    return { id, rotation: angle }
  }
})

export const setOpacity = defineTool({
  name: 'set_opacity',
  mutates: true,
  description: 'Set opacity of a node (0-1).',
  params: {
    id: { type: 'string', description: 'Node ID', required: true },
    value: { type: 'number', description: 'Opacity (0-1)', required: true, min: 0, max: 1 }
  },
  execute: (figma, { id, value }) => {
    const node = figma.getNodeById(id)
    if (!node) return { error: `Node "${id}" not found` }
    node.opacity = value
    return { id, opacity: value }
  }
})

export const setRadius = defineTool({
  name: 'set_radius',
  mutates: true,
  description: 'Set corner radius. Use individual corners for independent values.',
  params: {
    id: { type: 'string', description: 'Node ID', required: true },
    radius: { type: 'number', description: 'Corner radius for all corners', min: 0 },
    top_left: { type: 'number', description: 'Top-left radius', min: 0 },
    top_right: { type: 'number', description: 'Top-right radius', min: 0 },
    bottom_right: { type: 'number', description: 'Bottom-right radius', min: 0 },
    bottom_left: { type: 'number', description: 'Bottom-left radius', min: 0 }
  },
  execute: (figma, args) => {
    const node = figma.getNodeById(args.id)
    if (!node) return { error: `Node "${args.id}" not found` }
    if (args.radius !== undefined) {
      node.cornerRadius = args.radius
    }
    if (args.top_left !== undefined) node.topLeftRadius = args.top_left
    if (args.top_right !== undefined) node.topRightRadius = args.top_right
    if (args.bottom_right !== undefined) node.bottomRightRadius = args.bottom_right
    if (args.bottom_left !== undefined) node.bottomLeftRadius = args.bottom_left
    const cr = node.cornerRadius
    if (typeof cr === 'number') {
      return { id: args.id, cornerRadius: cr }
    }
    return {
      id: args.id,
      topLeftRadius: node.topLeftRadius,
      topRightRadius: node.topRightRadius,
      bottomRightRadius: node.bottomRightRadius,
      bottomLeftRadius: node.bottomLeftRadius
    }
  }
})

export const setMinMax = defineTool({
  name: 'set_minmax',
  mutates: true,
  description: 'Set min/max width and height constraints on a node.',
  params: {
    id: { type: 'string', description: 'Node ID', required: true },
    min_width: { type: 'number', description: 'Minimum width', min: 0 },
    max_width: { type: 'number', description: 'Maximum width', min: 0 },
    min_height: { type: 'number', description: 'Minimum height', min: 0 },
    max_height: { type: 'number', description: 'Maximum height', min: 0 }
  },
  execute: (figma, args) => {
    const node = figma.getNodeById(args.id)
    if (!node) return { error: `Node "${args.id}" not found` }
    if (args.min_width !== undefined) node.minWidth = args.min_width
    if (args.max_width !== undefined) node.maxWidth = args.max_width
    if (args.min_height !== undefined) node.minHeight = args.min_height
    if (args.max_height !== undefined) node.maxHeight = args.max_height
    return {
      id: args.id,
      minWidth: node.minWidth,
      maxWidth: node.maxWidth,
      minHeight: node.minHeight,
      maxHeight: node.maxHeight
    }
  }
})

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
    if (!node) return { error: `Node "${args.id}" not found` }
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
    if (!node) return { error: `Node "${args.id}" not found` }
    const style: CharacterStyleOverride = {}
    if (args.family) style.fontFamily = args.family
    if (args.size) style.fontSize = args.size
    if (args.style === 'italic' || args.style === 'Italic') style.italic = true
    const run: StyleRun = {
      start: args.start,
      length: args.end - args.start,
      style
    }
    figma.graph.updateNode(node.id, {
      styleRuns: [...(figma.graph.getNode(node.id)?.styleRuns ?? []), run]
    })
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

export const setVisible = defineTool({
  name: 'set_visible',
  mutates: true,
  description: 'Set visibility of a node.',
  params: {
    id: { type: 'string', description: 'Node ID', required: true },
    value: { type: 'boolean', description: 'Visible (true/false)', required: true }
  },
  execute: (figma, { id, value }) => {
    const node = figma.getNodeById(id)
    if (!node) return { error: `Node "${id}" not found` }
    node.visible = value
    return { id, visible: value }
  }
})

export const setBlend = defineTool({
  name: 'set_blend',
  mutates: true,
  description: 'Set blend mode of a node.',
  params: {
    id: { type: 'string', description: 'Node ID', required: true },
    mode: {
      type: 'string',
      description: 'Blend mode',
      required: true,
      enum: [
        'NORMAL',
        'DARKEN',
        'MULTIPLY',
        'COLOR_BURN',
        'LIGHTEN',
        'SCREEN',
        'COLOR_DODGE',
        'OVERLAY',
        'SOFT_LIGHT',
        'HARD_LIGHT',
        'DIFFERENCE',
        'EXCLUSION',
        'HUE',
        'SATURATION',
        'COLOR',
        'LUMINOSITY'
      ]
    }
  },
  execute: (figma, { id, mode }) => {
    const node = figma.getNodeById(id)
    if (!node) return { error: `Node "${id}" not found` }
    node.blendMode = mode
    return { id, blendMode: mode }
  }
})

export const setLocked = defineTool({
  name: 'set_locked',
  mutates: true,
  description: 'Set locked state of a node.',
  params: {
    id: { type: 'string', description: 'Node ID', required: true },
    value: { type: 'boolean', description: 'Locked (true/false)', required: true }
  },
  execute: (figma, { id, value }) => {
    const node = figma.getNodeById(id)
    if (!node) return { error: `Node "${id}" not found` }
    node.locked = value
    return { id, locked: value }
  }
})

export const setStrokeAlign = defineTool({
  name: 'set_stroke_align',
  mutates: true,
  description: 'Set stroke alignment of a node.',
  params: {
    id: { type: 'string', description: 'Node ID', required: true },
    align: {
      type: 'string',
      description: 'Stroke alignment',
      required: true,
      enum: ['INSIDE', 'CENTER', 'OUTSIDE']
    }
  },
  execute: (figma, { id, align }) => {
    const node = figma.getNodeById(id)
    if (!node) return { error: `Node "${id}" not found` }
    node.strokeAlign = align
    return { id, strokeAlign: align }
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
    text_decoration: {
      type: 'string',
      description: 'Text decoration',
      enum: ['NONE', 'UNDERLINE', 'STRIKETHROUGH']
    }
  },
  execute: (figma, args) => {
    const node = figma.getNodeById(args.id)
    if (!node) return { error: `Node "${args.id}" not found` }
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
    if (args.text_decoration !== undefined) {
      node.textDecoration = args.text_decoration
      updated.push('textDecoration')
    }
    return { id: args.id, updated }
  }
})

export const setLayoutChild = defineTool({
  name: 'set_layout_child',
  mutates: true,
  description:
    'Configure auto-layout child: sizing (FIXED/HUG/FILL), grow, alignment, absolute positioning.',
  params: {
    id: { type: 'string', description: 'Child node ID', required: true },
    sizing_horizontal: {
      type: 'string',
      description: 'Horizontal sizing mode',
      enum: ['FIXED', 'HUG', 'FILL']
    },
    sizing_vertical: {
      type: 'string',
      description: 'Vertical sizing mode',
      enum: ['FIXED', 'HUG', 'FILL']
    },
    grow: { type: 'number', description: 'Flex grow factor (0 = fixed, 1 = grow)', min: 0 },
    align_self: {
      type: 'string',
      description: 'Self alignment override (cross-axis)',
      enum: ['INHERIT', 'MIN', 'CENTER', 'MAX', 'STRETCH', 'BASELINE']
    },
    positioning: {
      type: 'string',
      description: 'ABSOLUTE to take node out of auto-layout flow',
      enum: ['AUTO', 'ABSOLUTE']
    }
  },
  execute: (figma, args) => {
    const node = figma.getNodeById(args.id)
    if (!node) return { error: `Node "${args.id}" not found` }
    const updated: string[] = []
    if (args.sizing_horizontal !== undefined) {
      node.layoutSizingHorizontal = args.sizing_horizontal
      updated.push('layoutSizingHorizontal')
    }
    if (args.sizing_vertical !== undefined) {
      node.layoutSizingVertical = args.sizing_vertical
      updated.push('layoutSizingVertical')
    }
    if (args.grow !== undefined) {
      node.layoutGrow = args.grow
      updated.push('layoutGrow')
    }
    if (args.align_self !== undefined) {
      node.layoutAlign = args.align_self
      updated.push('layoutAlign')
    }
    if (args.positioning !== undefined) {
      node.layoutPositioning = args.positioning
      updated.push('layoutPositioning')
    }
    return { id: args.id, updated }
  }
})

export const setImageFill = defineTool({
  name: 'set_image_fill',
  mutates: true,
  description: 'Set an image fill on a node from base64-encoded image data.',
  params: {
    id: { type: 'string', description: 'Node ID', required: true },
    image_data: { type: 'string', description: 'Base64-encoded image bytes (PNG, JPEG, or WEBP)', required: true },
    scale_mode: {
      type: 'string',
      description: 'Image scale mode',
      default: 'FILL',
      enum: ['FILL', 'FIT', 'CROP', 'TILE']
    }
  },
  execute: (figma, { id, image_data, scale_mode }) => {
    const node = figma.getNodeById(id)
    if (!node) return { error: `Node "${id}" not found` }
    const bytes = Uint8Array.fromBase64(image_data)
    const image = figma.createImage(bytes)
    const mode = (scale_mode ?? 'FILL') as 'FILL' | 'FIT' | 'CROP' | 'TILE'
    node.fills = [{
      type: 'IMAGE',
      color: { r: 0, g: 0, b: 0, a: 1 },
      opacity: 1,
      visible: true,
      imageHash: image.hash,
      imageScaleMode: mode
    }]
    return { id, imageHash: image.hash, scaleMode: mode }
  }
})
