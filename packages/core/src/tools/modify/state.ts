import * as v from 'valibot'

import { nodeIdInputSchema, defineTool } from '#core/tools/schema'

export const setBlend = defineTool({
  name: 'set_blend',

  description: 'Set blend mode of a node.',
  execution: { kind: 'sync', mutation: 'properties' },
  input: v.strictObject({
    id: nodeIdInputSchema,
    mode: v.pipe(
      v.picklist([
        'NORMAL',
        'DARKEN',
        'MULTIPLY',
        'LINEAR_BURN',
        'COLOR_BURN',
        'LIGHTEN',
        'SCREEN',
        'LINEAR_DODGE',
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
      ]),
      v.description('Blend mode')
    )
  }),
  execute: (figma, { id, mode }) => {
    const node = figma.getNodeById(id)
    if (!node) return { error: `Node "${id}" not found` }
    node.blendMode = mode
    return { id, blendMode: mode }
  }
})
