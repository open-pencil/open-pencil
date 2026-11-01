import { uniq } from 'es-toolkit'

import { resolveEditorProfile, type Editor } from '@open-pencil/core'
import { SNAP_THRESHOLD_SCREEN_PX } from '@open-pencil/core/constants'
import type { SceneNode } from '@open-pencil/scene-graph'
import { getAxisAlignedWorldBounds, getWorldMatrix } from '@open-pencil/scene-graph/coordinate'
import Matrix from '@open-pencil/scene-graph/matrix'
import type { Rect, Vector } from '@open-pencil/scene-graph/primitives'
import { computeSnap, type SnapGuide } from '@open-pencil/scene-graph/snap'

export interface PixelSnapResult {
  delta: Vector
  guides: SnapGuide[]
}

/** Rounds to a multiple of `step`. */
function roundTo(value: number, step: number): number {
  return Math.round(value / step) * step
}

/**
 * Lands the bounds on the snap grid, as Figma's Snap to pixel grid does at any zoom: a move ends on
 * a whole position and a resized edge on a whole size, even from a fractional start. The grid is
 * the editor profile's: whole pixels in a design, FigJam's 16 units on a board.
 */
export function computePixelGridSnap(bounds: Rect, step = 1): PixelSnapResult {
  return {
    delta: { x: roundTo(bounds.x, step) - bounds.x, y: roundTo(bounds.y, step) - bounds.y },
    // Pixel rounding is not alignment with another object or an explicit guide.
    guides: []
  }
}

/** How a drawn layer's corners land while Snap to pixel grid is on, on the profile's grid. */
export function gridRounding(editor: Editor): (value: number) => number {
  if (!editor.state.snappingPreferences.pixelGrid) return (value) => value
  const step = resolveEditorProfile(editor.state).snapGrid
  return (value) => roundTo(value, step)
}

export interface ExplicitSnapTarget extends SnapGuide {
  kind: 'canvas-guide' | 'layout-guide'
}

export interface GeometrySnapTarget extends SnapGuide {
  kind: 'geometry'
}

export interface ObjectPixelSnapResult {
  correction: Vector
  guides: SnapGuide[]
}

function deduplicateGuides(guides: SnapGuide[]): SnapGuide[] {
  const merged = new Map<string, SnapGuide>()
  for (const guide of guides) {
    const key = `${guide.axis}:${guide.position}`
    const current = merged.get(key)
    if (!current) merged.set(key, { ...guide })
    else {
      current.from = Math.min(current.from, guide.from)
      current.to = Math.max(current.to, guide.to)
    }
  }
  return [...merged.values()]
}

export function worldBoundsNode(node: SceneNode, editor: Editor): SceneNode {
  const bounds = getAxisAlignedWorldBounds(node, editor.graph)
  return { ...node, ...bounds, rotation: 0, flipX: false, flipY: false }
}

function winningCorrection(
  geometry: { delta: number } | null,
  explicit: { delta: number } | null,
  objectMatched: boolean,
  objectDelta: number,
  pixelDelta: number
): number {
  if (geometry) return geometry.delta
  if (explicit) return explicit.delta
  return objectMatched ? objectDelta : pixelDelta
}

interface AxisCandidate<T extends SnapGuide> {
  delta: number
  target: T
}

function nearestPerAxis<T extends SnapGuide>(
  targets: readonly T[],
  xAnchors: readonly number[],
  yAnchors: readonly number[],
  threshold: number
): { x: AxisCandidate<T> | null; y: AxisCandidate<T> | null } {
  let x: AxisCandidate<T> | null = null
  let y: AxisCandidate<T> | null = null
  for (const target of targets) {
    const anchors = target.axis === 'x' ? xAnchors : yAnchors
    for (const anchor of anchors) {
      const delta = target.position - anchor
      if (Math.abs(delta) >= threshold) continue
      const current = target.axis === 'x' ? x : y
      if (current && Math.abs(delta) >= Math.abs(current.delta)) continue
      if (target.axis === 'x') x = { delta, target }
      else y = { delta, target }
    }
  }
  return { x, y }
}

