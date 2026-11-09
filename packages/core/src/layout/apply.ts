import type { Node as YogaNode } from 'yoga-layout'

import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import { CONSTRAINT_PARENT_TYPES } from '@open-pencil/scene-graph/constraints'
import { enforcedAspectRatio } from '@open-pencil/scene-graph/layout'
import { FITTED_CONTAINER_TYPES } from '@open-pencil/scene-graph/node-defaults'
import type { Vector } from '@open-pencil/scene-graph/primitives'
import { constrainedChildRect, flipChanges } from '@open-pencil/scene-graph/resize'

import { keepsSavedLayout, usesDetachedDerivedLayout } from './derived'
import { laidOutFlowBox } from './flow-edges'

export type ComputeLayoutFn = (graph: SceneGraph, frameId: string) => void

function preservesImportedHugCrossSize(
  graph: SceneGraph,
  frame: SceneNode,
  axis: 'width' | 'height'
): boolean {
  if (frame.source.format !== 'fig' || frame.counterAxisSizing !== 'HUG') return false
  const expectedMode = axis === 'width' ? 'VERTICAL' : 'HORIZONTAL'
  if (frame.layoutMode !== expectedMode) return false
  return graph
    .getChildren(frame.id)
    .some(
      (child) => child.layoutAlignSelf === 'STRETCH' && child.derivedLayout?.[axis] !== undefined
    )
}

export type LayoutGeometry = Partial<
  Pick<SceneNode, 'x' | 'y' | 'width' | 'height' | 'flipX' | 'flipY'>
>

/**
 * The geometry changes to write back: only the values that differ, and none that layout could not
 * use. A stored non-finite size can reach layout's arithmetic and overflow it, so the layer keeps
 * the geometry it has rather than a value the document could not hold.
 */
export function layoutGeometryChanges(node: SceneNode, geometry: LayoutGeometry): LayoutGeometry {
  const changes: LayoutGeometry = {}
  for (const key of ['x', 'y', 'width', 'height', 'flipX', 'flipY'] as const) {
    const value = geometry[key]
    if (value === undefined) continue
    if (typeof value === 'number' && !Number.isFinite(value)) continue
    if (value !== node[key]) Object.assign(changes, { [key]: value })
  }
  return changes
}

/**
 * Writes only the geometry layout changed. Laying out a large page leaves most layers where they
 * were, and each write would notify every graph listener for nothing. A frame it resizes from
 * `before`, by default the size it has, places the layers its constraints govern; `constrained`
 * marks a write those constraints made, which places its own children in turn.
 */
function writeLayoutGeometry(
  graph: SceneGraph,
  id: string,
  geometry: LayoutGeometry,
  computeLayout: ComputeLayoutFn,
  before?: { width: number; height: number },
  constrained = false
): void {
  const node = graph.getNode(id)
  if (!node) return
  const from = before ?? { width: node.width, height: node.height }
  const changes = layoutGeometryChanges(node, geometry)
  if (Object.keys(changes).length > 0) graph.updateNode(id, changes)
  if (!CONSTRAINT_PARENT_TYPES.has(node.type)) return
  // Laying out what a file holds, as a page opens or its fonts arrive, resizes a frame only where
  // our layout differs from the one the file saved; its children keep the places it saved.
  if (graph.isApplyingDerivedLayout && !constrained) return
  if (from.width !== node.width || from.height !== node.height) {
    constrainChildren(graph, node, from, computeLayout)
    rememberPlacedSize(node)
  }
}

/**
 * The size each Hug frame's constrained children were last placed for by layout. Keyed by the
 * node, so a deleted frame's entry goes with it and a restored one starts afresh.
 */
const huggedSizes = new WeakMap<SceneNode, { width: number; height: number }>()

/**
 * Records that a Hug frame's constrained children are placed for the size it has now. Undo and
 * redo put back a frame's hugged size together with the places layout gave its children, so the
 * next layout must move them from that size, not from the one it hugged to before.
 */
export function restoredHuggedSize(frame: SceneNode): void {
  if (huggedSizes.has(frame)) huggedSizes.set(frame, { width: frame.width, height: frame.height })
}

function rememberPlacedSize(frame: SceneNode): void {
  const placed = huggedSizes.get(frame)
  if (!placed) {
    return
  }
  placed.width = frame.width
  placed.height = frame.height
}

/**
 * Places the children of a frame layout resized by their constraints: every child of a frame
 * without auto layout, and those that ignore an auto layout, as Figma keeps a badge pinned to the
 * right of a Hug button while its label grows. A child it resizes places its own children, and
 * lays out again when it has auto layout.
 */
