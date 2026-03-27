import { computeAccurateBounds } from '../bezier-math'
import { PEN_HANDLE_RADIUS, PEN_VERTEX_RADIUS } from '../constants'
import { vectorNetworkToPath } from '../vector'

import type { NodeEditState } from '../editor'
import type { VectorVertex, VectorSegment, VectorRegion, SceneGraph } from '../scene-graph'
import type { Vector } from '../types'
import type { SkiaRenderer } from './renderer'
import type { Canvas, Paint } from 'canvaskit-wasm'

type ToScreenFn = (x: number, y: number) => Vector

type HandleInfo = NodeEditState['hoveredHandleInfo']

export interface NodeEditOverlayState extends Pick<
  NodeEditState,
  'nodeId' | 'vertices' | 'segments' | 'regions' | 'selectedVertexIndices' | 'selectedHandles'
> {
  hoveredHandleInfo?: HandleInfo
}

// Blue = rgb(59,130,246) ≈ 0.23, 0.51, 0.96
// Light blue (hover) = rgb(96,165,250) ≈ 0.376, 0.647, 0.98
const BLUE = [0.23, 0.51, 0.96] as const
const LIGHT_BLUE = [0.376, 0.647, 0.98] as const

/** Compute set of vertices whose handles should be visible: selected vertices + vertices with selected handles + their direct neighbors */
function computeHandleVisibleVertices(
  selectedVertexIndices: Set<number>,
  selectedHandles: Set<string>,
  segments: VectorSegment[]
): Set<number> {
  // Seed: selected vertices + vertices that own a selected handle
  const seed = new Set(selectedVertexIndices)
  for (const key of selectedHandles) {
    const [siStr, tf] = key.split(':')
    const seg = segments[Number(siStr)]
    seed.add(tf === 'tangentStart' ? seg.start : seg.end)
  }
  // Expand: add only direct neighbors of seed vertices (no cascading)
  const visible = new Set(seed)
  for (const seg of segments) {
    if (seed.has(seg.start)) visible.add(seg.end)
    if (seed.has(seg.end)) visible.add(seg.start)
  }
  return visible
}

export function drawNodeEditOverlay(
  r: SkiaRenderer,
  canvas: Canvas,
  graph: SceneGraph,
  editState: NodeEditState | null | undefined
): void {
  if (!editState) return
  const { segments, selectedVertexIndices } = editState
  const vertices = editState.vertices
  const regions = editState.regions

  if (vertices.length === 0) return

  ensureNodeEditPaints(r)

  const toScreen: ToScreenFn = (x, y) => ({
    x: x * r.zoom + r.panX,
    y: y * r.zoom + r.panY
  })

  const selectedHandles = editState.selectedHandles
  const hovered = editState.hoveredHandleInfo ?? null
  const handleVisibleVertices = computeHandleVisibleVertices(
    selectedVertexIndices,
    selectedHandles,
    segments
  )

  // Draw the node shape with its original fills/strokes/effects using live vertices
  drawLiveShape(r, canvas, graph, editState.nodeId, vertices, segments, regions)

  // Draw technical stroke outline over the shape
  drawTechStroke(r, canvas, vertices, segments, regions)

  // Draw tangent handle lines + diamonds for vertices with visible handles
  drawEditHandles(
    r,
    canvas,
    vertices,
    segments,
    handleVisibleVertices,
    toScreen,
    selectedHandles,
    hovered
  )

  // Draw vertex circles
  drawEditVertices(r, canvas, vertices, selectedVertexIndices, toScreen)
}

// ---------------------------------------------------------------------------
// Live shape rendering with full styles
// ---------------------------------------------------------------------------

