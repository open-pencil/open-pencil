import { SceneGraph } from '@open-pencil/scene-graph'
import type {
  Color,
  Fill,
  SceneNode,
  Stroke,
  StrokeCap,
  TextAlignVertical,
  VectorNetwork
} from '@open-pencil/scene-graph'
import { parseSVGPath } from '@open-pencil/scene-graph/parse-path'

import { BLACK } from '#core/constants'

import type { DrawioCell, DrawioPage } from './document'
import { parseLabel, type RunFormat } from './label'
import { routeEdge, type Box, type Point } from './route'
import { shapeGeometry, swimlaneHeader } from './shapes'
import { styleColor, styleNumber, type DrawioStyle } from './style'

/** The plugin data namespace every OpenPencil plugin-data call uses. */
const PLUGIN_ID = 'open-pencil'
const HORIZONTAL_ALIGN: Record<string, SceneNode['textAlignHorizontal']> = {
  left: 'LEFT',
  center: 'CENTER',
  right: 'RIGHT'
}
const VERTICAL_ALIGN: Record<string, TextAlignVertical> = {
  top: 'TOP',
  middle: 'CENTER',
  bottom: 'BOTTOM'
}
const WHITE: Color = { r: 1, g: 1, b: 1, a: 1 }
const DEFAULT_FONT_SIZE = 12
const DEFAULT_FONT_FAMILY = 'Inter'
/** draw.io labels sit this far inside their shape unless the style says otherwise. */
const DEFAULT_SPACING = 2
/** The width of a character as a share of the font size, for sizing an edge's label. */
const CHARACTER_WIDTH = 0.56
const LINE_HEIGHT = 1.25
/** The corner radius draw.io gives a rounded edge. */
const EDGE_CORNER_RADIUS = 10
const OPEN_ARROWS = new Set(['open', 'openThin', 'async'])

function solid(color: Color): Fill {
  return { type: 'SOLID', color: { ...color, a: 1 }, opacity: color.a, visible: true }
}

function pluginData(cell: DrawioCell): SceneNode['pluginData'] {
  const entries = {
    'drawio-id': cell.id,
    'drawio-tooltip': cell.meta.tooltip,
    'drawio-link': cell.meta.link
  }
  return Object.entries(entries)
    .filter((entry): entry is [string, string] => !!entry[1])
    .map(([key, value]) => ({ pluginId: PLUGIN_ID, key, value }))
}

/** The dashes of a line: `dashPattern` counts in line widths, as draw.io draws it. */
function dashes(style: DrawioStyle, weight: number): number[] | undefined {
  if (style.dashed !== '1') return undefined
  const parts = (style.dashPattern ?? '3 3')
    .split(/\s+/)
    .map(Number)
    .filter((value) => Number.isFinite(value) && value > 0)
  const scale = Math.max(weight, 1)
  return (parts.length > 0 ? parts : [3, 3]).map((value) => value * scale)
}

function strokeOf(style: DrawioStyle, fallback: Color | null): Stroke[] {
  const color = style.strokeColor === 'none' ? null : (styleColor(style, 'strokeColor') ?? fallback)
  if (!color) return []
  const weight = styleNumber(style, 'strokeWidth', 1)
  const stroke: Stroke = { ...solid(color), weight, align: 'CENTER' }
  const dashPattern = dashes(style, weight)
  if (dashPattern) stroke.dashPattern = dashPattern
  return [stroke]
}

function fillOf(style: DrawioStyle, fallback: Color | null): Fill[] {
  const color = style.fillColor === 'none' ? null : (styleColor(style, 'fillColor') ?? fallback)
  return color ? [solid(color)] : []
}

