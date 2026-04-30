import { parseColor } from '#core/color'
import { defineTool } from '#core/tools/schema'

import type { Matrix } from '#core/types'

export const setFill = defineTool({
  name: 'set_fill',
  mutates: true,
  description:
    'Set fill on a node. Solid: color="#ff0000". Linear gradient: gradient="top-bottom" or "left-right" with color (start) and color_end (end).',
  params: {
    id: { type: 'string', description: 'Node ID', required: true },
    color: {
      type: 'color',
      description: 'Color (hex). For gradient: start color.',
      required: true
    },
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
      node.fills = [
        {
          type: 'GRADIENT_LINEAR',
          color: c,
          opacity: 1,
          visible: true,
          gradientStops: [
            { position: 0, color: c },
            { position: 1, color: cEnd }
          ],
          gradientTransform: transforms[gradient] ?? transforms['top-bottom']
        }
      ]
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

export const setImageFill = defineTool({
  name: 'set_image_fill',
  mutates: true,
  description: 'Set an image fill on a node from base64-encoded image data.',
  params: {
    id: { type: 'string', description: 'Node ID', required: true },
    image_data: {
      type: 'string',
      description: 'Base64-encoded image bytes (PNG, JPEG, or WEBP)',
      required: true
    },
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
    node.fills = [
      {
        type: 'IMAGE',
        color: { r: 0, g: 0, b: 0, a: 1 },
        opacity: 1,
        visible: true,
        imageHash: image.hash,
        imageScaleMode: mode
      }
    ]
    return { id, imageHash: image.hash, scaleMode: mode }
  }
})
