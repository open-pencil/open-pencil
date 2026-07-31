import { safeDestr } from 'destr'

import { normalizeVectorNetwork, validateVectorNetwork } from '@open-pencil/scene-graph'
import type { VectorNetwork } from '@open-pencil/scene-graph'
import { parseSVGPath } from '@open-pencil/scene-graph/parse-path'

import { parseColor } from '#core/color'
import { defineTool, nodeSummary } from '#core/tools/schema'

/** An SVG path always opens with an absolute or relative moveto. */
function isSVGPathData(path: string): boolean {
  return /^[Mm]/.test(path.trim())
}

/**
 * Accept either an SVG path `d` string or VectorNetwork JSON. Callers are
 * overwhelmingly language models, which emit `d` strings by default —
 * VectorNetwork is an internal, index-based format they cannot reliably guess.
 */
function parseVectorPath(path: string): VectorNetwork | { error: string } {
  if (isSVGPathData(path)) {
    const network = parseSVGPath(path)
    if (network.vertices.length === 0) return { error: 'SVG path data produced no geometry' }
    return network
  }
  let parsed: VectorNetwork
  try {
    parsed = safeDestr<VectorNetwork>(path)
  } catch {
    return { error: 'path must be an SVG path string (starting with M) or VectorNetwork JSON' }
  }
  const errors = validateVectorNetwork(parsed)
  if (errors.length > 0) return { error: `Invalid VectorNetwork: ${errors.join('; ')}` }
  return parsed
}

export const createVector = defineTool({
  name: 'create_vector',
  mutates: true,
  description: 'Create a vector node with optional path data.',
  params: {
    x: { type: 'number', description: 'X position', required: true },
    y: { type: 'number', description: 'Y position', required: true },
    name: { type: 'string', description: 'Node name' },
    path: {
      type: 'string',
      description:
        'Geometry, as either an SVG path string (e.g. "M50 0 L61 35 L98 35 L68 57 L79 91 L50 70 L21 91 L32 57 L2 35 L39 35 Z") or VectorNetwork JSON of the form {"vertices":[{"x":0,"y":0}],"segments":[{"start":0,"end":1,"tangentStart":{"x":0,"y":0},"tangentEnd":{"x":0,"y":0}}],"regions":[{"windingRule":"NONZERO","loops":[[0]]}]} where segments index into vertices and loops index into segments'
    },
    fill: { type: 'color', description: 'Fill color (hex)' },
    stroke: { type: 'color', description: 'Stroke color (hex)' },
    stroke_weight: { type: 'number', description: 'Stroke weight' },
    parent_id: { type: 'string', description: 'Parent node ID' }
  },
  execute: (figma, args) => {
    // Resolve the path before creating anything: bailing out afterwards used to
    // leave an invisible zero-geometry node behind on every rejected attempt.
    let network: VectorNetwork | null = null
    if (args.path) {
      const parsed = parseVectorPath(args.path)
      if ('error' in parsed) return parsed
      network = parsed
    }

    const node = figma.createVector()
    node.x = args.x
    node.y = args.y
    if (args.name) node.name = args.name
    if (network) {
      figma.graph.updateNode(node.id, { vectorNetwork: normalizeVectorNetwork(network) })
    }
    if (args.fill) {
      node.fills = [{ type: 'SOLID', color: parseColor(args.fill), opacity: 1, visible: true }]
    }
    if (args.stroke) {
      figma.graph.updateNode(node.id, {
        strokes: [
          {
            color: parseColor(args.stroke),
            weight: args.stroke_weight ?? 1,
            opacity: 1,
            visible: true,
            align: 'CENTER'
          }
        ]
      })
    }
    if (args.parent_id) {
      const parent = figma.getNodeById(args.parent_id)
      if (parent) parent.appendChild(node)
    }
    return nodeSummary(node)
  }
})
