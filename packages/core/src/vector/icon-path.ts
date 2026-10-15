import type { VectorNetwork } from '@open-pencil/scene-graph'

import { addStrokeRunToPath, strokeRuns, type PathSink } from './path-helpers'

/** Side of the square a layer icon is drawn in, in pixels: Figma's objects panel icon is 10×10. */
export const VECTOR_ICON_SIZE = 10
/** The shape fills 9 of the 10 pixels, as in Figma. */
const PADDING = 0.5
/** Figma shows its generic vector icon once vertices and segments together reach this many. */
const MAX_ICON_ELEMENTS = 129

const round = (value: number) => Math.round(value * 100) / 100

/**
 * The outline of a vector as SVG path data fitted to a {@link VECTOR_ICON_SIZE} square, as Figma
 * draws a vector's row in the layers panel: its own shape rather than a generic glyph. The shape
 * keeps its proportions and is centered; a straight line keeps its slope. Null, so the row keeps
 * the generic vector glyph, for a network with no segments or with 129 or more vertices and
 * segments together (Figma's `generateObjectsPanelIcon`, wasm f42365).
 */
export function vectorIconPath(network: VectorNetwork): string | null {
  const { vertices, segments } = network
  if (segments.length === 0 || vertices.length + segments.length >= MAX_ICON_ELEMENTS) return null

  // The vertices and handle ends bound the curves, which is close enough for a 16-unit icon.
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  const include = (x: number, y: number) => {
    minX = Math.min(minX, x)
    minY = Math.min(minY, y)
    maxX = Math.max(maxX, x)
    maxY = Math.max(maxY, y)
  }
  for (const segment of segments) {
    // `at` would wrap a negative index to the end; a bad endpoint means nothing to draw.
    if (segment.start < 0 || segment.end < 0) return null
    const start = vertices.at(segment.start)
    const end = vertices.at(segment.end)
    if (!start || !end) return null
    include(start.x, start.y)
    include(end.x, end.y)
    include(start.x + segment.tangentStart.x, start.y + segment.tangentStart.y)
    include(end.x + segment.tangentEnd.x, end.y + segment.tangentEnd.y)
  }
  const width = maxX - minX
  const height = maxY - minY
  const extent = Math.max(width, height)
  if (!(extent > 0)) return null

  const scale = (VECTOR_ICON_SIZE - PADDING * 2) / extent
  const offsetX = (VECTOR_ICON_SIZE - width * scale) / 2 - minX * scale
  const offsetY = (VECTOR_ICON_SIZE - height * scale) / 2 - minY * scale
  const point = (x: number, y: number) =>
    `${round(x * scale + offsetX)} ${round(y * scale + offsetY)}`

  const commands: string[] = []
  const sink: PathSink = {
    moveTo: (x, y) => commands.push(`M${point(x, y)}`),
    lineTo: (x, y) => commands.push(`L${point(x, y)}`),
    cubicTo: (x1, y1, x2, y2, x, y) =>
      commands.push(`C${point(x1, y1)} ${point(x2, y2)} ${point(x, y)}`),
    close: () => commands.push('Z')
  }
  for (const run of strokeRuns(segments)) addStrokeRunToPath(sink, run, segments, vertices)
  return commands.join('')
}
