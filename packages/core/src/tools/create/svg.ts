import type { SceneGraph } from '@open-pencil/scene-graph'
import type { Rect } from '@open-pencil/scene-graph/primitives'

import { parseColor } from '#core/color'
import { createPathStroke } from '#core/icons/path-style'
import { extractPaths } from '#core/icons/svg'
import type { IconPathInfo } from '#core/icons/types'
import { parseSVGPath } from '#core/io/formats/svg/parse-path'
import { defineTool } from '#core/tools/schema'

function parseSvgViewBox(svg: string): Rect | null {
  const match = svg.match(/viewBox="([^"]+)"/)
  if (!match) return null
  const [x, y, w, h] = match[1].split(/[\s,]+/).map(Number)
  if ([x, y, w, h].some((n) => !Number.isFinite(n))) return null
  return { x, y, width: w, height: h }
}

function parseSvgDimension(svg: string, attr: string): number | null {
  const match = svg.match(new RegExp(`\\b${attr}="([^"]+)"`))
  if (!match) return null
  const n = Number.parseFloat(match[1])
  return Number.isFinite(n) && n > 0 ? n : null
}

function parseSvgSize(svg: string): { width: number; height: number } {
  const viewBox = parseSvgViewBox(svg)
  const w = parseSvgDimension(svg, 'width')
  const h = parseSvgDimension(svg, 'height')
  if (w && h) return { width: w, height: h }
  if (viewBox) return { width: viewBox.width, height: viewBox.height }
  return { width: 24, height: 24 }
}

/** Map a parsed network from viewBox units into node-space pixels. */
function fitNetworkToNode(
  network: ReturnType<typeof parseSVGPath>,
  viewBox: Rect | null,
  width: number,
  height: number
) {
  if (!viewBox || viewBox.width <= 0 || viewBox.height <= 0) return network
  const sx = width / viewBox.width
  const sy = height / viewBox.height
  if (sx === 1 && sy === 1 && viewBox.x === 0 && viewBox.y === 0) return network
  return {
    vertices: network.vertices.map((v) => ({
      ...v,
      x: (v.x - viewBox.x) * sx,
      y: (v.y - viewBox.y) * sy
    })),
    segments: network.segments.map((seg) => ({
      ...seg,
      tangentStart: { x: seg.tangentStart.x * sx, y: seg.tangentStart.y * sy },
      tangentEnd: { x: seg.tangentEnd.x * sx, y: seg.tangentEnd.y * sy }
    })),
    regions: network.regions
  }
}

function createVectorFromPath(
  graph: SceneGraph,
  path: IconPathInfo,
  viewBox: Rect | null,
  width: number,
  height: number,
  parentId: string,
  defaultColor: string
) {
  const vectorNetwork = fitNetworkToNode(
    parseSVGPath(path.d, path.fillRule),
    viewBox,
    width,
    height
  )
  const vector = graph.createNode('VECTOR', parentId, {
    name: 'path',
    width,
    height,
    vectorNetwork
  })
  vector.x = 0
  vector.y = 0

  if (path.fill && path.fill !== 'none') {
    const fillColor =
      path.fill === 'currentColor' ? parseColor(defaultColor) : parseColor(path.fill)
    graph.updateNode(vector.id, {
      fills: [{ type: 'SOLID', color: fillColor, opacity: 1, visible: true }]
    })
  } else if (path.fill === null && !path.stroke) {
    const fillColor = parseColor(defaultColor)
    graph.updateNode(vector.id, {
      fills: [{ type: 'SOLID', color: fillColor, opacity: 1, visible: true }]
    })
  } else {
    graph.updateNode(vector.id, { fills: [] })
  }

  if (path.stroke && path.stroke !== 'none') {
    const strokeColor =
      path.stroke === 'currentColor' ? parseColor(defaultColor) : parseColor(path.stroke)
    graph.updateNode(vector.id, {
      strokes: [createPathStroke(strokeColor, path.strokeWidth, path.strokeCap, path.strokeJoin)]
    })
  }

  return vector
}

export interface CreateSvgNodesOptions {
  name?: string
  color?: string
  x?: number
  y?: number
}

/** Parse SVG markup into a group of vector nodes (group resize scales the
 *  vectors). Returns the group root, or null when the markup contains no
 *  supported elements. */
export function createSvgNodes(
  graph: SceneGraph,
  parentId: string,
  svg: string,
  options: CreateSvgNodesOptions = {}
) {
  const paths = extractPaths(svg)
  if (paths.length === 0) return null

  const { width, height } = parseSvgSize(svg)
  const viewBox = parseSvgViewBox(svg)
  const defaultColor = options.color ?? '#000000'

  const root = graph.createNode('GROUP', parentId, {
    name: options.name ?? 'SVG',
    width,
    height,
    fills: []
  })
  if (options.x !== undefined) root.x = options.x
  if (options.y !== undefined) root.y = options.y

  for (const path of paths) {
    createVectorFromPath(graph, path, viewBox, width, height, root.id, defaultColor)
  }
  return root
}

export const importSvg = defineTool({
  name: 'import_svg',
  mutates: true,
  description:
    'Import raw SVG markup onto the canvas. Parses <path>, <circle>, <ellipse>, <rect>, <line>, <polygon>, <polyline> elements and creates vector nodes. Supports fill, stroke, stroke-width, viewBox sizing.',
  params: {
    svg: {
      type: 'string',
      description: 'SVG markup string (e.g. \'<svg viewBox="0 0 24 24"><path d="M..."/></svg>\')',
      required: true
    },
    name: { type: 'string', description: 'Name for the created frame (default: "SVG")' },
    color: {
      type: 'color',
      description: 'Default color for currentColor fills/strokes (default: #000000)'
    },
    parent_id: { type: 'string', description: 'Parent node ID' },
    x: { type: 'number', description: 'X position' },
    y: { type: 'number', description: 'Y position' }
  },
  execute: async (figma, args) => {
    const svg = args.svg
    if (!svg || typeof svg !== 'string') return { error: 'svg parameter is required' }

    const frame = createSvgNodes(figma.graph, args.parent_id ?? figma.currentPage.id, svg, {
      name: args.name,
      color: args.color,
      x: args.x,
      y: args.y
    })
    if (!frame) return { error: 'No supported SVG elements found in the markup' }

    return { id: frame.id, name: frame.name, type: frame.type }
  }
})