function drawLiveShape(
  r: SkiaRenderer,
  canvas: Canvas,
  graph: SceneGraph,
  nodeId: string,
  vertices: VectorVertex[],
  segments: VectorSegment[],
  regions: VectorRegion[]
): void {
  const node = graph.getNode(nodeId)
  if (!node) return

  // Compute bounds from live (absolute) vertices
  const liveNetwork = { vertices, segments, regions }
  const bounds = computeAccurateBounds(liveNetwork)

  // Build a normalized VectorNetwork (relative to bounds origin)
  const normalizedNetwork = {
    vertices: vertices.map((v) => ({
      ...v,
      x: v.x - bounds.x,
      y: v.y - bounds.y
    })),
    segments,
    regions
  }

  // Temporarily patch the node so renderShapeUncached uses our live network
  const origNetwork = node.vectorNetwork
  const origX = node.x
  const origY = node.y
  const origW = node.width
  const origH = node.height

  node.vectorNetwork = normalizedNetwork
  node.x = bounds.x
  node.y = bounds.y
  node.width = bounds.width
  node.height = bounds.height

  // Invalidate cached paths so they're rebuilt from our live network
  r.vectorPathCache.delete(nodeId)
  r.fillGeometryCache.delete(nodeId)
  r.strokeGeometryCache.delete(nodeId)

  // The overlay canvas is in screen space after panX/panY + zoom scaling.
  // renderShapeUncached expects a canvas translated to the node's local origin.
  canvas.save()
  canvas.translate(bounds.x * r.zoom + r.panX, bounds.y * r.zoom + r.panY)
  canvas.scale(r.zoom, r.zoom)

  r.renderShapeUncached(canvas, node, graph)

  canvas.restore()

  // Restore the original node properties
  node.vectorNetwork = origNetwork
  node.x = origX
  node.y = origY
  node.width = origW
  node.height = origH

  // Invalidate caches again so the original renders correctly after exit
  r.vectorPathCache.delete(nodeId)
  r.fillGeometryCache.delete(nodeId)
  r.strokeGeometryCache.delete(nodeId)
}

// ---------------------------------------------------------------------------
// Lazy paint cache
// ---------------------------------------------------------------------------

const paintCache = new WeakMap<
  SkiaRenderer,
  {
    handleLinePaint: Paint
    handleLineSelectedPaint: Paint
    handleLineHoverPaint: Paint
    vertexStroke1px: Paint
    vertexSelectedFill: Paint
    handleSelectedFill: Paint
    handleSelectedStroke: Paint
    handleHoverFill: Paint
    handleHoverStroke: Paint
    techStrokePaint: Paint
  }
>()

