import { isValid, toUint8Array } from 'js-base64'
import * as v from 'valibot'

import { parseColor } from '@open-pencil/scene-graph/color'
import type { Matrix } from '@open-pencil/scene-graph/primitives'

import { BLACK } from '#core/constants'
import { toolNumber, nodeIdInput } from '#core/tools/input'
import { defineTool } from '#core/tools/schema'

export const setFill = defineTool({
  name: 'set_fill',

  description:
    'Set fill on a node. Solid: color="#ff0000". Linear gradient: gradient="top-bottom" or "left-right" with color (start) and color_end (end).',
  execution: { kind: 'sync', mutation: 'properties' },
  input: v.object({
    id: nodeIdInput,
    color: v.pipe(v.string(), v.description('Color (hex). For gradient: start color.')),
    color_end: v.optional(
      v.pipe(v.string(), v.description('End color for gradient (if omitted, solid fill)'))
    ),
    gradient: v.optional(
      v.pipe(
        v.picklist(['top-bottom', 'bottom-top', 'left-right', 'right-left']),
        v.description('Gradient direction')
      )
    )
  }),
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

  description: 'Set the stroke (border) of a node.',
  execution: { kind: 'sync', mutation: 'properties' },
  input: v.object({
    id: nodeIdInput,
    color: v.pipe(v.string(), v.description('Stroke color (hex)')),
    weight: v.optional(
      toolNumber(v.pipe(v.number(), v.minValue(0.1), v.description('Stroke weight'))),
      1
    ),
    align: v.optional(
      v.pipe(v.picklist(['INSIDE', 'CENTER', 'OUTSIDE']), v.description('Stroke alignment')),
      'INSIDE'
    )
  }),
  execute: (figma, { id, color, weight, align }) => {
    const node = figma.getNodeById(id)
    if (!node) return { error: `Node "${id}" not found` }

    const c = parseColor(color)
    node.strokes = [
      {
        color: c,
        weight: weight,
        opacity: 1,
        visible: true,
        align
      }
    ]
    return { id, color: c, weight: weight }
  }
})

export const setImageFill = defineTool({
  name: 'set_image_fill',

  description: 'Set an image fill on a node from base64-encoded image data.',
  execution: { kind: 'sync', mutation: 'document' },
  input: v.object({
    id: nodeIdInput,
    image_data: v.pipe(
      v.string(),
      v.description('Base64-encoded image bytes (PNG, JPEG, or WEBP)')
    ),
    scale_mode: v.optional(
      v.pipe(v.picklist(['FILL', 'FIT', 'CROP', 'TILE']), v.description('Image scale mode')),
      'FILL'
    )
  }),
  execute: (figma, { id, image_data, scale_mode }) => {
    const node = figma.getNodeById(id)
    if (!node) return { error: `Node "${id}" not found` }
    if (!isValid(image_data)) return { error: 'image_data is not valid Base64' }
    const bytes = toUint8Array(image_data)
    const image = figma.createImage(bytes)
    const mode = scale_mode
    node.fills = [
      {
        type: 'IMAGE',
        color: BLACK,
        opacity: 1,
        visible: true,
        imageHash: image.hash,
        imageScaleMode: mode
      }
    ]
    return { id, imageHash: image.hash, scaleMode: mode }
  }
})
