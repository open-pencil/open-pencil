import * as v from 'valibot'

import { transformVectorNetwork } from '@open-pencil/scene-graph'
import type { VectorNetwork } from '@open-pencil/scene-graph'
import { parseColor } from '@open-pencil/scene-graph/color'
import { parseSVGPath } from '@open-pencil/scene-graph/parse-path'

import { toolNumber, positionInputs } from '#core/tools/input'
import { defineTool, nodeSummary } from '#core/tools/schema'
import { parseVectorNetworkJSON } from '#core/tools/vector/network'
import { computeAccurateBounds } from '#core/vector/curve-math'

interface ParsedVectorPath {
  network: VectorNetwork
  size: { width: number; height: number } | null
}

type VectorPathResult = ParsedVectorPath | { error: string }

function parseSVGVectorPath(path: string): VectorPathResult {
  const network = parseSVGPath(path)
  if (network.segments.length === 0) {
    return { error: 'SVG path data must contain at least one drawable segment' }
  }

  const bounds = computeAccurateBounds(network)
  return {
    network: transformVectorNetwork([1, 0, -bounds.x, 0, 1, -bounds.y, 0, 0, 1], network),
    size: { width: bounds.width, height: bounds.height }
  }
}

function parseVectorPath(path: string): VectorPathResult {
  const trimmed = path.trim()
  if (/^[Mm]/.test(trimmed)) return parseSVGVectorPath(trimmed)
  const parsed = parseVectorNetworkJSON(trimmed)
  return 'error' in parsed ? parsed : { network: parsed.network, size: null }
}

export const createVector = defineTool({
  name: 'create_vector',

  description: 'Create a vector node from SVG path data or a VectorNetwork.',
  execution: { kind: 'sync', mutation: 'document' },
  input: v.strictObject({
    ...positionInputs,
    name: v.optional(v.pipe(v.string(), v.description('Node name'))),
    path: v.optional(
      v.pipe(
        v.string(),
        v.description(
          'SVG path data (preferred, e.g. "M0 0 L100 0 L50 80 Z") or VectorNetwork JSON, e.g. {"vertices":[{"x":0,"y":0},{"x":10,"y":0}],"segments":[{"start":0,"end":1}],"regions":[]}'
        )
      )
    ),
    fill: v.optional(v.pipe(v.string(), v.description('Fill color (hex)'))),
    stroke: v.optional(v.pipe(v.string(), v.description('Stroke color (hex)'))),
    stroke_weight: v.optional(toolNumber(v.pipe(v.number(), v.description('Stroke weight')))),
    parent_id: v.optional(v.pipe(v.string(), v.description('Parent node ID')))
  }),
  execute: (figma, args) => {
    let parsedPath: ParsedVectorPath | null = null
    if (args.path !== undefined) {
      const parsed = parseVectorPath(args.path)
      if ('error' in parsed) return parsed
      parsedPath = parsed
    }

    const node = figma.createVector()
    node.x = args.x
    node.y = args.y
    if (args.name) node.name = args.name
    if (parsedPath) {
      figma.graph.updateNode(node.id, { vectorNetwork: parsedPath.network })
      if (parsedPath.size) node.resize(parsedPath.size.width, parsedPath.size.height)
    }
    if (args.fill) {
      node.fills = [{ type: 'SOLID', color: parseColor(args.fill), opacity: 1, visible: true }]
    }
    if (args.stroke) {
      figma.graph.updateNode(node.id, {
        strokes: [
          {
            type: 'SOLID',
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
