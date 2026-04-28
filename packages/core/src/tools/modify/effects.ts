import { parseColor } from '#core/color'
import { DEFAULT_SHADOW_COLOR } from '#core/constants'
import { defineTool, nodeNotFound } from '#core/tools/schema'

import type { Effect } from '#core/scene-graph'

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
    if (!node) return nodeNotFound(args.id)

    const isBlur = args.type === 'FOREGROUND_BLUR' || args.type === 'BACKGROUND_BLUR'
    let color = { ...DEFAULT_SHADOW_COLOR }
    if (isBlur) color = { r: 0, g: 0, b: 0, a: 0 }
    else if (args.color) color = parseColor(args.color)
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