function constrainChildren(
  graph: SceneGraph,
  frame: SceneNode,
  before: { width: number; height: number },
  computeLayout: ComputeLayoutFn
): void {
  for (const child of graph.getChildren(frame.id)) {
    if (frame.layoutMode !== 'NONE' && child.layoutPositioning !== 'ABSOLUTE') continue
    // A group or boolean owns no constraints, and layout leaves the layers in it where they are:
    // in Figma a Hug frame grows past an absolute group without moving it (live, 2026-11-08).
    if (FITTED_CONTAINER_TYPES.has(child.type)) continue
    const size = { width: child.width, height: child.height }
    const { flipsX, flipsY, ...box } = constrainedChildRect(
      child,
      before,
      frame,
      child.horizontalConstraint,
      child.verticalConstraint,
      enforcedAspectRatio(child)
    )
    writeLayoutGeometry(
      graph,
      child.id,
      { ...box, ...flipChanges(child, child, flipsX, flipsY) },
      computeLayout,
      undefined,
      true
    )
    const resized = child.width !== size.width || child.height !== size.height
    if (resized && child.layoutMode !== 'NONE') computeLayout(graph, child.id)
  }
}

/**
 * The size a frame's constrained children move from as it hugs, or null when it hugs no axis.
 * An editor that resizes a Hug frame places its children for the size it sets, which layout then
 * hugs back, as when a parent stretches it; its children move only from the size it last hugged
 * to. An axis it does not hug keeps the size it has.
 */
function hugStart(frame: SceneNode): { width: number; height: number } | null {
  const row = frame.layoutMode === 'HORIZONTAL'
  const hugsWidth = (row ? frame.primaryAxisSizing : frame.counterAxisSizing) === 'HUG'
  const hugsHeight = (row ? frame.counterAxisSizing : frame.primaryAxisSizing) === 'HUG'
  if (!hugsWidth && !hugsHeight) {
    huggedSizes.delete(frame)
    return null
  }
  const hugged = huggedSizes.get(frame)
  return {
    width: hugsWidth && hugged ? hugged.width : frame.width,
    height: hugsHeight && hugged ? hugged.height : frame.height
  }
}

function applyFrameSize(
  graph: SceneGraph,
  frame: SceneNode,
  yogaNode: YogaNode,
  keepsSaved: boolean,
  computeLayout: ComputeLayoutFn
): void {
  if (frame.layoutMode === 'GRID') {
    if (frame.gridTemplateRows.length === 0) {
      writeLayoutGeometry(graph, frame.id, { height: yogaNode.getComputedHeight() }, computeLayout)
    }
    return
  }

  const before = hugStart(frame)
  if (!before) return

  const updates: LayoutGeometry = {}
  const derived = keepsSaved ? frame.derivedLayout : null
  const primary = frame.layoutMode === 'HORIZONTAL' ? 'width' : 'height'
  const counter = primary === 'width' ? 'height' : 'width'
  const computed = (axis: 'width' | 'height') =>
    axis === 'width' ? yogaNode.getComputedWidth() : yogaNode.getComputedHeight()
  if (frame.primaryAxisSizing === 'HUG') updates[primary] = derived?.[primary] ?? computed(primary)
  if (frame.counterAxisSizing === 'HUG') {
    updates[counter] =
      keepsSaved && preservesImportedHugCrossSize(graph, frame, counter)
        ? frame[counter]
        : (derived?.[counter] ?? computed(counter))
  }

  writeLayoutGeometry(graph, frame.id, updates, computeLayout, before)
  huggedSizes.set(frame, { width: frame.width, height: frame.height })
}

function computedChildPosition(
  child: SceneNode,
  yogaChild: YogaNode,
  axis: 'x' | 'y',
  origin: number,
  preservesImportedGeometry: boolean,
  keepsSaved: boolean
): number {
  if (preservesImportedGeometry) return child[axis]
  const computed =
    origin + (axis === 'x' ? yogaChild.getComputedLeft() : yogaChild.getComputedTop())
  if (child.type === 'INSTANCE' || !keepsSaved) return computed
  return child.derivedLayout?.[axis] ?? computed
}

function preservesStaleImportedTextSize(child: SceneNode, axis: 'width' | 'height'): boolean {
  const derivedSize = child.derivedLayout?.[axis]
  return (
    child.type === 'TEXT' &&
    child.source.format === 'fig' &&
    derivedSize !== undefined &&
    Math.abs(child[axis] - derivedSize) > 0.001
  )
}

