import { defineTool, nodeNotFound } from '#core/tools/schema'

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

