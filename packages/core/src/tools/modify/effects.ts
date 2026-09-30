import * as v from 'valibot'

import type { Effect } from '@open-pencil/scene-graph'
import { parseColor } from '@open-pencil/scene-graph/color'

import { DEFAULT_SHADOW_COLOR, TRANSPARENT } from '#core/constants'
import { toolNumber, nodeIdInput } from '#core/tools/input'
import { defineTool, nodeNotFound } from '#core/tools/schema'

export const setEffects = defineTool({
  name: 'set_effects',

  description:
    'Set effects on a node (drop shadow, inner shadow, blur). Pass an array or a single effect.',
  execution: { kind: 'sync', mutation: 'properties' },
  input: v.object({
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

    const isBlur = args.type === 'FOREGROUND_BLUR' || args.type === 'BACKGROUND_BLUR'
    let color = { ...DEFAULT_SHADOW_COLOR }
    if (isBlur) color = { ...TRANSPARENT }
    else if (args.color) color = parseColor(args.color)
    const effect: Effect = {
      type: args.type as Effect['type'],
      visible: true,
      radius: args.radius,
      color,
      offset: { x: isBlur ? 0 : args.offset_x, y: isBlur ? 0 : args.offset_y },
      spread: isBlur ? 0 : args.spread
    }

    node.effects = [...node.effects, effect]
    return { id: args.id, effects: node.effects.length }
  }
})
