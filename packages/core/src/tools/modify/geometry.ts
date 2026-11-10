import * as v from 'valibot'

import { toolNumber, nodeIdInputSchema, defineTool, nodeNotFound } from '#core/tools/schema'

export const setRadius = defineTool({
  name: 'set_radius',

  description: 'Set corner radius. Use individual corners for independent values.',
  execution: { kind: 'sync', mutation: 'properties' },
  input: v.strictObject({
    id: nodeIdInputSchema,
    radius: v.optional(
      toolNumber(v.pipe(v.number(), v.minValue(0), v.description('Corner radius for all corners')))
    ),
    top_left: v.optional(
      toolNumber(v.pipe(v.number(), v.minValue(0), v.description('Top-left radius')))
    ),
    top_right: v.optional(
      toolNumber(v.pipe(v.number(), v.minValue(0), v.description('Top-right radius')))
    ),
    bottom_right: v.optional(
      toolNumber(v.pipe(v.number(), v.minValue(0), v.description('Bottom-right radius')))
    ),
    bottom_left: v.optional(
      toolNumber(v.pipe(v.number(), v.minValue(0), v.description('Bottom-left radius')))
    )
  }),
  execute: (figma, args) => {
    const node = figma.getNodeById(args.id)
    if (!node) return nodeNotFound(args.id)
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

  description: 'Set min/max width and height constraints on a node.',
  execution: { kind: 'sync', mutation: 'properties' },
  input: v.strictObject({
    id: nodeIdInputSchema,
    min_width: v.optional(
      toolNumber(v.pipe(v.number(), v.minValue(0), v.description('Minimum width')))
    ),
    max_width: v.optional(
      toolNumber(v.pipe(v.number(), v.minValue(0), v.description('Maximum width')))
    ),
    min_height: v.optional(
      toolNumber(v.pipe(v.number(), v.minValue(0), v.description('Minimum height')))
    ),
    max_height: v.optional(
      toolNumber(v.pipe(v.number(), v.minValue(0), v.description('Maximum height')))
    )
  }),
  execute: (figma, args) => {
    const node = figma.getNodeById(args.id)
    if (!node) return nodeNotFound(args.id)
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
