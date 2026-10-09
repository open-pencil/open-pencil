import * as v from 'valibot'

import type { SceneNode } from '@open-pencil/scene-graph'

import { toolNumber, nodeIdInput } from '#core/tools/input'
import { defineTool, nodeNotFound } from '#core/tools/schema'

export const setLayout = defineTool({
  name: 'set_layout',

  description: 'Set auto-layout (flexbox) on a frame. Direction, alignment, spacing, padding.',
  execution: { kind: 'sync', mutation: 'properties' },
  input: v.strictObject({
    id: v.pipe(v.string(), v.description('Frame node ID')),
    direction: v.optional(
      v.pipe(
        v.picklist(['HORIZONTAL', 'VERTICAL']),
        v.description('Layout direction (keeps current if omitted)')
      )
    ),
    spacing: v.optional(
      toolNumber(
        v.pipe(
          v.number(),
          v.minValue(0),
          v.description('Gap between items (only changes if provided)')
        )
      )
    ),
    padding: v.optional(
      toolNumber(
        v.pipe(
          v.number(),
          v.minValue(0),
          v.description('Equal padding on all sides (only changes if provided)')
        )
      )
    ),
    padding_horizontal: v.optional(
      toolNumber(v.pipe(v.number(), v.minValue(0), v.description('Horizontal padding')))
    ),
    padding_vertical: v.optional(
      toolNumber(v.pipe(v.number(), v.minValue(0), v.description('Vertical padding')))
    ),
    align: v.optional(
      v.pipe(
        v.picklist(['MIN', 'CENTER', 'MAX', 'SPACE_BETWEEN']),
        v.description('Primary axis alignment (only changes if provided)')
      )
    ),
    counter_align: v.optional(
      v.pipe(
        v.picklist(['MIN', 'CENTER', 'MAX', 'STRETCH']),
        v.description('Cross axis alignment (only changes if provided)')
      )
    ),
    flow_direction: v.optional(
      v.pipe(
        v.picklist(['AUTO', 'LTR', 'RTL']),
        v.description('Child flow direction for auto-layout. AUTO inherits from parent.')
      )
    )
  }),
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
    if (args.direction) node.layoutMode = args.direction
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

  description: 'Set resize constraints for a node within its parent.',
  execution: { kind: 'sync', mutation: 'properties' },
  input: v.strictObject({
    id: nodeIdInput,
    horizontal: v.optional(
      v.pipe(
        v.picklist(['MIN', 'CENTER', 'MAX', 'STRETCH', 'SCALE']),
        v.description('Horizontal constraint')
      )
    ),
    vertical: v.optional(
      v.pipe(
        v.picklist(['MIN', 'CENTER', 'MAX', 'STRETCH', 'SCALE']),
        v.description('Vertical constraint')
      )
    )
  }),
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

  description:
    'Configure auto-layout child: sizing (FIXED/HUG/FILL), grow, alignment, absolute positioning.',
  execution: { kind: 'sync', mutation: 'properties' },
  input: v.strictObject({
    id: v.pipe(v.string(), v.description('Child node ID')),
    sizing_horizontal: v.optional(
      v.pipe(v.picklist(['FIXED', 'HUG', 'FILL']), v.description('Horizontal sizing mode'))
    ),
    sizing_vertical: v.optional(
      v.pipe(v.picklist(['FIXED', 'HUG', 'FILL']), v.description('Vertical sizing mode'))
    ),
    grow: v.optional(
      toolNumber(
        v.pipe(v.number(), v.minValue(0), v.description('Flex grow factor (0 = fixed, 1 = grow)'))
      )
    ),
    align_self: v.optional(
      v.pipe(
        v.picklist(['INHERIT', 'MIN', 'CENTER', 'MAX', 'STRETCH', 'BASELINE']),
        v.description('Self alignment override (cross-axis)')
      )
    ),
    positioning: v.optional(
      v.pipe(
        v.picklist(['AUTO', 'ABSOLUTE']),
        v.description('ABSOLUTE to take node out of auto-layout flow')
      )
    )
  }),
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
