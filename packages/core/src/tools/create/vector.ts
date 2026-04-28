import { parseColor } from '#core/color'
import { normalizeVectorNetwork, validateVectorNetwork } from '#core/scene-graph'
import { defineTool, nodeSummary } from '#core/tools/schema'

import type { VectorNetwork } from '#core/scene-graph'

export const createVector = defineTool({
  name: 'create_vector',
  mutates: true,
  description: 'Create a vector node with optional path data.',
  params: {
    x: { type: 'number', description: 'X position', required: true },
    y: { type: 'number', description: 'Y position', required: true },
    name: { type: 'string', description: 'Node name' },
    path: { type: 'string', description: 'VectorNetwork JSON' },
    fill: { type: 'color', description: 'Fill color (hex)' },
    stroke: { type: 'color', description: 'Stroke color (hex)' },
    stroke_weight: { type: 'number', description: 'Stroke weight' },
    parent_id: { type: 'string', description: 'Parent node ID' },
  },
  execute: (figma, args) => {
    const node = figma.createVector()
    node.x = args.x
    node.y = args.y
    if (args.name) node.name = args.name
    if (args.path) {
      let parsed: VectorNetwork
      try {
        parsed = JSON.parse(args.path) as VectorNetwork
      } catch {
        return { error: 'Invalid JSON in path parameter' }
      }
      const errors = validateVectorNetwork(parsed)
      if (errors.length > 0) return { error: `Invalid VectorNetwork: ${errors.join('; ')}` }
      figma.graph.updateNode(node.id, { vectorNetwork: normalizeVectorNetwork(parsed) })
    }
    if (args.fill) {
      node.fills = [{ type: 'SOLID', color: parseColor(args.fill), opacity: 1, visible: true }]
    }
    if (args.stroke) {
      node.strokes = [
        {
          color: parseColor(args.stroke),
          weight: args.stroke_weight ?? 1,
          opacity: 1,
          visible: true,
          align: 'CENTER',
        },
      ]
    }
    if (args.parent_id) {
      const parent = figma.getNodeById(args.parent_id)
      if (parent) parent.appendChild(node)
    }
    return nodeSummary(node)
  },
})
