import { CONSTRAINT_PARENT_TYPES } from './constraints'
import { getNodeLocalMatrix } from './coordinate'
import {
  cloneVectorNetwork,
  copyDerivedGlyphs,
  copyGeometryPaths,
  copyStroke,
  copyStrokes,
  scaleGeometryPaths
} from './copy'
import { groupFitChanges } from './group-bounds'
import { enforcedAspectRatio } from './layout/aspect-ratio'
import Matrix, { type Mat3 } from './matrix'
import { FITTED_CONTAINER_TYPES } from './node-defaults'
import type { Rect } from './primitives'
import type { ConstraintType, DerivedTextGlyph, SceneNode, Stroke, VectorNetwork } from './types'

/**
 * Drag-start state a live resize re-scales from. Path text needs more than the
 * layout rect: its OUTSIDE stroke silhouettes and glyph outlines are baked
 * geometry that must scale with the node, and textPathBox is the layout box the
 * glyphs were reflowed against.
 */
export type ResizeSnapshot = Pick<
  SceneNode,
  | 'type'
  | 'x'
  | 'y'
  | 'width'
  | 'height'
  | 'flipX'
  | 'flipY'
  | 'vectorNetwork'
  | 'fillGeometry'
  | 'strokeGeometry'
  | 'derivedTextGlyphs'
  | 'strokes'
  | 'textPathData'
  | 'textPathBox'
>

interface ResizeGraph {
  readonly rootId: string
  getNode(id: string): SceneNode | undefined
}

/**
 * Containers whose resize moves their children: the constraint parents, and groups and booleans,
 * which scale theirs.
 */
const CONSTRAINT_CONTAINER_TYPES = new Set<SceneNode['type']>([
  ...CONSTRAINT_PARENT_TYPES,
  ...FITTED_CONTAINER_TYPES
])

type AxisPlacement = { position: number; size: number; flipped?: boolean }

/** A child's box after its parent resizes, and the axes on which it turned over. */
export type ConstrainedRect = Rect & { flipsX?: boolean; flipsY?: boolean }

/**
 * Where a constraint places a child on one axis when its parent goes from `parentBefore` to
 * `parentAfter`, as Figma does (live-measured, #1060, #1816): Right and Left & right move or grow
 * it by the change in the parent's size rounded to whole pixels, Center by the change in its
 * rounded half, and Scale by the exact ratio. The child's own box is never rounded, so a resize
 * to the same size changes nothing. Left & right that would leave no size keeps the axis as it
 * was; past zero, the child turns over and its box runs back from the edge it was pinned to, as
 * the layer is mirrored in Figma.
 */
function constrainedAxis(
  position: number,
  size: number,
  parentBefore: number,
  parentAfter: number,
  constraint: ConstraintType
): AxisPlacement {
  const delta = Math.round(parentAfter) - Math.round(parentBefore)
  if (constraint === 'MAX') return { position: position + delta, size }
  if (constraint === 'CENTER') {
    return { position: position + Math.round(parentAfter / 2) - Math.round(parentBefore / 2), size }
  }
  if (constraint === 'STRETCH') {
    const stretched = size + delta
    if (stretched === 0) return { position, size }
    if (stretched > 0) return { position, size: stretched }
    return { position: position + stretched, size: -stretched, flipped: true }
  }
  if (constraint === 'SCALE' && parentBefore > 0) {
    const scale = parentAfter / parentBefore
    return { position: position * scale, size: size * scale }
  }
  return { position, size }
}

const FLEXIBLE_CONSTRAINTS: ReadonlySet<ConstraintType> = new Set(['STRETCH', 'SCALE'])

/** The axis at `size`, keeping the edge or centre its constraint pins where it was placed. */
function resizedInPlace(
  placed: AxisPlacement,
  size: number,
  constraint: ConstraintType
): AxisPlacement {
  if (constraint === 'MAX') return { position: placed.position + placed.size - size, size }
  if (constraint === 'CENTER') return { position: placed.position + (placed.size - size) / 2, size }
  return { position: placed.position, size }
}

/** Keep a placed box's constrained edges or center when its content determines its size. */
export function resizedChildRect(
  placed: Rect,
  size: Pick<Rect, 'width' | 'height'>,
  horizontal: ConstraintType,
  vertical: ConstraintType
): Rect {
  const x = resizedInPlace({ position: placed.x, size: placed.width }, size.width, horizontal)
  const y = resizedInPlace({ position: placed.y, size: placed.height }, size.height, vertical)
  return { x: x.position, y: y.position, width: x.size, height: y.size }
}

