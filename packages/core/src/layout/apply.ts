import type { Node as YogaNode } from 'yoga-layout'

import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import { layoutConstrainedChildRect } from '@open-pencil/scene-graph/resize'

import { keepsSavedLayout, usesDetachedDerivedLayout } from './derived'

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

type LayoutGeometry = Partial<Pick<SceneNode, 'x' | 'y' | 'width' | 'height'>>

/**
 * Writes only the geometry layout changed. Laying out a large page leaves most layers where they
 * were, and each write would notify every graph listener for nothing. A frame it resizes from
 * `before`, by default the size it has, places the layers its constraints govern; `constrained`
 * marks a write those constraints made.
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
  const changes: LayoutGeometry = {}
  for (const key of ['x', 'y', 'width', 'height'] as const) {
    const value = geometry[key]
    if (value !== undefined && value !== node[key]) changes[key] = value
  }
  if (Object.keys(changes).length > 0) graph.updateNode(id, changes)
  if (!CONSTRAINT_PARENT_TYPES.has(node.type)) return
  // A constraint resizing a frame is an edit's consequence even the first time.
  if (!laidOutBefore(graph, id) && !constrained) return
  if (from.width !== node.width || from.height !== node.height) {
    constrainChildren(graph, node, from, computeLayout)
  }
}

type LayoutRuns = { depth: number; seen: Set<string>; current: Set<string> }

/** Frames each finished layout run placed or sized, and those the run in progress has. */
const layoutRuns = new WeakMap<SceneGraph, LayoutRuns>()

function runsOf(graph: SceneGraph): LayoutRuns {
  let runs = layoutRuns.get(graph)
  if (!runs) {
    runs = { depth: 0, seen: new Set(), current: new Set() }
    layoutRuns.set(graph, runs)
  }
  return runs
}

/** Lays out within one run; frames it reaches count as laid out once the outermost run ends. */
export function inLayoutRun(graph: SceneGraph, run: () => void): void {
  const runs = runsOf(graph)
  runs.depth++
  try {
    run()
  } finally {
    runs.depth--
    if (runs.depth === 0) {
      for (const id of runs.current) runs.seen.add(id)
      runs.current.clear()
    }
  }
}

/**
 * Whether an earlier layout run reached a frame. Opening a file lays every frame out for the
 * first time, in one run that may size a frame more than once; a size that differs from the one
 * the file saved is ours, not an edit, so the children keep the places the file gave them.
 */
function laidOutBefore(graph: SceneGraph, id: string): boolean {
  const runs = runsOf(graph)
  runs.current.add(id)
  return runs.seen.has(id)
}

/** The size each Hug frame had after layout last ran on it. */
const huggedSizes = new WeakMap<SceneGraph, Map<string, { width: number; height: number }>>()

function huggedSizesOf(graph: SceneGraph) {
  let sizes = huggedSizes.get(graph)
  if (!sizes) {
    sizes = new Map()
    huggedSizes.set(graph, sizes)
  }
  return sizes
}

const CONSTRAINT_PARENT_TYPES: ReadonlySet<SceneNode['type']> = new Set([
  'FRAME',
  'COMPONENT',
  'COMPONENT_SET',
  'INSTANCE'
])

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
    const size = { width: child.width, height: child.height }
    writeLayoutGeometry(
      graph,
      child.id,
      layoutConstrainedChildRect(
        child,
        before,
        frame,
        child.horizontalConstraint,
        child.verticalConstraint
      ),
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
function hugStart(graph: SceneGraph, frame: SceneNode): { width: number; height: number } | null {
  const row = frame.layoutMode === 'HORIZONTAL'
  const hugsWidth = (row ? frame.primaryAxisSizing : frame.counterAxisSizing) === 'HUG'
  const hugsHeight = (row ? frame.counterAxisSizing : frame.primaryAxisSizing) === 'HUG'
  if (!hugsWidth && !hugsHeight) {
    huggedSizesOf(graph).delete(frame.id)
    laidOutBefore(graph, frame.id)
    return null
  }
  const hugged = huggedSizesOf(graph).get(frame.id)
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

  const before = hugStart(graph, frame)
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
  huggedSizesOf(graph).set(frame.id, { width: frame.width, height: frame.height })
}

function computedChildPosition(
  child: SceneNode,
  yogaChild: YogaNode,
  axis: 'x' | 'y',
  preservesImportedGeometry: boolean,
  keepsSaved: boolean
): number {
  if (preservesImportedGeometry) return child[axis]
  const computed = axis === 'x' ? yogaChild.getComputedLeft() : yogaChild.getComputedTop()
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
      x: computedChildPosition(child, yogaChild, 'x', preservesImportedPosition, keepsSaved),
      y: computedChildPosition(child, yogaChild, 'y', preservesImportedPosition, keepsSaved),
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
  let yogaIndex = 0
  for (const child of children) {
    if (yogaIndex >= yogaNode.getChildCount()) continue
    const yogaChild = yogaNode.getChild(yogaIndex)
    yogaIndex++

    updateChildFromYoga(graph, frame, child, yogaChild, keepsSaved, computeLayout)

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
