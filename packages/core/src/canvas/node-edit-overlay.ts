import type { Canvas, CanvasKit, Paint } from 'canvaskit-wasm'

import type {
  VectorVertex,
  VectorSegment,
  VectorRegion,
  SceneGraph
} from '@open-pencil/scene-graph'
import { getWorldMatrix } from '@open-pencil/scene-graph/coordinate'
import Matrix from '@open-pencil/scene-graph/matrix'
import type { Vector } from '@open-pencil/scene-graph/primitives'
import { transformVectorNetwork } from '@open-pencil/scene-graph/vector-network'

import { PEN_HANDLE_RADIUS, PEN_VERTEX_RADIUS } from '#core/constants'
import {
  regenerateFillGeometry,
  vectorHandleId,
  vectorHandleParts,
  vectorNetworkToPath
} from '#core/vector'
import { evalCubic, segmentToAbsolute } from '#core/vector/curve-math'

import { drawRegionHatch } from './region-hatch'
import type { SkiaRenderer, RenderOverlays } from './renderer'

type ToScreenFn = (x: number, y: number) => Vector

type HandleInfo =
  | { segmentIndex: number; tangentField: 'tangentStart' | 'tangentEnd' }
  | null
  | undefined

export interface NodeEditOverlayState {
  nodeId: string
  vertices: VectorVertex[]
  segments: VectorSegment[]
  regions: VectorRegion[]
  selectedVertexIndices: Set<number>
  selectedSegmentIndices?: Set<number>
  selectedHandles?: Set<number>
  hoveredHandleInfo?: HandleInfo
  hoveredRegion?: number | null
  selectedRegions?: Set<number>
}

// Blue = rgb(59,130,246) ≈ 0.23, 0.51, 0.96
// Light blue (hover) = rgb(96,165,250) ≈ 0.376, 0.647, 0.98
const BLUE = [0.23, 0.51, 0.96] as const
const LIGHT_BLUE = [0.376, 0.647, 0.98] as const

