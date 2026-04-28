import { defineTool } from '#core/tools/schema'

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

