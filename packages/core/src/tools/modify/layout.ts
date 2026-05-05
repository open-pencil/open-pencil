import type { SceneNode } from '#core/scene-graph'
import { defineTool, nodeNotFound } from '#core/tools/schema'

export const setLayout = defineTool({
  name: 'set_layout',
  mutates: true,
  description: 'Set auto-layout (flexbox) on a frame. Direction, alignment, spacing, padding.',
  params: {
    id: { type: 'string', description: 'Frame node ID', required: true },
    direction: {
      type: 'string',
      description: 'Layout direction (keeps current if omitted)',
      enum: ['HORIZONTAL', 'VERTICAL']
    },
    spacing: {
      type: 'number',
      description: 'Gap between items (only changes if provided)',
      min: 0
    },
    padding: {
      type: 'number',
      description: 'Equal padding on all sides (only changes if provided)',
      min: 0
    },
    padding_horizontal: { type: 'number', description: 'Horizontal padding', min: 0 },
    padding_vertical: { type: 'number', description: 'Vertical padding', min: 0 },
    align: {
      type: 'string',
      description: 'Primary axis alignment (only changes if provided)',
      enum: ['MIN', 'CENTER', 'MAX', 'SPACE_BETWEEN']
    },
    counter_align: {
      type: 'string',
      description: 'Cross axis alignment (only changes if provided)',
      enum: ['MIN', 'CENTER', 'MAX', 'STRETCH']
    },
    flow_direction: {
      type: 'string',
      description: 'Child flow direction for auto-layout. AUTO inherits from parent.',
      enum: ['AUTO', 'LTR', 'RTL']
    }
  },
  execute: (figma, args) => {
    const node = figma.getNodeById(args.id)
    if (!node) return nodeNotFound(args.id)

    const raw = figma.graph.getNode(args.id)
    if (!args.direction && raw?.layoutMode === 'NONE') {
      return {
        error: 'Frame has no auto-layout. Pass direction ("HORIZONTAL" or "VERTICAL") to enable it.'
      }
    }

    const wasNone = raw?.layoutMode === 'NONE'
    if (args.direction) node.layoutMode = args.direction as 'HORIZONTAL' | 'VERTICAL'
    if (wasNone) {
      node.primaryAxisSizingMode = 'AUTO'
      node.counterAxisSizingMode = 'AUTO'
    }
    if (args.spacing !== undefined) node.itemSpacing = args.spacing
    if (args.align !== undefined) node.primaryAxisAlignItems = args.align
    if (args.counter_align !== undefined) node.counterAxisAlignItems = args.counter_align
    if (args.flow_direction !== undefined)
      node.layoutDirection = args.flow_direction as SceneNode['layoutDirection']

    if (args.padding !== undefined) {
      node.paddingTop = args.padding
      node.paddingRight = args.padding
      node.paddingBottom = args.padding
      node.paddingLeft = args.padding
    }
    if (args.padding_horizontal !== undefined) {
      node.paddingLeft = args.padding_horizontal
      node.paddingRight = args.padding_horizontal
    }
    if (args.padding_vertical !== undefined) {
      node.paddingTop = args.padding_vertical
      node.paddingBottom = args.padding_vertical
    }

    return { id: args.id, spacing: node.itemSpacing }
  }
})

export const setConstraints = defineTool({
  name: 'set_constraints',
  mutates: true,
  description: 'Set resize constraints for a node within its parent.',
  params: {
    id: { type: 'string', description: 'Node ID', required: true },
    horizontal: {
      type: 'string',
      description: 'Horizontal constraint',
      enum: ['MIN', 'CENTER', 'MAX', 'STRETCH', 'SCALE']
    },
    vertical: {
      type: 'string',
      description: 'Vertical constraint',
      enum: ['MIN', 'CENTER', 'MAX', 'STRETCH', 'SCALE']
    }
  },
  execute: (figma, args) => {
    const node = figma.getNodeById(args.id)
    if (!node) return nodeNotFound(args.id)
    if (args.horizontal || args.vertical) {
      node.constraints = {
        horizontal: args.horizontal ?? node.constraints.horizontal,
        vertical: args.vertical ?? node.constraints.vertical
      }
    }
    return { id: args.id, constraints: node.constraints }
  }
})

export const setLayoutChild = defineTool({
  name: 'set_layout_child',
  mutates: true,
  description:
    'Configure auto-layout child: sizing (FIXED/HUG/FILL), grow, alignment, absolute positioning.',
  params: {
    id: { type: 'string', description: 'Child node ID', required: true },
    sizing_horizontal: {
      type: 'string',
      description: 'Horizontal sizing mode',
      enum: ['FIXED', 'HUG', 'FILL']
    },
    sizing_vertical: {
      type: 'string',
      description: 'Vertical sizing mode',
      enum: ['FIXED', 'HUG', 'FILL']
    },
    grow: { type: 'number', description: 'Flex grow factor (0 = fixed, 1 = grow)', min: 0 },
    align_self: {
      type: 'string',
      description: 'Self alignment override (cross-axis)',
      enum: ['INHERIT', 'MIN', 'CENTER', 'MAX', 'STRETCH', 'BASELINE']
    },
    positioning: {
      type: 'string',
      description: 'ABSOLUTE to take node out of auto-layout flow',
      enum: ['AUTO', 'ABSOLUTE']
    }
  },
  execute: (figma, args) => {
    const node = figma.getNodeById(args.id)
    if (!node) return nodeNotFound(args.id)
    const updated: string[] = []
    if (args.sizing_horizontal !== undefined) {
      node.layoutSizingHorizontal = args.sizing_horizontal
      updated.push('layoutSizingHorizontal')
    }
    if (args.sizing_vertical !== undefined) {
      node.layoutSizingVertical = args.sizing_vertical
      updated.push('layoutSizingVertical')
    }
    if (args.grow !== undefined) {
      node.layoutGrow = args.grow
      updated.push('layoutGrow')
    }
    if (args.align_self !== undefined) {
      node.layoutAlign = args.align_self
      updated.push('layoutAlign')
    }
    if (args.positioning !== undefined) {
      node.layoutPositioning = args.positioning
      updated.push('layoutPositioning')
    }
    return { id: args.id, updated }
  }
})