/**
 * A locked aspect ratio holds when exactly one axis follows the parent, as in Figma: that axis
 * sizes the other. With both axes following the parent, or neither, the ratio gives way.
 */
function keepLockedRatio(
  x: AxisPlacement,
  y: AxisPlacement,
  horizontal: ConstraintType,
  vertical: ConstraintType,
  aspectRatio: number | null
): { x: AxisPlacement; y: AxisPlacement } {
  const flexibleX = FLEXIBLE_CONSTRAINTS.has(horizontal)
  if (aspectRatio === null || flexibleX === FLEXIBLE_CONSTRAINTS.has(vertical)) return { x, y }
  return flexibleX
    ? { x, y: resizedInPlace(y, x.size / aspectRatio, vertical) }
    : { x: resizedInPlace(x, y.size * aspectRatio, horizontal), y }
}

/**
 * A child's box after its parent resizes, by a handle, `resize()`, layout, or an instance taking
 * another size than its component, keeping a locked aspect ratio as Figma does.
 */
export function constrainedChildRect(
  child: Rect,
  parentBefore: Pick<Rect, 'width' | 'height'>,
  parentAfter: Pick<Rect, 'width' | 'height'>,
  horizontal: ConstraintType,
  vertical: ConstraintType,
  aspectRatio: number | null = null
): ConstrainedRect {
  const { x, y } = keepLockedRatio(
    constrainedAxis(child.x, child.width, parentBefore.width, parentAfter.width, horizontal),
    constrainedAxis(child.y, child.height, parentBefore.height, parentAfter.height, vertical),
    horizontal,
    vertical,
    aspectRatio
  )
  const rect: ConstrainedRect = { x: x.position, y: y.position, width: x.size, height: y.size }
  if (x.flipped) rect.flipsX = true
  if (y.flipped) rect.flipsY = true
  return rect
}

export function scaledChildRect(
  child: Rect,
  parentBefore: Pick<Rect, 'width' | 'height'>,
  parentAfter: Pick<Rect, 'width' | 'height'>
): Rect {
  return constrainedChildRect(child, parentBefore, parentAfter, 'SCALE', 'SCALE')
}

/** How much a side grows; a flat side, as a straight line's, has nothing to scale along it. */
function sideScale(original: number, size: number): number {
  return original > 0 ? size / original : 1
}

