import {
  copyDerivedGlyphs,
  copyGeometryPaths,
  copyStroke,
  copyStrokes,
  scaleGeometryPaths
} from './copy'
import type { Rect } from './primitives'
import type { ConstraintType, DerivedTextGlyph, SceneNode, Stroke, VectorNetwork } from './types'
import { cloneVectorNetwork } from './vector-network'

/**
 * Drag-start state a live resize re-scales from. Path text needs more than the
 * layout rect: its OUTSIDE stroke silhouettes and glyph outlines are baked
 * geometry that must scale with the node, and textPathBox is the layout box the
 * glyphs were reflowed against.
 */
export type ResizeSnapshot = Pick<
  SceneNode,
  | 'x'
  | 'y'
  | 'width'
  | 'height'
  | 'vectorNetwork'
  | 'fillGeometry'
  | 'strokeGeometry'
  | 'derivedTextGlyphs'
  | 'strokes'
  | 'textPathData'
  | 'textPathBox'
>

interface ResizeGraph {
  getNode(id: string): SceneNode | undefined
}

const CONSTRAINT_CONTAINER_TYPES = new Set([
  'FRAME',
  'COMPONENT',
  'COMPONENT_SET',
  'INSTANCE',
  'GROUP',
  'BOOLEAN_OPERATION'
])

function constrainedAxis(
  position: number,
  size: number,
  parentBefore: number,
  parentAfter: number,
  constraint: ConstraintType
): { position: number; size: number } {
  const delta = parentAfter - parentBefore
  if (constraint === 'MAX') return { position: position + delta, size }
  if (constraint === 'CENTER') return { position: position + delta / 2, size }
  if (constraint === 'STRETCH') return { position, size: Math.max(1, size + delta) }
  if (constraint === 'SCALE' && parentBefore > 0) {
    const scale = parentAfter / parentBefore
    return { position: position * scale, size: Math.max(1, size * scale) }
  }
  return { position, size }
}

export function constrainedChildRect(
  child: Rect,
  parentBefore: Pick<Rect, 'width' | 'height'>,
  parentAfter: Pick<Rect, 'width' | 'height'>,
  horizontal: ConstraintType,
  vertical: ConstraintType
): Rect {
  const x = constrainedAxis(child.x, child.width, parentBefore.width, parentAfter.width, horizontal)
  const y = constrainedAxis(
    child.y,
    child.height,
    parentBefore.height,
    parentAfter.height,
    vertical
  )
  return {
    x: Math.round(x.position),
    y: Math.round(y.position),
    width: Math.round(x.size),
    height: Math.round(y.size)
  }
}

export function scaledChildRect(
  child: Rect,
  parentBefore: Pick<Rect, 'width' | 'height'>,
  parentAfter: Pick<Rect, 'width' | 'height'>
): Rect {
  return constrainedChildRect(child, parentBefore, parentAfter, 'SCALE', 'SCALE')
}

export function scaleVectorNetworkForResize(
  vectorNetwork: VectorNetwork | null,
  originalWidth: number,
  originalHeight: number,
  width: number,
  height: number
): VectorNetwork | null {
  if (!vectorNetwork || originalWidth <= 0 || originalHeight <= 0) return null

  const scaleX = width / originalWidth
  const scaleY = height / originalHeight
  if (scaleX === 1 && scaleY === 1) return null

  return {
    vertices: vectorNetwork.vertices.map((vertex) => ({
      ...vertex,
      x: vertex.x * scaleX,
      y: vertex.y * scaleY
    })),
    segments: vectorNetwork.segments.map((segment) => ({
      ...segment,
      tangentStart: {
        x: segment.tangentStart.x * scaleX,
        y: segment.tangentStart.y * scaleY
      },
      tangentEnd: {
        x: segment.tangentEnd.x * scaleX,
        y: segment.tangentEnd.y * scaleY
      }
    })),
    regions: vectorNetwork.regions
  }
}

/** Snapshot one node's resize-relevant state (rect + geometry that must scale with it). */
export function createResizeSnapshot(node: SceneNode): ResizeSnapshot {
  return {
    x: node.x,
    y: node.y,
    width: node.width,
    height: node.height,
    vectorNetwork: node.vectorNetwork ? cloneVectorNetwork(node.vectorNetwork) : null,
    fillGeometry: copyGeometryPaths(node.fillGeometry),
    strokeGeometry: copyGeometryPaths(node.strokeGeometry),
    derivedTextGlyphs: copyDerivedGlyphs(node.derivedTextGlyphs),
    strokes: copyStrokes(node.strokes),
    textPathData: node.textPathData ? structuredClone(node.textPathData) : null,
    textPathBox: node.textPathBox ? { ...node.textPathBox } : null
  }
}

function scaleDerivedGlyphs(
  glyphs: DerivedTextGlyph[] | null,
  sx: number,
  sy: number
): DerivedTextGlyph[] | null {
  if (!glyphs?.length) return glyphs
  return glyphs.map((g) => ({
    ...g,
    x: g.x * sx,
    y: g.y * sy,
    scaleX: (g.scaleX ?? 1) * sx,
    scaleY: (g.scaleY ?? 1) * sy,
    commandsBlob: new Uint8Array(g.commandsBlob)
  }))
}