export function resolveObjectPixelSnap(
  movingIds: Set<string>,
  movingBounds: Rect,
  targets: SceneNode[],
  editor: Editor,
  explicitTargets: ExplicitSnapTarget[] = [],
  geometryTargets: GeometrySnapTarget[] = []
): ObjectPixelSnapResult {
  const threshold = snappingThreshold(editor)
  const xAnchors = [
    movingBounds.x,
    movingBounds.x + movingBounds.width / 2,
    movingBounds.x + movingBounds.width
  ]
  const yAnchors = [
    movingBounds.y,
    movingBounds.y + movingBounds.height / 2,
    movingBounds.y + movingBounds.height
  ]
  const { x: geometryX, y: geometryY } = nearestPerAxis(
    geometryTargets,
    xAnchors,
    yAnchors,
    threshold
  )
  const { x: explicitX, y: explicitY } = nearestPerAxis(
    explicitTargets,
    xAnchors,
    yAnchors,
    threshold
  )
  const objectSnap = editor.state.snappingPreferences.objects
    ? computeSnap(movingIds, movingBounds, targets, threshold)
    : { dx: 0, dy: 0, guides: [] }
  const pixelSnap = editor.state.snappingPreferences.pixelGrid
    ? computePixelGridSnap(movingBounds, resolveEditorProfile(editor.state).snapGrid)
    : { delta: { x: 0, y: 0 }, guides: [] }
  const objectX = objectSnap.guides.some((guide) => guide.axis === 'x')
  const objectY = objectSnap.guides.some((guide) => guide.axis === 'y')
  const explicitGuides = [explicitX?.target, explicitY?.target].flatMap((guide) =>
    guide ? [guide] : []
  )
  const geometryGuides = [geometryX?.target, geometryY?.target].flatMap((guide) =>
    guide ? [guide] : []
  )
  const xBlockedByGeometry = Boolean(geometryX)
  const yBlockedByGeometry = Boolean(geometryY)
  return {
    correction: {
      x: winningCorrection(geometryX, explicitX, objectX, objectSnap.dx, pixelSnap.delta.x),
      y: winningCorrection(geometryY, explicitY, objectY, objectSnap.dy, pixelSnap.delta.y)
    },
    guides: deduplicateGuides([
      ...geometryGuides,
      ...explicitGuides.filter((guide) =>
        guide.axis === 'x' ? !xBlockedByGeometry : !yBlockedByGeometry
      ),
      ...objectSnap.guides.filter((guide) =>
        guide.axis === 'x' ? !xBlockedByGeometry && !explicitX : !yBlockedByGeometry && !explicitY
      ),
      ...pixelSnap.guides.filter((guide) =>
        guide.axis === 'x'
          ? !xBlockedByGeometry && !explicitX && !objectX
          : !yBlockedByGeometry && !explicitY && !objectY
      )
    ])
  }
}

export function worldDeltaToParentLocal(
  delta: Vector,
  parentId: string | null | undefined,
  editor: Editor
): Vector {
  const parent = parentId ? editor.graph.getNode(parentId) : undefined
  if (!parent || editor.isTopLevel(parent.id)) return delta
  const inverse = Matrix.invert(getWorldMatrix(parent, editor.graph))
  if (!inverse) return delta
  const origin = Matrix.mapPoint(inverse, { x: 0, y: 0 })
  const endpoint = Matrix.mapPoint(inverse, delta)
  return { x: endpoint.x - origin.x, y: endpoint.y - origin.y }
}

type EditorWithOptionalState = Omit<Editor, 'state'> & { state?: Editor['state'] }

export function optionalEditorState(editor: Editor): Editor['state'] | undefined {
  return (editor as EditorWithOptionalState).state
}

export function snappingThreshold(editor: Editor): number {
  return SNAP_THRESHOLD_SCREEN_PX / Math.max(editor.state.zoom, Number.EPSILON)
}

export interface PointSnapResult {
  point: Vector
  guides: SnapGuide[]
}

/**
 * Lines a point up with path vertices, as Figma's pen does: on each axis the point takes the
 * nearest vertex coordinate within the snapping distance, and the guide runs through the point and
 * every vertex on that line, with a cross on each. A point that lands on a vertex shows only that
 * vertex's cross.
 */
export function resolveVertexSnap(
  point: Vector,
  vertices: readonly Vector[],
  editor: Editor
): PointSnapResult {
  if (!editor.state.snappingPreferences.geometry) return { point, guides: [] }
  const threshold = snappingThreshold(editor)
  const x = nearestVertexCoordinate(point, vertices, 'x', threshold)
  const y = nearestVertexCoordinate(point, vertices, 'y', threshold)
  const snapped = { x: x ?? point.x, y: y ?? point.y }
  if (vertices.some((vertex) => vertex.x === snapped.x && vertex.y === snapped.y)) {
    return {
      point: snapped,
      guides: [
        { axis: 'x', position: snapped.x, from: snapped.y, to: snapped.y, marks: [snapped.y] }
      ]
    }
  }
  const guides: SnapGuide[] = []
  if (x !== null) guides.push(guideThroughVertices('x', x, snapped.y, vertices))
  if (y !== null) guides.push(guideThroughVertices('y', y, snapped.x, vertices))
  return { point: snapped, guides }
}

function nearestVertexCoordinate(
  point: Vector,
  vertices: readonly Vector[],
  axis: 'x' | 'y',
  threshold: number
): number | null {
  let nearest: number | null = null
  for (const vertex of vertices) {
    const distance = Math.abs(vertex[axis] - point[axis])
    if (distance >= threshold) continue
    if (nearest === null || distance < Math.abs(nearest - point[axis])) nearest = vertex[axis]
  }
  return nearest
}

function guideThroughVertices(
  axis: 'x' | 'y',
  position: number,
  pointAlong: number,
  vertices: readonly Vector[]
): SnapGuide {
  const across = axis === 'x' ? 'y' : 'x'
  const marks = uniq([
    pointAlong,
    ...vertices.filter((vertex) => vertex[axis] === position).map((vertex) => vertex[across])
  ])
  return { axis, position, from: Math.min(...marks), to: Math.max(...marks), marks }
}
