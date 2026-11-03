import * as v from 'valibot'

import { IMAGE_ADJUSTMENT_KEYS, type ImageAdjustments } from '@lawha/scene-graph'

import { cleanAdjustments } from '#core/canvas/image-adjust'
import { defineTool, nodeIdInputSchema, toolNumber } from '#core/tools/schema'

const amountSchema = v.optional(toolNumber(v.pipe(v.number(), v.minValue(-1), v.maxValue(1))))

export const setImageAdjustments = defineTool({
  name: 'set_image_adjustments',
  description:
    'Adjust an image fill like a photo editor, non-destructively (the image itself is kept): exposure, contrast, brightness, saturation, vibrance, temperature (warm +, cool −), tint (magenta +, green −), highlights, shadows, hue (±1 = ±180°), each −1…1 with 0 unchanged, plus invert, input levels (black/white point 0–1, gamma 0.1–10) and a tone curve (points x,y 0–1, smooth monotone; [{x:0,y:0},{x:1,y:1}] is unchanged). Omitted values keep their current setting; reset: true clears every adjustment first. Saved to .fig (Figma shows the eight it supports) and baked into SVG/PDF exports.',
  execution: { kind: 'sync', mutation: 'document' },
  input: v.strictObject({
    id: nodeIdInputSchema,
    fill_index: v.optional(
      v.pipe(
        v.number(),
        v.integer(),
        v.minValue(0),
        v.description('Which fill; default the first image fill')
      )
    ),
    exposure: amountSchema,
    contrast: amountSchema,
    brightness: amountSchema,
    saturation: amountSchema,
    vibrance: amountSchema,
    temperature: amountSchema,
    tint: amountSchema,
    highlights: amountSchema,
    shadows: amountSchema,
    hue: amountSchema,
    invert: v.optional(v.boolean()),
    levels: v.optional(
      v.strictObject({
        black: v.pipe(v.number(), v.minValue(0), v.maxValue(1)),
        white: v.pipe(v.number(), v.minValue(0), v.maxValue(1)),
        gamma: v.pipe(v.number(), v.minValue(0.1), v.maxValue(10))
      })
    ),
    curve: v.optional(
      v.pipe(
        v.array(
          v.strictObject({
            x: v.pipe(v.number(), v.minValue(0), v.maxValue(1)),
            y: v.pipe(v.number(), v.minValue(0), v.maxValue(1))
          })
        ),
        v.maxLength(32)
      )
    ),
    reset: v.optional(v.boolean(), false)
  }),
  execute: (figma, args) => {
    const node = figma.graph.getNode(args.id)
    if (!node) return { error: `Node ${args.id} not found` }
    const index = args.fill_index ?? node.fills.findIndex((f) => f.type === 'IMAGE')
    const fill = node.fills[index] as (typeof node.fills)[number] | undefined
    if (fill?.type !== 'IMAGE') return { error: 'That layer has no image fill there' }
    const merged: ImageAdjustments = args.reset ? {} : { ...fill.adjustments }
    for (const key of IMAGE_ADJUSTMENT_KEYS) {
      const value = args[key]
      if (value !== undefined) merged[key] = value
    }
    if (args.invert !== undefined) merged.invert = args.invert
    if (args.levels) merged.levels = args.levels
    if (args.curve) merged.curve = [...args.curve].sort((a, b) => a.x - b.x)
    const clean = cleanAdjustments(merged)
    const { adjustments: _previous, ...rest } = fill
    const fills = node.fills.map((f, i) =>
      i === index ? (Object.keys(clean).length > 0 ? { ...rest, adjustments: clean } : rest) : f
    )
    figma.graph.updateNode(node.id, { fills })
    return { id: node.id, fill_index: index, adjustments: clean }
  }
})