export function scaleVectorNetworkForResize(
  vectorNetwork: VectorNetwork | null,
  originalWidth: number,
  originalHeight: number,
  width: number,
  height: number
): VectorNetwork | null {
  if (!vectorNetwork || (originalWidth <= 0 && originalHeight <= 0)) return null

  const scaleX = sideScale(originalWidth, width)
  const scaleY = sideScale(originalHeight, height)
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
    type: node.type,
    x: node.x,
    y: node.y,
    width: node.width,
    height: node.height,
    flipX: node.flipX,
    flipY: node.flipY,
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

function hasPath(orig: Pick<ResizeSnapshot, 'vectorNetwork'>): boolean {
  return (orig.vectorNetwork?.segments.length ?? 0) > 0
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
    | 'type'
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
  if (origWidth <= 0 && origHeight <= 0) return {}
  // A straight line's other side still scales.
  const sx = sideScale(origWidth, width)
  const sy = sideScale(origHeight, height)
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
  // A stroke keeps its weight through a resize, as in Figma, so a saved stroke outline goes where
  // the stroke can be drawn again at its weight: from a path, or from a shape's own outline.
  // Text and a vector with only its outline keep scaling the outline, which is all they have.
  const outlineOnly = orig.type === 'TEXT' || (orig.type === 'VECTOR' && !hasPath(orig))
  if (orig.strokeGeometry.length > 0) {
    changes.strokeGeometry = outlineOnly ? scaleGeometryPaths(orig.strokeGeometry, sx, sy) : []
  }
  // Path text scales with its path, including baked path text that kept only rotated glyphs;
  // other text reflows in the new box, so its glyphs are dropped.
  const glyphs = orig.derivedTextGlyphs ?? []
  const pathText =
    !!orig.textPathData || !!orig.textPathBox || glyphs.some((glyph) => (glyph.rotation ?? 0) !== 0)
  if (glyphs.length > 0 && pathText) {
    changes.derivedTextGlyphs = scaleDerivedGlyphs(glyphs, sx, sy)
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
  // Glyphs scaled as a picture take their strokes along; any other stroke keeps its weight, as
  // Figma reports it, even where only a scaled outline can draw it.
  if (orig.strokes.length > 0 && glyphs.length > 0 && pathText) {
    changes.strokes = scaleStrokes(orig.strokes, sx, sy)
  }
  return changes
}

/** Copies of the geometry a resize may change, as the snapshot held it before the resize. */
function snapshotGeometry(orig: ResizeSnapshot): Partial<SceneNode> {
  return {
    vectorNetwork: orig.vectorNetwork ? cloneVectorNetwork(orig.vectorNetwork) : null,
    fillGeometry: copyGeometryPaths(orig.fillGeometry),
    strokeGeometry: copyGeometryPaths(orig.strokeGeometry),
    derivedTextGlyphs: copyDerivedGlyphs(orig.derivedTextGlyphs),
    strokes: copyStrokes(orig.strokes),
    textPathBox: orig.textPathBox ? { ...orig.textPathBox } : null
  }
}

/** Whether a box of `size` scales the snapshot's geometry, a flat side left out. */
function scalesGeometry(orig: ResizeSnapshot, size: Pick<Rect, 'width' | 'height'>): boolean {
  return sideScale(orig.width, size.width) !== 1 || sideScale(orig.height, size.height) !== 1
}

/**
 * A child's geometry for its constrained `box`, scaled from the snapshot. At a box that scales
 * nothing, after an earlier frame of the same drag scaled it, the child takes its snapshot
 * geometry again, as nothing else would undo that scaling.
 */
function constrainedGeometryChanges(
  orig: ResizeSnapshot,
  current: Pick<SceneNode, 'width' | 'height'>,
  box: Pick<Rect, 'width' | 'height'>
): Partial<SceneNode> {
  if (scalesGeometry(orig, box))
    return scaledGeometryChanges(orig, orig.width, orig.height, box.width, box.height)
  return scalesGeometry(orig, current) ? snapshotGeometry(orig) : {}
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

/**
 * The flips a child takes when its constraints place it from `from`, written only where they
 * differ from the ones it has now, so a drag that crosses back undoes its own turn.
 */
export function flipChanges(
  from: Pick<SceneNode, 'flipX' | 'flipY'>,
  current: Pick<SceneNode, 'flipX' | 'flipY'>,
  flipsX = false,
  flipsY = false
): Partial<Pick<SceneNode, 'flipX' | 'flipY'>> {
  const changes: Partial<Pick<SceneNode, 'flipX' | 'flipY'>> = {}
  const flipX = from.flipX !== flipsX
  const flipY = from.flipY !== flipsY
  if (flipX !== current.flipX) changes.flipX = flipX
  if (flipY !== current.flipY) changes.flipY = flipY
  return changes
}

type Size = Pick<Rect, 'width' | 'height'>

/** One constrained resize: the graph, where each layer was when it began, and what it changes. */
interface ResizePlan {
  graph: ResizeGraph
  originals: ReadonlyMap<string, ResizeSnapshot>
  changes: Map<string, Partial<SceneNode>>
}

/** The layer as the resize found it, or as the resize leaves it with its changes so far. */
function startOf(plan: ResizePlan, id: string): SceneNode | undefined {
  const node = plan.graph.getNode(id)
  const original = plan.originals.get(id)
  return node && original ? { ...node, ...original } : node
}

function plannedOf(plan: ResizePlan, id: string): SceneNode | undefined {
  const node = startOf(plan, id)
  const changes = plan.changes.get(id)
  return node && changes ? { ...node, ...changes } : node
}

function mergeChanges(plan: ResizePlan, id: string, changes: Partial<SceneNode>) {
  plan.changes.set(id, { ...plan.changes.get(id), ...changes })
}

/** Writes where a layer's constraints put it, then places its own children. */
function placeConstrained(
  plan: ResizePlan,
  child: SceneNode,
  original: ResizeSnapshot,
  rect: ConstrainedRect,
  toParent: Mat3 | null
) {
  const { flipsX, flipsY, ...box } = rect
  const position = toParent ? Matrix.mapPoint(toParent, box) : box
  plan.changes.set(child.id, {
    ...box,
    ...position,
    ...flipChanges(original, child, flipsX, flipsY),
    ...constrainedGeometryChanges(original, child, box)
  })
  // The final pass sees layout containers after Yoga has resolved HUG/FILL sizing.
  placeChildren(plan, child.id, original, child.layoutMode === 'NONE' ? box : child)
}

/**
 * Places the layers in a group or boolean whose frame resized. The group owns no constraints: each
 * layer in it keeps its place in the frame by its own, through nested groups, and the groups then
 * fit around them, as in Figma (live, #1835). A layer is placed in the frame's space and written
 * back in its group's.
 */
function placeGroupedLayers(
  plan: ResizePlan,
  group: SceneNode,
  toFrame: Mat3,
  frameBefore: Size,
  frameAfter: Size
) {
  for (const childId of group.childIds) {
    const child = plan.graph.getNode(childId)
    const original = plan.originals.get(childId)
    const start = startOf(plan, childId)
    if (!child || !original || !start) continue
    if (FITTED_CONTAINER_TYPES.has(child.type)) {
      const inner = Matrix.multiply(toFrame, getNodeLocalMatrix(start))
      placeGroupedLayers(plan, start, inner, frameBefore, frameAfter)
      continue
    }
    const inFrame = Matrix.mapPoint(toFrame, original)
    const rect = constrainedChildRect(
      { ...inFrame, width: original.width, height: original.height },
      frameBefore,
      frameAfter,
      child.horizontalConstraint,
      child.verticalConstraint,
      enforcedAspectRatio(child)
    )
    placeConstrained(plan, child, original, rect, Matrix.invert(toFrame))
  }
  fitPlannedGroup(plan, group.id)
}

const PLACEMENT_KEYS = ['x', 'y', 'width', 'height'] as const

/**
 * Fits a group to its layers where the resize put them, when any of them moved: a boolean's box
 * is its result's, which only the renderer measures, so one whose operands stay keeps its box. A
 * drag places from the start each time, so the group's box is always written.
 */
function fitPlannedGroup(plan: ResizePlan, groupId: string) {
  const group = plannedOf(plan, groupId)
  if (!group) return
  const { x, y, width, height } = group
  mergeChanges(plan, groupId, { x, y, width, height })
  const moved = group.childIds.some((id) => {
    const start = startOf(plan, id)
    const planned = plannedOf(plan, id)
    return start && planned && PLACEMENT_KEYS.some((key) => start[key] !== planned[key])
  })
  if (!moved) return
  const reader = { rootId: plan.graph.rootId, getNode: (id: string) => plannedOf(plan, id) }
  const children = group.childIds.flatMap((id) => reader.getNode(id) ?? [])
  const fit = groupFitChanges(reader, group, children)
  for (const [id, changes] of fit ?? []) mergeChanges(plan, id, changes)
}

/**
 * Places the children of a layer that went from `parentBefore` to `parentAfter`: a frame's by their
 * constraints, the layers in its groups and booleans by theirs, a group's or boolean's own scaled.
 */
function placeChildren(plan: ResizePlan, parentId: string, parentBefore: Size, parentAfter: Size) {
  const parent = plan.graph.getNode(parentId)
  if (!parent) return
  const scalesChildren = FITTED_CONTAINER_TYPES.has(parent.type)
  for (const childId of parent.childIds) {
    const original = plan.originals.get(childId)
    const child = plan.graph.getNode(childId)
    if (!original || !child) continue
    const isInFlow = parent.layoutMode !== 'NONE' && child.layoutPositioning !== 'ABSOLUTE'
    if (isInFlow) {
      placeChildren(plan, childId, original, child)
      continue
    }
    if (!scalesChildren && FITTED_CONTAINER_TYPES.has(child.type)) {
      const start = { ...child, ...original }
      placeGroupedLayers(plan, start, getNodeLocalMatrix(start), parentBefore, parentAfter)
      continue
    }
    const rect: ConstrainedRect = scalesChildren
      ? scaledChildRect(original, parentBefore, parentAfter)
      : constrainedChildRect(
          original,
          parentBefore,
          parentAfter,
          child.horizontalConstraint,
          child.verticalConstraint,
          enforcedAspectRatio(child)
        )
    placeConstrained(plan, child, original, rect, null)
  }
}

/**
 * Where the descendants of a layer go when it resizes from `rootBefore` to `rootAfter`, from the
 * places `originals` recorded.
 */
export function computeConstrainedResizeChanges(
  graph: ResizeGraph,
  rootId: string,
  rootBefore: Size,
  rootAfter: Size,
  originals: ReadonlyMap<string, ResizeSnapshot>
): Map<string, Partial<SceneNode>> {
  const plan: ResizePlan = { graph, originals, changes: new Map() }
  placeChildren(plan, rootId, rootBefore, rootAfter)
  return plan.changes
}