function ensureNodeEditPaints(r: SkiaRenderer) {
  if (paintCache.has(r)) return
  const ck = r.ck

  // Default handle line — gray
  const handleLinePaint = new ck.Paint()
  handleLinePaint.setStyle(ck.PaintStyle.Stroke)
  handleLinePaint.setStrokeWidth(1)
  handleLinePaint.setColor(ck.Color4f(0.6, 0.6, 0.6, 1))
  handleLinePaint.setAntiAlias(true)

  // Selected handle line — blue
  const handleLineSelectedPaint = new ck.Paint()
  handleLineSelectedPaint.setStyle(ck.PaintStyle.Stroke)
  handleLineSelectedPaint.setStrokeWidth(1)
  handleLineSelectedPaint.setColor(ck.Color4f(BLUE[0], BLUE[1], BLUE[2], 1))
  handleLineSelectedPaint.setAntiAlias(true)

  // Hover handle line — light blue
  const handleLineHoverPaint = new ck.Paint()
  handleLineHoverPaint.setStyle(ck.PaintStyle.Stroke)
  handleLineHoverPaint.setStrokeWidth(1)
  handleLineHoverPaint.setColor(ck.Color4f(LIGHT_BLUE[0], LIGHT_BLUE[1], LIGHT_BLUE[2], 1))
  handleLineHoverPaint.setAntiAlias(true)

  // Vertex stroke — blue 1px
  const vertexStroke1px = new ck.Paint()
  vertexStroke1px.setStyle(ck.PaintStyle.Stroke)
  vertexStroke1px.setStrokeWidth(1)
  vertexStroke1px.setColor(ck.Color4f(BLUE[0], BLUE[1], BLUE[2], 1))
  vertexStroke1px.setAntiAlias(true)

  // Vertex selected fill — blue
  const vertexSelectedFill = new ck.Paint()
  vertexSelectedFill.setStyle(ck.PaintStyle.Fill)
  vertexSelectedFill.setColor(ck.Color4f(BLUE[0], BLUE[1], BLUE[2], 1))
  vertexSelectedFill.setAntiAlias(true)

  // Selected handle diamond — blue fill
  const handleSelectedFill = new ck.Paint()
  handleSelectedFill.setStyle(ck.PaintStyle.Fill)
  handleSelectedFill.setColor(ck.Color4f(BLUE[0], BLUE[1], BLUE[2], 1))
  handleSelectedFill.setAntiAlias(true)

  // Selected handle diamond — white outset stroke 3px
  const handleSelectedStroke = new ck.Paint()
  handleSelectedStroke.setStyle(ck.PaintStyle.Stroke)
  handleSelectedStroke.setStrokeWidth(3)
  handleSelectedStroke.setColor(ck.Color4f(1, 1, 1, 1))
  handleSelectedStroke.setAntiAlias(true)

  // Hover handle diamond — light blue fill
  const handleHoverFill = new ck.Paint()
  handleHoverFill.setStyle(ck.PaintStyle.Fill)
  handleHoverFill.setColor(ck.Color4f(LIGHT_BLUE[0], LIGHT_BLUE[1], LIGHT_BLUE[2], 1))
  handleHoverFill.setAntiAlias(true)

  // Hover handle diamond — white outset stroke 3px
  const handleHoverStroke = new ck.Paint()
  handleHoverStroke.setStyle(ck.PaintStyle.Stroke)
  handleHoverStroke.setStrokeWidth(3)
  handleHoverStroke.setColor(ck.Color4f(1, 1, 1, 1))
  handleHoverStroke.setAntiAlias(true)

  // Technical stroke: rgb(178,178,178) = 0.698
  const techStrokePaint = new ck.Paint()
  techStrokePaint.setStyle(ck.PaintStyle.Stroke)
  techStrokePaint.setStrokeWidth(1)
  techStrokePaint.setColor(ck.Color4f(0.698, 0.698, 0.698, 1))
  techStrokePaint.setAntiAlias(true)

  paintCache.set(r, {
    handleLinePaint,
    handleLineSelectedPaint,
    handleLineHoverPaint,
    vertexStroke1px,
    vertexSelectedFill,
    handleSelectedFill,
    handleSelectedStroke,
    handleHoverFill,
    handleHoverStroke,
    techStrokePaint
  })
}

function getNodeEditPaints(r: SkiaRenderer) {
  const paints = paintCache.get(r)
  if (!paints) {
    throw new Error('Node edit paints are not initialized')
  }
  return paints
}

// ---------------------------------------------------------------------------
// Technical stroke outline
// ---------------------------------------------------------------------------

function drawTechStroke(
  r: SkiaRenderer,
  canvas: Canvas,
  vertices: VectorVertex[],
  segments: VectorSegment[],
  regions: VectorRegion[]
): void {
  const { techStrokePaint } = getNodeEditPaints(r)
  const network = { vertices, segments, regions }
  const paths = vectorNetworkToPath(r.ck, network)

  // Set stroke width to compensate for canvas scale so it's always 1px on screen
  techStrokePaint.setStrokeWidth(1 / r.zoom)

  canvas.save()
  canvas.translate(r.panX, r.panY)
  canvas.scale(r.zoom, r.zoom)

  for (const p of paths) {
    canvas.drawPath(p, techStrokePaint)
    p.delete()
  }

  canvas.restore()
}

// ---------------------------------------------------------------------------
// Handle lines + diamonds
// ---------------------------------------------------------------------------

