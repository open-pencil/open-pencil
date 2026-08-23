import { SNAP_THRESHOLD_SCREEN_PX } from '@open-pencil/core/constants'
import type { Editor } from '@open-pencil/core/editor'
import { computeSnap } from '@open-pencil/scene-graph'
import type { SceneNode } from '@open-pencil/scene-graph'
import { getAxisAlignedWorldBounds, getWorldMatrix } from '@open-pencil/scene-graph/coordinate'
import Matrix from '@open-pencil/scene-graph/matrix'
import type { Rect, Vector } from '@open-pencil/scene-graph/primitives'
import type { SnapGuide } from '@open-pencil/scene-graph/snap'

export interface PixelSnapResult {
  delta: Vector
  guides: SnapGuide[]
}

export function computePixelGridSnap(bounds: Rect, threshold: number): PixelSnapResult {
  const roundedX = Math.round(bounds.x)
  const roundedY = Math.round(bounds.y)
  const dx = roundedX - bounds.x
  const dy = roundedY - bounds.y
  const guides: SnapGuide[] = []
  if (Math.abs(dx) < threshold) {
    guides.push({
      axis: 'x',
      position: roundedX,
      from: bounds.y,
      to: bounds.y + bounds.height
    })
  }
  if (Math.abs(dy) < threshold) {
    guides.push({
      axis: 'y',
      position: roundedY,
      from: bounds.x,
      to: bounds.x + bounds.width
    })
  }
  return {
    delta: {
      x: Math.abs(dx) < threshold ? dx : 0,
      y: Math.abs(dy) < threshold ? dy : 0
    },
    guides
  }
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
    ? computePixelGridSnap(movingBounds, threshold)
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
