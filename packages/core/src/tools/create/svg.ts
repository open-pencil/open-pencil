import type { GeometryPath, SceneGraph } from '@open-pencil/scene-graph'
import type { Rect } from '@open-pencil/scene-graph/primitives'

import { parseColor } from '#core/color'
import { createPathStroke } from '#core/icons/path-style'
import { extractPaths } from '#core/icons/svg'
import type { IconPathInfo } from '#core/icons/types'
import { parseSVGPath } from '#core/io/formats/svg/parse-path'
import { defineTool } from '#core/tools/schema'
import { computeAccurateBounds, mergeVectorNetworks, regenerateFillGeometry } from '#core/vector'

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

function fillForPath(path: IconPathInfo, defaultColor: string) {
  if (path.fill && path.fill !== 'none') {
    const color = path.fill === 'currentColor' ? parseColor(defaultColor) : parseColor(path.fill)
    return { type: 'SOLID' as const, color, opacity: 1, visible: true }
  }
  if (path.fill === null && !path.stroke) {
    return { type: 'SOLID' as const, color: parseColor(defaultColor), opacity: 1, visible: true }
  }
  return null
}

/** Flatten filled paths into one multi-color vector: a single merged network
 *  whose regions carry per-path fills — the same representation Figma uses
 *  for imported artwork (per-path fills via fillGeometry styleIDs, #388). */
function createFlattenedVector(
  graph: SceneGraph,
  parentId: string,
  paths: IconPathInfo[],
  viewBox: Rect | null,
  width: number,
  height: number,
  defaultColor: string,
  name: string
) {
  const perPath = paths.map((path) => ({
    network: fitNetworkToNode(parseSVGPath(path.d, path.fillRule), viewBox, width, height),
    fill: fillForPath(path, defaultColor)
  }))

  const merged = mergeVectorNetworks(perPath.map((p) => p.network))
  const bounds = computeAccurateBounds(merged)
  const vectorNetwork = {
    vertices: merged.vertices.map((v) => ({ ...v, x: v.x - bounds.x, y: v.y - bounds.y })),
    segments: merged.segments,
    regions: merged.regions
  }

  // One fillGeometry entry per region, carrying the source path's fill; the
  // command blobs are rebuilt from the network by regenerateFillGeometry.
  const placeholders: GeometryPath[] = []
  perPath.forEach((p, index) => {
    for (const region of p.network.regions) {
      placeholders.push({
        windingRule: region.windingRule,
        commandsBlob: new Uint8Array(0),
        styleID: index + 1,
        ...(p.fill ? { fills: [p.fill] } : {})
      })
    }
  })
  const fillGeometry = regenerateFillGeometry(vectorNetwork, placeholders)

  const firstFill = perPath.find((p) => p.fill)?.fill
  const vector = graph.createNode('VECTOR', parentId, {
    name,
    width: Math.max(bounds.width, 0.01),
    height: Math.max(bounds.height, 0.01),
    vectorNetwork,
    fillGeometry,
    fills: firstFill ? [firstFill] : []
  })
  vector.x = bounds.x
  vector.y = bounds.y
  return vector
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
  const network = fitNetworkToNode(parseSVGPath(path.d, path.fillRule), viewBox, width, height)

  // Size each vector to its own path bounds — full-canvas vectors would all
  // overlap, making selection outlines, hit-testing, and node editing useless.
  const bounds = computeAccurateBounds(network)
  const vectorNetwork = {
    vertices: network.vertices.map((v) => ({ ...v, x: v.x - bounds.x, y: v.y - bounds.y })),
    segments: network.segments,
    regions: network.regions
  }
  const vector = graph.createNode('VECTOR', parentId, {
    name: 'path',
    width: Math.max(bounds.width, 0.01),
    height: Math.max(bounds.height, 0.01),
    vectorNetwork
  })
  vector.x = bounds.x
  vector.y = bounds.y

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
  const name = options.name ?? 'SVG'

  // Filled paths flatten into one multi-color vector; stroked paths keep
  // their own node (the flattened representation has no per-path strokes).
  const flattenable = paths.filter(
    (p) => fillForPath(p, defaultColor) !== null && !(p.stroke && p.stroke !== 'none')
  )
  const separate = paths.filter((p) => !flattenable.includes(p))

  if (separate.length === 0) {
    const vector = createFlattenedVector(
      graph,
      parentId,
      flattenable,
      viewBox,
      width,
      height,
      defaultColor,
      name
    )
    if (options.x !== undefined) vector.x = options.x
    if (options.y !== undefined) vector.y = options.y
    return vector
  }

  const root = graph.createNode('GROUP', parentId, { name, width, height, fills: [] })
  if (options.x !== undefined) root.x = options.x
  if (options.y !== undefined) root.y = options.y

  if (flattenable.length > 0) {
    createFlattenedVector(graph, root.id, flattenable, viewBox, width, height, defaultColor, name)
  }
  for (const path of separate) {
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
