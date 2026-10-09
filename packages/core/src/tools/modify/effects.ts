import * as v from 'valibot'

import { parseColor } from '@open-pencil/scene-graph/color'

import { DEFAULT_SHADOW_COLOR } from '#core/constants'
import type { FigmaEffect } from '#core/figma-api/effects'
import { toolNumber, nodeIdInput } from '#core/tools/input'
import { defineTool, nodeNotFound } from '#core/tools/schema'

export const setEffects = defineTool({
  name: 'set_effects',

  description:
    'Set effects on a node (drop shadow, inner shadow, blur). Pass an array or a single effect.',
  execution: { kind: 'sync', mutation: 'properties' },
  input: v.strictObject({
    id: nodeIdInput,
    type: v.pipe(
      v.picklist(['DROP_SHADOW', 'INNER_SHADOW', 'FOREGROUND_BLUR', 'BACKGROUND_BLUR']),
      v.description('Effect type')
    ),
    color: v.optional(v.pipe(v.string(), v.description('Shadow color (hex). Ignored for blur.'))),
    offset_x: v.optional(toolNumber(v.pipe(v.number(), v.description('Shadow X offset'))), 0),
    offset_y: v.optional(toolNumber(v.pipe(v.number(), v.description('Shadow Y offset'))), 4),
    radius: v.optional(
      toolNumber(v.pipe(v.number(), v.minValue(0), v.description('Blur radius'))),
      4
    ),
    spread: v.optional(toolNumber(v.pipe(v.number(), v.description('Shadow spread'))), 0)
  }),
  execute: (figma, args) => {
    const node = figma.getNodeById(args.id)
    if (!node) return nodeNotFound(args.id)

    const effect: FigmaEffect =
      args.type === 'FOREGROUND_BLUR' || args.type === 'BACKGROUND_BLUR'
        ? {
            type: args.type === 'BACKGROUND_BLUR' ? 'BACKGROUND_BLUR' : 'LAYER_BLUR',
            radius: args.radius,
            visible: true,
            blurType: 'NORMAL'
          }
        : {
            type: args.type,
            color: args.color ? parseColor(args.color) : { ...DEFAULT_SHADOW_COLOR },
            offset: { x: args.offset_x, y: args.offset_y },
            radius: args.radius,
            spread: args.spread,
            visible: true,
            blendMode: 'NORMAL'
          }

    node.effects = [...node.effects, effect]
    return { id: args.id, effects: node.effects.length }
  }
})