function computedChildSize(
  child: SceneNode,
  yogaChild: YogaNode,
  axis: 'width' | 'height',
  preservesImportedFrameGeometry: boolean,
  keepsSaved: boolean
): number {
  if (
    preservesImportedFrameGeometry ||
    (keepsSaved && preservesStaleImportedTextSize(child, axis))
  ) {
    return child[axis]
  }
  const computed = axis === 'width' ? yogaChild.getComputedWidth() : yogaChild.getComputedHeight()
  if (child.type === 'TEXT' && child.source.format === 'fig') {
    return computed > 0 ? computed : child[axis]
  }
  if (!keepsSaved) return computed
  return child.derivedLayout?.[axis] ?? computed
}

function updateChildFromYoga(
  graph: SceneGraph,
  frame: SceneNode,
  child: SceneNode,
  yogaChild: YogaNode,
  origin: Vector,
  keepsSaved: boolean,
  computeLayout: ComputeLayoutFn
): void {
  if (!child.visible || child.layoutPositioning === 'ABSOLUTE') return

  const savedFig = keepsSaved && child.source.format === 'fig'
  const preservesImportedFrameGeometry =
    savedFig && frame.source.format === 'fig' && (child.type === 'FRAME' || child.type === 'LINE')
  const preservesImportedPosition =
    preservesImportedFrameGeometry || (savedFig && Math.abs(child.rotation) > 0.001)
  writeLayoutGeometry(
    graph,
    child.id,
    {
      x: computedChildPosition(
        child,
        yogaChild,
        'x',
        origin.x,
        preservesImportedPosition,
        keepsSaved
      ),
      y: computedChildPosition(
        child,
        yogaChild,
        'y',
        origin.y,
        preservesImportedPosition,
        keepsSaved
      ),
      width: computedChildSize(
        child,
        yogaChild,
        'width',
        preservesImportedFrameGeometry,
        keepsSaved
      ),
      height: computedChildSize(
        child,
        yogaChild,
        'height',
        preservesImportedFrameGeometry,
        keepsSaved
      )
    },
    computeLayout
  )
}

function preservesImportedInstanceInternals(child: SceneNode): boolean {
  return child.type === 'INSTANCE' && child.source.format === 'fig'
}

function recomputeGridChild(
  graph: SceneGraph,
  child: SceneNode,
  computeLayout: ComputeLayoutFn
): void {
  const updated = graph.getNode(child.id)
  if (!updated || updated.layoutMode === 'NONE') return

  const savedPrimary = updated.primaryAxisSizing
  const savedCounter = updated.counterAxisSizing
  const updates: Partial<SceneNode> = {}

  if (savedPrimary === 'HUG') updates.primaryAxisSizing = 'FIXED'
  if (savedCounter === 'HUG') updates.counterAxisSizing = 'FIXED'
  if (Object.keys(updates).length > 0) graph.updateNode(child.id, updates)

  computeLayout(graph, child.id)

  const restore: Partial<SceneNode> = {}
  if (updates.primaryAxisSizing) restore.primaryAxisSizing = savedPrimary
  if (updates.counterAxisSizing) restore.counterAxisSizing = savedCounter
  if (Object.keys(restore).length > 0) graph.updateNode(child.id, restore)
}

export function applyYogaLayout(
  graph: SceneGraph,
  frame: SceneNode,
  yogaNode: YogaNode,
  computeLayout: ComputeLayoutFn
): void {
  const keepsSaved = keepsSavedLayout(graph, frame)
  applyFrameSize(graph, frame, yogaNode, keepsSaved, computeLayout)

  const children = graph.getChildren(frame.id)
  const box = laidOutFlowBox(yogaNode, frame)
  let yogaIndex = 0
  for (const child of children) {
    if (yogaIndex >= box.node.getChildCount()) continue
    const yogaChild = box.node.getChild(yogaIndex)
    yogaIndex++

    updateChildFromYoga(graph, frame, child, yogaChild, box.origin, keepsSaved, computeLayout)

    if (!child.visible) continue
    if (preservesImportedInstanceInternals(child)) continue

    if (usesDetachedDerivedLayout(graph, child)) {
      computeLayout(graph, child.id)
      continue
    }

    if (child.layoutMode !== 'NONE') {
      if (child.layoutMode === 'GRID' && child.layoutPositioning !== 'ABSOLUTE') {
        computeLayout(graph, child.id)
      } else if (frame.layoutMode === 'GRID' && child.layoutPositioning !== 'ABSOLUTE') {
        recomputeGridChild(graph, child, computeLayout)
      } else {
        applyYogaLayout(graph, child, yogaChild, computeLayout)
      }
    }
  }
}