function scaleStrokes(strokes: Stroke[], sx: number, sy: number): Stroke[] {
  if (strokes.length === 0) return strokes
  // Weight is a scalar; average scale is the usual 2D → 1D compromise.
  const weightScale = (Math.abs(sx) + Math.abs(sy)) / 2
  return strokes.map((s) => ({ ...copyStroke(s), weight: s.weight * weightScale }))
}

/**
 * All geometry that must track a width/height change. Historically only
 * vectorNetwork + fillGeometry were updated — path-text strokeGeometry and
 * glyphs stayed at the pre-resize size, so shrinking a sticker made the white
 * OUTSIDE outlines look massively thick (DomeSticker resize bug).
 */
export function scaledGeometryChanges(
  orig: Pick<
    ResizeSnapshot,
    | 'vectorNetwork'
    | 'fillGeometry'
    | 'strokeGeometry'
    | 'derivedTextGlyphs'
    | 'strokes'
    | 'textPathData'
    | 'textPathBox'
  >,
  origWidth: number,
  origHeight: number,
  width: number,
  height: number
): Partial<SceneNode> {
  if (origWidth <= 0 || origHeight <= 0) return {}
  const sx = width / origWidth
  const sy = height / origHeight
  if (sx === 1 && sy === 1) return {}

  const changes: Partial<SceneNode> = {}
  const resizedVN = scaleVectorNetworkForResize(
    orig.vectorNetwork,
    origWidth,
    origHeight,
    width,
    height
  )
  if (resizedVN) changes.vectorNetwork = resizedVN

  if (orig.fillGeometry.length > 0) {
    changes.fillGeometry = scaleGeometryPaths(orig.fillGeometry, sx, sy)
  }
  if (orig.strokeGeometry.length > 0) {
    changes.strokeGeometry = scaleGeometryPaths(orig.strokeGeometry, sx, sy)
  }
  if (orig.derivedTextGlyphs?.length) {
    changes.derivedTextGlyphs = scaleDerivedGlyphs(orig.derivedTextGlyphs, sx, sy)
    // Keep the layout/selection box in sync with the scaled glyphs. reflow
    // overrides this when it applies; this covers the fallback where reflow
    // returns null (no path data) so the box doesn't carry a stale size.
    if (orig.textPathBox) {
      changes.textPathBox = {
        x: orig.textPathBox.x * sx,
        y: orig.textPathBox.y * sy,
        width: orig.textPathBox.width * sx,
        height: orig.textPathBox.height * sy
      }
    }
  }
  if (orig.strokes.length > 0) {
    changes.strokes = scaleStrokes(orig.strokes, sx, sy)
  }
  return changes
}

export function collectResizeDescendants(
  graph: ResizeGraph,
  rootId: string
): Map<string, ResizeSnapshot> | null {
  const root = graph.getNode(rootId)
  if (!root || !CONSTRAINT_CONTAINER_TYPES.has(root.type)) return null
  const snapshots = new Map<string, ResizeSnapshot>()

  const collect = (parentId: string) => {
    const parent = graph.getNode(parentId)
    if (!parent) return
    for (const childId of parent.childIds) {
      const child = graph.getNode(childId)
      if (!child) continue
      snapshots.set(childId, createResizeSnapshot(child))
      collect(childId)
    }
  }

  collect(rootId)
  return snapshots.size > 0 ? snapshots : null
}

export function computeConstrainedResizeChanges(
  graph: ResizeGraph,
  rootId: string,
  rootBefore: Pick<Rect, 'width' | 'height'>,
  rootAfter: Pick<Rect, 'width' | 'height'>,
  originals: ReadonlyMap<string, ResizeSnapshot>
): Map<string, Partial<SceneNode>> {
  const changes = new Map<string, Partial<SceneNode>>()

  const compute = (
    parentId: string,
    parentBefore: Pick<Rect, 'width' | 'height'>,
    parentAfter: Pick<Rect, 'width' | 'height'>
  ) => {
    const parent = graph.getNode(parentId)
    if (!parent) return
    const scalesChildren = parent.type === 'GROUP' || parent.type === 'BOOLEAN_OPERATION'
    for (const childId of parent.childIds) {
      const original = originals.get(childId)
      const child = graph.getNode(childId)
      if (!original || !child) continue
      const isInFlow = parent.layoutMode !== 'NONE' && child.layoutPositioning !== 'ABSOLUTE'
      if (isInFlow) {
        compute(childId, original, child)
        continue
      }
      const rect = scalesChildren
        ? scaledChildRect(original, parentBefore, parentAfter)
        : constrainedChildRect(
            original,
            parentBefore,
            parentAfter,
            child.horizontalConstraint,
            child.verticalConstraint
          )
      const childChanges: Partial<SceneNode> = {
        ...rect,
        ...scaledGeometryChanges(original, original.width, original.height, rect.width, rect.height)
      }
      changes.set(childId, childChanges)
      // The final pass sees layout containers after Yoga has resolved HUG/FILL sizing.
      compute(childId, original, child.layoutMode === 'NONE' ? rect : child)
    }
  }

  compute(rootId, rootBefore, rootAfter)
  return changes
}