function baseFormat(style: DrawioStyle): RunFormat {
  const bits = styleNumber(style, 'fontStyle', 0)
  const family = style.fontFamily?.replace(/["']/g, '').split(',')[0].trim()
  return {
    bold: (bits & 1) !== 0,
    italic: (bits & 2) !== 0,
    underline: (bits & 4) !== 0,
    size: styleNumber(style, 'fontSize', DEFAULT_FONT_SIZE),
    color: style.fontColor && style.fontColor !== 'default' ? style.fontColor : '#000000',
    family: !family || /^(helvetica|arial)$/i.test(family) ? DEFAULT_FONT_FAMILY : family
  }
}

function textNode(cell: DrawioCell, box: Box, graph: SceneGraph, parentId: string): void {
  const style = cell.style
  const base = baseFormat(style)
  const label = parseLabel(cell.value, style.html === '1', base)
  if (label.text.trim().length === 0) return
  const align = style.align ?? 'center'
  const verticalAlign = style.verticalAlign ?? 'middle'
  const vertical = VERTICAL_ALIGN[verticalAlign] ?? 'CENTER'
  const color = styleColor({ c: base.color }, 'c') ?? BLACK
  graph.createNode('TEXT', parentId, {
    name: label.text.split('\n')[0].slice(0, 60),
    text: label.text,
    x: box.x,
    y: box.y,
    width: Math.max(box.width, 1),
    height: Math.max(box.height, 1),
    fontSize: base.size,
    fontFamily: base.family,
    fontWeight: base.bold ? 700 : 400,
    italic: base.italic,
    textDecoration: base.underline ? 'UNDERLINE' : 'NONE',
    textAlignHorizontal: HORIZONTAL_ALIGN[align] ?? 'CENTER',
    textAlignVertical: vertical,
    textAutoResize: 'NONE',
    fills: [solid(color)],
    styleRuns: label.runs
  })
}

/** Where a vertex's label goes: inside the shape, or under it for shapes that hang it below. */
function labelBox(style: DrawioStyle, width: number, height: number): Box {
  const spacing = styleNumber(style, 'spacing', DEFAULT_SPACING)
  const left = styleNumber(style, 'spacingLeft', 0) + spacing
  const right = styleNumber(style, 'spacingRight', 0) + spacing
  const top = styleNumber(style, 'spacingTop', 0) + spacing
  const bottom = styleNumber(style, 'spacingBottom', 0) + spacing
  // A swimlane's title sits in its title bar.
  if (style.swimlane !== undefined || style.shape === 'swimlane') {
    const header = swimlaneHeader(style, width, height)
    if (style.horizontal === '0')
      return { x: 0, y: top, width: header, height: height - top - bottom }
    return { x: left, y: 0, width: width - left - right, height: header }
  }
  if (style.verticalLabelPosition === 'bottom') {
    const size = styleNumber(style, 'fontSize', DEFAULT_FONT_SIZE)
    return { x: left, y: height + top, width: width - left - right, height: size * LINE_HEIGHT * 2 }
  }
  return { x: left, y: top, width: width - left - right, height: height - top - bottom }
}

function vectorNode(
  graph: SceneGraph,
  parentId: string,
  name: string,
  network: VectorNetwork,
  box: Box,
  fills: Fill[],
  strokes: Stroke[]
): SceneNode {
  return graph.createNode('VECTOR', parentId, {
    name,
    x: box.x,
    y: box.y,
    width: box.width,
    height: box.height,
    vectorNetwork: network,
    fills,
    strokes
  })
}

/** Creates a shape's frame at `box`, in the coordinates of `parentId`, and returns its id. */
function createVertex(cell: DrawioCell, box: Box, graph: SceneGraph, parentId: string): string {
  const style = cell.style
  const bare = style.text !== undefined || style.shape === 'text'
  const fill = fillOf(style, bare ? null : WHITE)
  const strokes = strokeOf(style, bare ? null : BLACK)
  const geometry = shapeGeometry(style, box.width, box.height)
  const radius =
    style.rounded === '1' && geometry.kind === 'rect'
      ? (Math.min(box.width, box.height) * styleNumber(style, 'arcSize', 15)) / 100
      : 0
  const opacity = styleNumber(style, 'opacity', 100) / 100
  const label = parseLabel(cell.value, style.html === '1', baseFormat(style)).text
  const frame = graph.createNode('FRAME', parentId, {
    name: label.split('\n')[0].slice(0, 60) || cell.id,
    x: box.x,
    y: box.y,
    width: box.width,
    height: box.height,
    clipsContent: false,
    opacity,
    pluginData: pluginData(cell),
    fills: geometry.kind === 'rect' ? fill : [],
    strokes: geometry.kind === 'rect' ? strokes : [],
    cornerRadius: radius,
    dashPattern: geometry.kind === 'rect' ? (strokes[0]?.dashPattern ?? []) : []
  })
  const inner = { x: 0, y: 0, width: box.width, height: box.height }
  if (geometry.kind === 'ellipse') {
    graph.createNode('ELLIPSE', frame.id, { name: 'Shape', ...inner, fills: fill, strokes })
  } else if (geometry.kind === 'path' && geometry.path) {
    const network = parseSVGPath(geometry.path)
    vectorNode(graph, frame.id, 'Shape', network, inner, geometry.outlineOnly ? [] : fill, strokes)
    if (geometry.outline) {
      vectorNode(graph, frame.id, 'Outline', parseSVGPath(geometry.outline), inner, [], strokes)
    }
  }
  textNode(cell, labelBox(style, box.width, box.height), graph, frame.id)
  return frame.id
}

function arrowCap(name: string | undefined, fallback: string): StrokeCap | null {
  const arrow = name ?? fallback
  if (arrow === 'none') return null
  return OPEN_ARROWS.has(arrow) ? 'ARROW_LINES' : 'ARROW_EQUILATERAL'
}

function bounds(points: Point[]): Box {
  const xs = points.map((p) => p.x)
  const ys = points.map((p) => p.y)
  const x = Math.min(...xs)
  const y = Math.min(...ys)
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y }
}

/** The point halfway along the line, where draw.io draws an edge's label. */
function midpoint(points: Point[]): Point {
  const lengths = points.slice(1).map((p, i) => Math.hypot(p.x - points[i].x, p.y - points[i].y))
  let remaining = lengths.reduce((sum, length) => sum + length, 0) / 2
  for (const [i, length] of lengths.entries()) {
    if (remaining <= length || i === lengths.length - 1) {
      const t = length === 0 ? 0 : Math.min(remaining / length, 1)
      return {
        x: points[i].x + (points[i + 1].x - points[i].x) * t,
        y: points[i].y + (points[i + 1].y - points[i].y) * t
      }
    }
    remaining -= length
  }
  return points[0]
}

function createEdge(cell: DrawioCell, points: Point[], graph: SceneGraph, parentId: string): void {
  if (points.length < 2) return
  const style = cell.style
  const area = bounds(points)
  const label = parseLabel(cell.value, style.html === '1', baseFormat(style)).text
  const frame = graph.createNode('FRAME', parentId, {
    name: label ? `Arrow: ${label.split('\n')[0].slice(0, 50)}` : 'Arrow',
    x: area.x,
    y: area.y,
    width: area.width,
    height: area.height,
    clipsContent: false,
    pluginData: pluginData(cell),
    fills: [],
    strokes: []
  })
  const local = points.map((p) => ({ x: p.x - area.x, y: p.y - area.y }))
  const network = parseSVGPath(`M${local.map((p) => `${p.x} ${p.y}`).join('L')}`)
  if (style.rounded === '1') {
    for (const vertex of network.vertices.slice(1, -1)) vertex.cornerRadius = EDGE_CORNER_RADIUS
  }
  const start = arrowCap(style.startArrow, 'none')
  const end = arrowCap(style.endArrow, 'classic')
  if (start && network.vertices.length > 0) network.vertices[0].strokeCap = start
  if (end && network.vertices.length > 0) {
    network.vertices[network.vertices.length - 1].strokeCap = end
  }
  vectorNode(
    graph,
    frame.id,
    'Line',
    network,
    { x: 0, y: 0, width: area.width, height: area.height },
    [],
    strokeOf(style, BLACK)
  )
  if (label) createEdgeLabel(cell, label, midpoint(local), graph, frame.id)
}

function createEdgeLabel(
  cell: DrawioCell,
  label: string,
  at: Point,
  graph: SceneGraph,
  parentId: string
): void {
  const style = cell.style
  const size = styleNumber(style, 'fontSize', DEFAULT_FONT_SIZE)
  const lines = label.split('\n')
  const width =
    Math.ceil(Math.max(...lines.map((line) => line.length)) * size * CHARACTER_WIDTH) + 8
  const height = Math.ceil(lines.length * size * LINE_HEIGHT) + 4
  const background = styleColor(style, 'labelBackgroundColor')
  const holder = graph.createNode('FRAME', parentId, {
    name: 'Label',
    x: at.x - width / 2,
    y: at.y - height / 2,
    width,
    height,
    clipsContent: false,
    fills: background ? [solid(background)] : [],
    strokes: []
  })
  textNode(
    { ...cell, style: { ...style, align: 'center', verticalAlign: 'middle' } },
    { x: 0, y: 0, width, height },
    graph,
    holder.id
  )
}

/** Where a cell sits on the page: its own geometry plus that of each container above it. */
function absoluteBoxes(cells: DrawioCell[]): Map<string, Box> {
  const byId = new Map(cells.map((cell) => [cell.id, cell]))
  const boxes = new Map<string, Box>()
  const resolve = (cell: DrawioCell, depth: number): Box => {
    const known = boxes.get(cell.id)
    if (known) return known
    const parent = cell.parent ? byId.get(cell.parent) : undefined
    const offset =
      parent?.kind === 'vertex' && depth < 50
        ? resolve(parent, depth + 1)
        : { x: 0, y: 0, width: 0, height: 0 }
    const { x, y, width, height } = cell.geometry
    const box = { x: x + offset.x, y: y + offset.y, width, height }
    boxes.set(cell.id, box)
    return box
  }
  for (const cell of cells) if (cell.kind === 'vertex') resolve(cell, 0)
  return boxes
}

/** Shapes ordered so each container comes before the shapes inside it. */
function containersFirst(cells: DrawioCell[]): DrawioCell[] {
  const byId = new Map(cells.map((cell) => [cell.id, cell]))
  const depth = (cell: DrawioCell): number => {
    let level = 0
    for (let up = cell.parent ? byId.get(cell.parent) : undefined; up && level < 50; level++) {
      up = up.parent ? byId.get(up.parent) : undefined
    }
    return level
  }
  return cells
    .filter((cell) => cell.kind === 'vertex')
    .map((cell, order) => ({ cell, order, level: depth(cell) }))
    .sort((a, b) => a.level - b.level || a.order - b.order)
    .map(({ cell }) => cell)
}

function buildPage(page: DrawioPage, graph: SceneGraph): void {
  const canvas = graph.addPage(page.name)
  const boxes = absoluteBoxes(page.cells)
  const byId = new Map(page.cells.map((cell) => [cell.id, cell]))
  const frames = new Map<string, string>()
  const zero = { x: 0, y: 0 }
  /** The frame a cell goes into, and where that frame sits on the page. */
  const holder = (cell: DrawioCell): { id: string; at: Point } => {
    const parentId = cell.parent ? frames.get(cell.parent) : undefined
    const parentBox = cell.parent ? boxes.get(cell.parent) : undefined
    return parentId && parentBox ? { id: parentId, at: parentBox } : { id: canvas.id, at: zero }
  }
  for (const cell of containersFirst(page.cells)) {
    const box = boxes.get(cell.id)
    if (!box) continue
    const into = holder(cell)
    const local = { ...box, x: box.x - into.at.x, y: box.y - into.at.y }
    frames.set(cell.id, createVertex(cell, local, graph, into.id))
  }
  for (const cell of page.cells) {
    if (cell.kind !== 'edge') continue
    const parent = cell.parent ? byId.get(cell.parent) : undefined
    const origin = parent ? (boxes.get(parent.id) ?? zero) : zero
    const source = cell.source ? (boxes.get(cell.source) ?? null) : null
    const target = cell.target ? (boxes.get(cell.target) ?? null) : null
    const into = holder(cell)
    const points = routeEdge(cell, source, target, origin).map((p) => ({
      x: p.x - into.at.x,
      y: p.y - into.at.y
    }))
    createEdge(cell, points, graph, into.id)
  }
}

/** A document with one page per draw.io page, in the same order and with the same names. */
export function buildDrawioGraph(pages: DrawioPage[]): SceneGraph {
  const graph = new SceneGraph()
  for (const page of graph.getPages(true)) graph.deleteNode(page.id)
  for (const page of pages) buildPage(page, graph)
  return graph
}
