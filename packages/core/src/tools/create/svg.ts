import { parseColor } from '#core/color'
import { createPathStroke } from '#core/icons/path-style'
import { extractPaths } from '#core/icons/svg'
import type { IconPathInfo } from '#core/icons/types'
import { parseSVGPath } from '#core/io/formats/svg/parse-path'
import { defineTool } from '#core/tools/schema'

import type { Rect } from '#core/types'

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
  const n = parseFloat(match[1])
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

function createVectorFromPath(
  figma: Parameters<Parameters<typeof defineTool>[0]['execute']>[0],
  path: IconPathInfo,
  width: number,
  height: number,
  parentId: string,
  defaultColor: string
) {
  const vectorNetwork = parseSVGPath(path.d, path.fillRule)
  const vector = figma.graph.createNode('VECTOR', parentId, {
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
    figma.graph.updateNode(vector.id, {
      fills: [{ type: 'SOLID', color: fillColor, opacity: 1, visible: true }]
    })
  } else if (path.fill === null && !path.stroke) {
    const fillColor = parseColor(defaultColor)
    figma.graph.updateNode(vector.id, {
      fills: [{ type: 'SOLID', color: fillColor, opacity: 1, visible: true }]
    })
  } else {
    figma.graph.updateNode(vector.id, { fills: [] })
  }

  if (path.stroke && path.stroke !== 'none') {
    const strokeColor =
      path.stroke === 'currentColor' ? parseColor(defaultColor) : parseColor(path.stroke)
    figma.graph.updateNode(vector.id, {
      strokes: [createPathStroke(strokeColor, path.strokeWidth, path.strokeCap, path.strokeJoin)]
    })
  }

  return vector
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

    const paths = extractPaths(svg)
    if (paths.length === 0) return { error: 'No supported SVG elements found in the markup' }

    const { width, height } = parseSvgSize(svg)
    const defaultColor = args.color ?? '#000000'
    const parentId = args.parent_id ?? figma.currentPage.id

    const frame = figma.graph.createNode('FRAME', parentId, {
      name: args.name ?? 'SVG',
      width,
      height,
      fills: []
    })

    if (args.x !== undefined) frame.x = args.x
    if (args.y !== undefined) frame.y = args.y

    for (const path of paths) {
      createVectorFromPath(figma, path, width, height, frame.id, defaultColor)
    }

    return { id: frame.id, name: frame.name, type: frame.type }
  }
})
