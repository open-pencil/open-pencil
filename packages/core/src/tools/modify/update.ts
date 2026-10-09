import * as v from 'valibot'

import type { SceneNode } from '@open-pencil/scene-graph'

import { assertNodeEditable } from '#core/editor/capabilities'
import { toolNumber, nodeIdInput } from '#core/tools/input'
import { defineTool, nodeNotFound } from '#core/tools/schema'

export const updateNode = defineTool({
  name: 'update_node',

  description:
    'Update properties of an existing node: position, size, opacity, corner radius, visibility, text, font.',
  execution: { kind: 'sync', mutation: 'properties' },
  input: v.strictObject({
    id: nodeIdInput,
    x: v.optional(toolNumber(v.pipe(v.number(), v.description('X position')))),
    y: v.optional(toolNumber(v.pipe(v.number(), v.description('Y position')))),
    width: v.optional(toolNumber(v.pipe(v.number(), v.minValue(1), v.description('Width')))),
    height: v.optional(toolNumber(v.pipe(v.number(), v.minValue(1), v.description('Height')))),
    opacity: v.optional(
      toolNumber(v.pipe(v.number(), v.minValue(0), v.maxValue(1), v.description('Opacity (0-1)')))
    ),
    corner_radius: v.optional(
      toolNumber(v.pipe(v.number(), v.minValue(0), v.description('Corner radius')))
    ),
    visible: v.optional(v.pipe(v.boolean(), v.description('Visibility'))),
    text: v.optional(v.pipe(v.string(), v.description('Text content (TEXT nodes)'))),
    text_direction: v.optional(
      v.pipe(v.picklist(['AUTO', 'LTR', 'RTL']), v.description('Text direction for TEXT nodes'))
    ),
    flow_direction: v.optional(
      v.pipe(
        v.picklist(['AUTO', 'LTR', 'RTL']),
        v.description('Auto-layout flow direction for FRAME nodes')
      )
    ),
    font_size: v.optional(
      toolNumber(v.pipe(v.number(), v.minValue(1), v.description('Font size')))
    ),
    font_weight: v.optional(
      toolNumber(
        v.pipe(v.number(), v.minValue(100), v.maxValue(900), v.description('Font weight (100-900)'))
      )
    ),
    name: v.optional(v.pipe(v.string(), v.description('Layer name')))
  }),
  execute: (figma, args) => {
    const node = figma.getNodeById(args.id)
    if (!node) return nodeNotFound(args.id)
    assertNodeEditable(figma.graph, args.id)
    const updated: string[] = []
    if (args.x !== undefined) {
      node.x = args.x
      updated.push('x')
    }
    if (args.y !== undefined) {
      node.y = args.y
      updated.push('y')
    }
    if (args.width !== undefined || args.height !== undefined) {
      node.resize(args.width ?? node.width, args.height ?? node.height)
      updated.push('size')
    }
    if (args.opacity !== undefined) {
      node.opacity = args.opacity
      updated.push('opacity')
    }
    if (args.corner_radius !== undefined) {
      node.cornerRadius = args.corner_radius
      updated.push('cornerRadius')
    }
    if (args.visible !== undefined) {
      node.visible = args.visible
      updated.push('visible')
    }
    if (args.name !== undefined) {
      node.name = args.name
      updated.push('name')
    }
    if (args.text !== undefined) {
      figma.graph.updateNode(node.id, { text: args.text })
      updated.push('text')
    }
    if (args.text_direction !== undefined) {
      figma.graph.updateNode(node.id, {
        textDirection: args.text_direction as SceneNode['textDirection']
      })
      updated.push('textDirection')
    }
    if (args.flow_direction !== undefined) {
      figma.graph.updateNode(node.id, {
        layoutDirection: args.flow_direction as SceneNode['layoutDirection']
      })
      updated.push('layoutDirection')
    }
    if (args.font_size !== undefined) {
      figma.graph.updateNode(node.id, { fontSize: args.font_size })
      updated.push('fontSize')
    }
    if (args.font_weight !== undefined) {
      figma.graph.updateNode(node.id, { fontWeight: args.font_weight })
      updated.push('fontWeight')
    }
    return { id: args.id, updated }
  }
})