function drawEditHandles(
  r: SkiaRenderer,
  canvas: Canvas,
  vertices: VectorVertex[],
  segments: VectorSegment[],
  handleVisibleVertices: Set<number>,
  toScreen: ToScreenFn,
  selectedHandles: Set<string>,
  hovered: HandleInfo
): void {
  const paints = getNodeEditPaints(r)
  for (let si = 0; si < segments.length; si++) {
    const seg = segments[si]
    drawSegmentHandle(
      r,
      canvas,
      vertices,
      seg,
      si,
      'tangentStart',
      handleVisibleVertices,
      toScreen,
      selectedHandles,
      hovered,
      paints
    )
    drawSegmentHandle(
      r,
      canvas,
      vertices,
      seg,
      si,
      'tangentEnd',
      handleVisibleVertices,
      toScreen,
      selectedHandles,
      hovered,
      paints
    )
  }
}

function drawSegmentHandle(
  r: SkiaRenderer,
  canvas: Canvas,
  vertices: VectorVertex[],
  seg: VectorSegment,
  segmentIndex: number,
  tangentField: 'tangentStart' | 'tangentEnd',
  handleVisibleVertices: Set<number>,
  toScreen: ToScreenFn,
  selectedHandles: Set<string>,
  hovered: HandleInfo,
  paints: ReturnType<typeof getNodeEditPaints>
): void {
  const vertexIndex = tangentField === 'tangentStart' ? seg.start : seg.end
  if (!handleVisibleVertices.has(vertexIndex)) return

  const tangent = seg[tangentField]
  if (tangent.x === 0 && tangent.y === 0) return

  const key = `${segmentIndex}:${tangentField}`
  const isSel = selectedHandles.has(key)
  const isHov =
    !isSel &&
    !!hovered &&
    hovered.segmentIndex === segmentIndex &&
    hovered.tangentField === tangentField

  let linePaint = paints.handleLinePaint
  if (isSel) linePaint = paints.handleLineSelectedPaint
  else if (isHov) linePaint = paints.handleLineHoverPaint

  const anchor = toScreen(vertices[vertexIndex].x, vertices[vertexIndex].y)
  const cp = toScreen(vertices[vertexIndex].x + tangent.x, vertices[vertexIndex].y + tangent.y)
  canvas.drawLine(anchor.x, anchor.y, cp.x, cp.y, linePaint)

  if (isSel) {
    drawHandleDiamond(r, canvas, cp.x, cp.y, paints.handleSelectedFill, paints.handleSelectedStroke)
    return
  }
  if (isHov) {
    drawHandleDiamond(r, canvas, cp.x, cp.y, paints.handleHoverFill, paints.handleHoverStroke)
    return
  }
  drawHandleDiamond(r, canvas, cp.x, cp.y, r.penVertexFill, paints.vertexStroke1px)
}

function drawHandleDiamond(
  r: SkiaRenderer,
  canvas: Canvas,
  x: number,
  y: number,
  fillPaint: Paint,
  strokePaint: Paint
): void {
  const s = PEN_HANDLE_RADIUS
  const path = new r.ck.Path()
  path.moveTo(x, y - s)
  path.lineTo(x + s, y)
  path.lineTo(x, y + s)
  path.lineTo(x - s, y)
  path.close()

  // Draw stroke first (outset) then fill on top
  canvas.drawPath(path, strokePaint)
  canvas.drawPath(path, fillPaint)
  path.delete()
}

// ---------------------------------------------------------------------------
// Vertex circles
// ---------------------------------------------------------------------------

function drawEditVertices(
  r: SkiaRenderer,
  canvas: Canvas,
  vertices: VectorVertex[],
  selectedVertexIndices: Set<number>,
  toScreen: ToScreenFn
): void {
  const vertexFill = r.penVertexFill
  const { vertexStroke1px, vertexSelectedFill } = getNodeEditPaints(r)

  for (let i = 0; i < vertices.length; i++) {
    const v = toScreen(vertices[i].x, vertices[i].y)
    const radius = PEN_VERTEX_RADIUS

    if (selectedVertexIndices.has(i)) {
      canvas.drawCircle(v.x, v.y, radius, vertexSelectedFill)
      canvas.drawCircle(v.x, v.y, radius, vertexStroke1px)
    } else {
      canvas.drawCircle(v.x, v.y, radius, vertexFill)
      canvas.drawCircle(v.x, v.y, radius, vertexStroke1px)
    }
  }
}