export function computeHandleVisibleVertices(
  selectedVertexIndices: Set<number>,
  selectedHandles: Set<number>,
  segments: VectorSegment[]
): Set<number> {
  // Seed: selected vertices + vertices that own a selected handle
  const seed = new Set(selectedVertexIndices)
  for (const handleId of selectedHandles) {
    const handle = vectorHandleParts(handleId)
    if (!handle || handle.segmentIndex >= segments.length) continue
    const seg = segments[handle.segmentIndex]
    seed.add(handle.tangentField === 'tangentStart' ? seg.start : seg.end)
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
  editState: RenderOverlays['nodeEditState']
): void {
  if (!editState) return
  const { segments, selectedVertexIndices } = editState
  const vertices = editState.vertices
  const regions = editState.regions

  if (vertices.length === 0) return

  const toScreen: ToScreenFn = (x, y) => ({
    x: x * r.zoom + r.panX,
    y: y * r.zoom + r.panY
  })

  const selectedHandles = editState.selectedHandles ?? new Set<number>()
  const hovered = editState.hoveredHandleInfo ?? null
  const handleVisibleVertices = computeHandleVisibleVertices(
    selectedVertexIndices,
    selectedHandles,
    segments
  )

  // Draw the node shape with its original fills/strokes/effects using live vertices
  drawLiveShape(r, canvas, graph, editState.nodeId, vertices, segments, regions)

  // Hatch the hovered and selected regions, as Figma does
  drawRegionHatch(r, canvas, graph, editState)

  // Draw technical stroke outline over the shape
  drawTechStroke(r, canvas, graph, editState.nodeId, vertices, segments, regions)

  drawSelectedSegments(
    r,
    canvas,
    vertices,
    segments,
    editState.selectedSegmentIndices ?? new Set<number>(),
    toScreen
  )

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

  // The edit state is page-absolute; map it back into the node's local frame
  // so static fillGeometry (multi-color vectors) stays aligned, and render
  // through the node's full world matrix (nesting, rotation, flips).
  const world = getWorldMatrix(node, graph)
  const inverse = Matrix.invert(world)
  if (!inverse) return
  const localNetwork = transformVectorNetwork(inverse, { vertices, segments, regions })

  // Temporarily patch the node so renderShapeUncached uses our live network;
  // fills draw from fillGeometry blobs, so rebuild those from the live network.
  // Clear strokeGeometry so strokes use the live vector network instead of
  // stale imported stroke blobs.
  const origNetwork = node.vectorNetwork
  const origFillGeometry = node.fillGeometry
  const origStrokeGeometry = node.strokeGeometry

  // The overlay canvas is in screen space; renderShapeUncached expects the
  // node's local frame, so apply viewport then the node's world matrix.
  canvas.save()
  try {
    node.vectorNetwork = localNetwork
    node.fillGeometry = regenerateFillGeometry(localNetwork, origFillGeometry)
    node.strokeGeometry = []
    r.invalidateVectorPath(nodeId)
    canvas.translate(r.panX, r.panY)
    canvas.scale(r.zoom, r.zoom)
    canvas.concat(world)
    r.renderShapeUncached(canvas, node, graph)
  } finally {
    canvas.restore()
    // Restore the original node properties and invalidate again so the
    // original renders correctly after exit — even if regeneration or rendering throws.
    node.vectorNetwork = origNetwork
    node.fillGeometry = origFillGeometry
    node.strokeGeometry = origStrokeGeometry
    r.invalidateVectorPath(nodeId)
  }
}

// ---------------------------------------------------------------------------
// Paints
// ---------------------------------------------------------------------------

export interface NodeEditPaints {
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
  segmentSelectedPaint: Paint
}

function strokePaint(ck: CanvasKit, width: number, color: Float32Array): Paint {
  const paint = new ck.Paint()
  paint.setStyle(ck.PaintStyle.Stroke)
  paint.setStrokeWidth(width)
  paint.setColor(color)
  paint.setAntiAlias(true)
  return paint
}

function fillPaint(ck: CanvasKit, color: Float32Array): Paint {
  const paint = new ck.Paint()
  paint.setStyle(ck.PaintStyle.Fill)
  paint.setColor(color)
  paint.setAntiAlias(true)
  return paint
}

/** The renderer owns these: it creates them with its other paints and frees them when destroyed. */
export function createNodeEditPaints(ck: CanvasKit): NodeEditPaints {
  const blue = ck.Color4f(BLUE[0], BLUE[1], BLUE[2], 1)
  const lightBlue = ck.Color4f(LIGHT_BLUE[0], LIGHT_BLUE[1], LIGHT_BLUE[2], 1)
  const white = ck.Color4f(1, 1, 1, 1)
  return {
    handleLinePaint: strokePaint(ck, 1, ck.Color4f(0.6, 0.6, 0.6, 1)),
    handleLineSelectedPaint: strokePaint(ck, 1, blue),
    handleLineHoverPaint: strokePaint(ck, 1, lightBlue),
    vertexStroke1px: strokePaint(ck, 1, blue),
    vertexSelectedFill: fillPaint(ck, blue),
    handleSelectedFill: fillPaint(ck, blue),
    // White outset strokes around the selected and hovered handle diamonds.
    handleSelectedStroke: strokePaint(ck, 3, white),
    handleHoverFill: fillPaint(ck, lightBlue),
    handleHoverStroke: strokePaint(ck, 3, white),
    // Technical stroke: rgb(178, 178, 178).
    techStrokePaint: strokePaint(ck, 1, ck.Color4f(0.698, 0.698, 0.698, 1)),
    segmentSelectedPaint: strokePaint(ck, 2, blue)
  }
}

export function disposeNodeEditPaints(paints: NodeEditPaints): void {
  for (const paint of Object.values(paints)) paint.delete()
}

// ---------------------------------------------------------------------------
// Technical stroke outline
// ---------------------------------------------------------------------------

function drawTechStroke(
  r: SkiaRenderer,
  canvas: Canvas,
  graph: SceneGraph,
  nodeId: string,
  vertices: VectorVertex[],
  segments: VectorSegment[],
  regions: VectorRegion[]
): void {
  const { techStrokePaint } = r.nodeEditPaints
  const node = graph.getNode(nodeId)
  if (!node) return
  const world = getWorldMatrix(node, graph)
  const inverse = Matrix.invert(world)
  if (!inverse) return
  const localNetwork = transformVectorNetwork(inverse, { vertices, segments, regions })
  const paths = vectorNetworkToPath(r.ck, localNetwork)

  // Keep the technical outline in the same coordinate space as the live shape.
  techStrokePaint.setStrokeWidth(1 / r.zoom)

  canvas.save()
  canvas.translate(r.panX, r.panY)
  canvas.scale(r.zoom, r.zoom)
  canvas.concat(world)
  for (const p of paths) {
    canvas.drawPath(p, techStrokePaint)
    p.delete()
  }
  canvas.restore()
}

// ---------------------------------------------------------------------------
// Selected segments
// ---------------------------------------------------------------------------

/** Selected segments draw in blue with a knob at their midpoint, as in Figma. */
function drawSelectedSegments(
  r: SkiaRenderer,
  canvas: Canvas,
  vertices: VectorVertex[],
  segments: VectorSegment[],
  selectedSegmentIndices: Set<number>,
  toScreen: ToScreenFn
): void {
  const { segmentSelectedPaint, vertexStroke1px } = r.nodeEditPaints
  const network = { vertices, segments, regions: [] }
  for (const index of selectedSegmentIndices) {
    if (index >= segments.length) continue
    const { p0, cp1, cp2, p3 } = segmentToAbsolute(network, index)
    const s0 = toScreen(p0.x, p0.y)
    const s1 = toScreen(cp1.x, cp1.y)
    const s2 = toScreen(cp2.x, cp2.y)
    const s3 = toScreen(p3.x, p3.y)

    const builder = new r.ck.PathBuilder()
    builder.moveTo(s0.x, s0.y)
    builder.cubicTo(s1.x, s1.y, s2.x, s2.y, s3.x, s3.y)
    const path = builder.detachAndDelete()
    canvas.drawPath(path, segmentSelectedPaint)
    path.delete()

    const mid = evalCubic(s0.x, s0.y, s1.x, s1.y, s2.x, s2.y, s3.x, s3.y, 0.5)
    canvas.drawCircle(mid.x, mid.y, PEN_HANDLE_RADIUS, r.penVertexFill)
    canvas.drawCircle(mid.x, mid.y, PEN_HANDLE_RADIUS, vertexStroke1px)
  }
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
  selectedHandles: Set<number>,
  hovered: HandleInfo
): void {
  const paints = r.nodeEditPaints
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
  selectedHandles: Set<number>,
  hovered: HandleInfo,
  paints: NodeEditPaints
): void {
  const vertexIndex = tangentField === 'tangentStart' ? seg.start : seg.end
  if (!handleVisibleVertices.has(vertexIndex)) return

  const tangent = seg[tangentField]
  if (tangent.x === 0 && tangent.y === 0) return

  const key = vectorHandleId(segmentIndex, tangentField)
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
  const path = new r.ck.PathBuilder()
  path.moveTo(x, y - s)
  path.lineTo(x + s, y)
  path.lineTo(x, y + s)
  path.lineTo(x - s, y)
  path.close()

  const immutablePath = path.detachAndDelete()
  // Draw stroke first (outset) then fill on top
  canvas.drawPath(immutablePath, strokePaint)
  canvas.drawPath(immutablePath, fillPaint)
  immutablePath.delete()
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
  const { vertexStroke1px, vertexSelectedFill } = r.nodeEditPaints

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
