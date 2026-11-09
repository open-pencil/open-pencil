import { Direction, Display, Gutter, Overflow, type Node as YogaNode } from 'yoga-layout'

import { resolveNodeLayoutDirection } from '@open-pencil/scene-graph/text/direction'

import { applyYogaLayout } from './layout/apply'
import {
  asFlatLeaf,
  asLaidOutIn,
  fillKeepsSizeInHuggingParent,
  heldHugAxes,
  ownAxisSizing,
  setCrossAxisSizing,
  setMainAxisSizing
} from './layout/axis-sizing'
import { keepsSavedLayout, usesDetachedDerivedLayout } from './layout/derived'
import { applyEffectiveGeneratedTextLayout } from './layout/effective-generated-text'
import { insertFlowBox, setFlexFlow, setFlowEdges } from './layout/flow-edges'
import { buildGridTree, createGridChildNode } from './layout/grid'
import { sizeAutoResizingText } from './layout/text/auto-resize'
export { sizeAutoResizingText } from './layout/text/auto-resize'
export {
  estimateTextSize,
  getTextMeasurer,
  installTextMeasurer,
  setTextMeasurer,
  type TextMeasurer
} from './layout/text/measurement'
import type { LayoutSizing, SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import { connectorSublayers, layoutConnector } from '@open-pencil/scene-graph/connectors'
import { layoutSizing } from '@open-pencil/scene-graph/layout'

import { fitShapeWithTextFrame } from './layout/shape-with-text'
import { configureTextLeaf, configureTextLeafWithoutMeasurer } from './layout/text/leaf'
import { getTextMeasurer } from './layout/text/measurement'
import {
  applyMinMaxConstraints,
  applyLockedAspectRatio,
  configureAbsoluteChild,
  configureNonTextLeaf,
  createYogaNode,
  freeYogaTree,
  mapAlignSelf,
  mapGridTracks,
  parentStretchedAxis,
  setLayoutPadding,
  setYogaFlexGrow,
  setYogaGap,
  setYogaHeight,
  setYogaMinSize,
  setYogaWidth
} from './layout/yoga-helpers'

export function computeLayout(graph: SceneGraph, frameId: string): void {
  graph.withLayoutMutations(() => computeLayoutInternal(graph, frameId))
}

function computeLayoutInternal(graph: SceneGraph, frameId: string): void {
  const frame = graph.getNode(frameId)
  if (!frame || frame.layoutMode === 'NONE') return
  // A shape with text takes its size from its label before laying the label out in it.
  fitShapeWithTextFrame(graph, frame)

  const rootDirection = resolveComputedLayoutDirection(graph, frame)
  const yogaDirection = rootDirection === 'RTL' ? Direction.RTL : Direction.LTR
  const yogaRoot =
    frame.layoutMode === 'GRID'
      ? buildGridTree(graph, frame, rootDirection)
      : buildYogaTree(graph, frame, rootDirection)
  try {
    yogaRoot.calculateLayout(undefined, undefined, yogaDirection)
    applyYogaLayout(graph, frame, yogaRoot, computeLayoutInternal)
  } finally {
    freeLayoutTree(yogaRoot)
  }
}

/**
 * Frees a layout tree even when laying it out threw. A layout that failed a Yoga assertion leaves
 * the module unable to free anything, which must not replace the error that failed the layout.
 */
function freeLayoutTree(yogaRoot: YogaNode): void {
  try {
    freeYogaTree(yogaRoot)
  } catch (error) {
    console.warn('Could not free the layout tree', error)
  }
}
function resolveComputedLayoutDirection(
  graph: SceneGraph,
  node: Pick<SceneNode, 'layoutDirection' | 'parentId'>
): 'LTR' | 'RTL' {
  const parent = node.parentId ? graph.getNode(node.parentId) : null
  const inheritedDirection = parent ? resolveComputedLayoutDirection(graph, parent) : 'LTR'
  return resolveNodeLayoutDirection(node, inheritedDirection)
}

export function computeAllLayouts(graph: SceneGraph, scopeId?: string): void {
  computeSubtreeLayouts(graph, scopeId ?? graph.rootId, new Set())
}

export function computeSubtreeLayouts(
  graph: SceneGraph,
  rootId: string,
  relaidInstances: ReadonlySet<string>
): void {
  graph.withLayoutMutations(() => {
    computeLayoutsBottomUp(graph, rootId, new Set(), relaidInstances)
    if (applyEffectiveGeneratedTextLayout(graph, rootId)) {
      computeLayoutsBottomUp(graph, rootId, new Set(), relaidInstances)
    }
    routeUnroutedConnectors(graph, rootId)
  })
}

/**
 * Routes each connector that has no route yet, as one read from a file that saved none, once its
 * label is measured, as FigJam routes such a connector when it opens. A saved route is kept.
 */
export function routeUnroutedConnectors(graph: SceneGraph, rootId: string): void {
  for (const { node } of graph.flattenTree(rootId)) {
    if (node.type !== 'CONNECTOR') continue
    const line = connectorSublayers(graph, node)?.line
    if (!line || (line.vectorNetwork?.vertices.length ?? 0) > 0) continue
    sizeAutoResizingText(graph, node.id)
    layoutConnector(graph, node)
  }
}

/**
 * Gives content an author wrote, such as design JSX, HTML, or a `.pen` file, the sizes and
 * positions its layout implies, which the source does not store, measuring its text first.
 * Documents that store their geometry, such as `.fig` files, keep theirs and do not come here.
 */
export function layoutAuthoredNodes(graph: SceneGraph, rootIds: Iterable<string>): void {
  const roots = [...rootIds]
  const pageIds = new Set<string>()
  let outsidePages = false
  for (const id of roots) {
    sizeAutoResizingText(graph, id)
    const page = graph.pageOf(id)
    if (page !== null) pageIds.add(page)
    else outsidePages = true
  }
  const layout = () => {
    if (outsidePages) computeAllLayouts(graph)
    else for (const pageId of pageIds) computeAllLayouts(graph, pageId)
  }
  layout()
  // Layout gives wrapping text its width, which its height follows.
  if (roots.map((id) => sizeAutoResizingText(graph, id, true)).some(Boolean)) layout()
  // Connectors authored with the layers they join route once those layers are in place.
  for (const id of roots) {
    for (const { node } of graph.flattenTree(id)) {
      if (node.type === 'CONNECTOR') layoutConnector(graph, node)
    }
  }
}

function computeLayoutsBottomUp(
  graph: SceneGraph,
  nodeId: string,
  visited: Set<string>,
  relaidInstances: ReadonlySet<string>
): void {
  const node = graph.getNode(nodeId)
  if (!node || visited.has(nodeId)) return
  visited.add(nodeId)

  for (const childId of node.childIds) {
    computeLayoutsBottomUp(graph, childId, visited, relaidInstances)
  }

  const keepsSavedInstanceLayout =
    preservesImportedInstanceLayout(node) && !relaidInstances.has(nodeId)
  if (node.layoutMode !== 'NONE' && !keepsSavedInstanceLayout) {
    computeLayout(graph, nodeId)
  }
}

function preservesImportedInstanceLayout(node: SceneNode): boolean {
  return node.type === 'INSTANCE' && node.source.format === 'fig'
}

function buildYogaTree(
  graph: SceneGraph,
  frame: SceneNode,
  inheritedDirection: 'LTR' | 'RTL'
): YogaNode {
  const root = createYogaNode()
  const direction = resolveNodeLayoutDirection(frame, inheritedDirection)

  if (frame.primaryAxisSizing === 'FIXED') {
    if (frame.layoutMode === 'HORIZONTAL') setYogaWidth(root, frame.width)
    else setYogaHeight(root, frame.height)
  }
  if (frame.counterAxisSizing === 'FIXED') {
    if (frame.layoutMode === 'HORIZONTAL') setYogaHeight(root, frame.height)
    else setYogaWidth(root, frame.width)
  }
  // Laid out on its own, a frame its parent stretches keeps the size the parent gave it on
  // that axis, so its content aligns within that size rather than within a hug.
  const stretchedAxis = parentStretchedAxis(graph, frame)
  if (stretchedAxis === 'width') setYogaWidth(root, frame.width)
  if (stretchedAxis === 'height') setYogaHeight(root, frame.height)
  const heldAxes = heldHugAxes(graph, frame)
  if (heldAxes.includes('width')) setYogaWidth(root, frame.width)
  if (heldAxes.includes('height')) setYogaHeight(root, frame.height)

  configureFlexContainer(root, frame, direction)
  insertFlexChildren(root, frame, graph, direction)

  return root
}

function insertFlexChildren(
  yogaParent: YogaNode,
  parent: SceneNode,
  graph: SceneGraph,
  direction: 'LTR' | 'RTL'
): void {
  const box = insertFlowBox(yogaParent, parent)
  const flow: YogaNode[] = []
  for (const node of graph.getChildren(parent.id)) {
    const child = asLaidOutIn(graph, node, parent)
    const yogaChild = createYogaNode()

    if (child.layoutPositioning === 'ABSOLUTE') {
      configureAbsoluteChild(yogaChild, child)
    } else if (!child.visible) {
      yogaChild.setDisplay(Display.None)
    } else {
      configureInFlowChild(yogaChild, child, parent, graph, direction)
      flow.push(yogaChild)
    }

    box.insertChild(yogaChild, box.getChildCount())
  }
  setFlowEdges(yogaParent, box, parent, flow, direction)
}

function configureInFlowChild(
  yogaChild: YogaNode,
  child: SceneNode,
  parent: SceneNode,
  graph: SceneGraph,
  direction: 'LTR' | 'RTL'
): void {
  if (child.layoutMode === 'GRID') {
    configureChildAsGrid(yogaChild, child, parent, graph, direction)
  } else if (child.layoutMode !== 'NONE') {
    configureChildAsAutoLayout(yogaChild, child, parent, graph, direction)
  } else {
    configureChildAsLeaf(yogaChild, child, parent, graph)
  }
}

function configureFlexContainer(
  yogaNode: YogaNode,
  node: SceneNode,
  direction: Exclude<SceneNode['layoutDirection'], 'AUTO'>
): void {
  yogaNode.setDirection(direction === 'RTL' ? Direction.RTL : Direction.LTR)
  setFlexFlow(yogaNode, node)
  if (node.clipsContent) yogaNode.setOverflow(Overflow.Hidden)
  setLayoutPadding(yogaNode, node)
  applyMinMaxConstraints(yogaNode, node)
}

function configureChildAsGrid(
  yogaChild: YogaNode,
  child: SceneNode,
  parent: SceneNode,
  graph: SceneGraph,
  inheritedDirection: 'LTR' | 'RTL'
): void {
  const direction = resolveNodeLayoutDirection(child, inheritedDirection)
  yogaChild.setDisplay(Display.Grid)
  yogaChild.setDirection(direction === 'RTL' ? Direction.RTL : Direction.LTR)

  if (child.gridTemplateColumns.length > 0) {
    yogaChild.setGridTemplateColumns(mapGridTracks(child.gridTemplateColumns))
  }
  if (child.gridTemplateRows.length > 0) {
    yogaChild.setGridTemplateRows(mapGridTracks(child.gridTemplateRows))
  }

  setYogaGap(yogaChild, Gutter.Column, child.gridColumnGap)
  setYogaGap(yogaChild, Gutter.Row, child.gridRowGap)

  setLayoutPadding(yogaChild, child)

  const isParentRow = parent.layoutMode === 'HORIZONTAL'
  const selfOverride = child.layoutAlignSelf !== 'AUTO'
  const stretchCross = selfOverride
    ? child.layoutAlignSelf === 'STRETCH'
    : parent.counterAxisAlign === 'STRETCH'

  if (child.layoutGrow > 0) {
    setYogaFlexGrow(yogaChild, child.layoutGrow)
    yogaChild.setFlexShrink(1)
    yogaChild.setFlexBasis(0)
    if (!stretchCross) {
      if (isParentRow) setYogaHeight(yogaChild, child.height)
      else setYogaWidth(yogaChild, child.width)
    }
  } else {
    if (isParentRow) {
      setYogaWidth(yogaChild, child.width)
      if (!stretchCross) setYogaHeight(yogaChild, child.height)
    } else {
      if (child.gridTemplateRows.length > 0) setYogaHeight(yogaChild, child.height)
      if (!stretchCross) setYogaWidth(yogaChild, child.width)
    }
  }

  const selfAlign = mapAlignSelf(child.layoutAlignSelf)
  if (selfAlign != null) yogaChild.setAlignSelf(selfAlign)

  applyLockedAspectRatio(yogaChild, child, parent)
  applyMinMaxConstraints(yogaChild, child)

  const grandchildren = graph.getChildren(child.id)
  for (const gc of grandchildren) {
    if (gc.layoutPositioning === 'ABSOLUTE') {
      const yogaGC = createYogaNode()
      configureAbsoluteChild(yogaGC, gc)
      yogaChild.insertChild(yogaGC, yogaChild.getChildCount())
    } else {
      yogaChild.insertChild(createGridChildNode(graph, gc), yogaChild.getChildCount())
    }
  }
}

function sizesFitParent(
  parent: SceneNode,
  childCount: number,
  sizes: Array<number | undefined>,
  axis: 'width' | 'height'
): boolean {
  if (sizes.some((size) => size === undefined)) return false
  const padding =
    axis === 'width'
      ? parent.paddingLeft + parent.paddingRight
      : parent.paddingTop + parent.paddingBottom
  const gap =
    parent.primaryAxisAlign === 'SPACE_BETWEEN'
      ? 0
      : parent.itemSpacing * Math.max(0, childCount - 1)
  const available = axis === 'width' ? parent.width : parent.height
  const total = sizes.reduce<number>((sum, size) => sum + (size ?? 0), padding + gap)
  return Math.abs(total - available) < 0.001
}

function derivedMainAxisFitsParent(
  graph: SceneGraph,
  parent: SceneNode,
  child: SceneNode,
  axis: 'width' | 'height'
): boolean {
  if (!keepsSavedLayout(graph, parent)) return false
  const children = graph
    .getChildren(parent.id)
    .filter((candidate) => candidate.visible && candidate.layoutPositioning !== 'ABSOLUTE')
  if (children.length === 0) return false

  const sizes = children.map((candidate) => candidate.derivedLayout?.[axis])
  return (
    sizesFitParent(parent, children.length, sizes, axis) &&
    child.derivedLayout?.[axis] !== undefined
  )
}

function configureAutoLayoutChildSizing(
  yogaChild: YogaNode,
  child: SceneNode,
  parent: SceneNode,
  graph: SceneGraph,
  widthSizing: LayoutSizing,
  heightSizing: LayoutSizing
): void {
  const isParentRow = parent.layoutMode === 'HORIZONTAL'
  const fixedDerivedMainAxis = isParentRow
    ? derivedMainAxisFitsParent(graph, parent, child, 'width')
    : derivedMainAxisFitsParent(graph, parent, child, 'height')

  if (isParentRow) {
    if (fixedDerivedMainAxis) setYogaWidth(yogaChild, child.derivedLayout?.width ?? child.width)
    else setMainAxisSizing(yogaChild, 'width', widthSizing, child.width, child.layoutGrow)
    const keepsSize = fillKeepsSizeInHuggingParent(child, parent, 'height')
    setCrossAxisSizing(yogaChild, 'height', heightSizing, child.height, keepsSize)
    return
  }

  const keepsSize = fillKeepsSizeInHuggingParent(child, parent, 'width')
  setCrossAxisSizing(yogaChild, 'width', widthSizing, child.width, keepsSize)
  if (fixedDerivedMainAxis) setYogaHeight(yogaChild, child.derivedLayout?.height ?? child.height)
  else setMainAxisSizing(yogaChild, 'height', heightSizing, child.height, child.layoutGrow)
}

function configureChildAsAutoLayout(
  yogaChild: YogaNode,
  child: SceneNode,
  parent: SceneNode,
  graph: SceneGraph,
  inheritedDirection: 'LTR' | 'RTL'
): void {
  const direction = resolveNodeLayoutDirection(child, inheritedDirection)
  const widthSizing = layoutSizing(graph, child, 'HORIZONTAL')
  const heightSizing = layoutSizing(graph, child, 'VERTICAL')

  configureAutoLayoutChildSizing(yogaChild, child, parent, graph, widthSizing, heightSizing)

  const selfAlign = mapAlignSelf(child.layoutAlignSelf)
  if (selfAlign != null) yogaChild.setAlignSelf(selfAlign)
  applyLockedAspectRatio(yogaChild, child, parent)

  if (usesDetachedDerivedLayout(graph, child)) {
    // The imported size is what the child's own hug produced, whether or not it also fills.
    const derived = child.derivedLayout
    if (ownAxisSizing(child, 'width') === 'HUG') {
      setYogaWidth(yogaChild, derived?.width ?? child.width)
    }
    if (ownAxisSizing(child, 'height') === 'HUG') {
      setYogaHeight(yogaChild, derived?.height ?? child.height)
    }
    applyMinMaxConstraints(yogaChild, child)
    return
  }

  configureFlexContainer(yogaChild, child, direction)
  const heldAxes = heldHugAxes(graph, child)
  if (heldAxes.includes('width') && widthSizing === 'HUG') setYogaWidth(yogaChild, child.width)
  if (heldAxes.includes('height') && heightSizing === 'HUG') setYogaHeight(yogaChild, child.height)

  insertFlexChildren(yogaChild, child, graph, direction)
}

function derivedGrowingLeafFitsParent(
  graph: SceneGraph,
  parent: SceneNode,
  child: SceneNode,
  axis: 'width' | 'height'
): boolean {
  if (child.type !== 'TEXT' || child.layoutGrow <= 0 || child.derivedLayout?.[axis] === undefined) {
    return false
  }
  const children = graph
    .getChildren(parent.id)
    .filter((candidate) => candidate.visible && candidate.layoutPositioning !== 'ABSOLUTE')
  const sizes = children.map((candidate) => {
    if (candidate.layoutGrow > 0) return candidate.derivedLayout?.[axis]
    return axis === 'width' ? candidate.width : candidate.height
  })
  return sizesFitParent(parent, children.length, sizes, axis)
}

function configureChildAsLeaf(
  yogaChild: YogaNode,
  node: SceneNode,
  parent: SceneNode,
  graph: SceneGraph
): void {
  const child = asFlatLeaf(node, parent)
  const isRow = parent.layoutMode === 'HORIZONTAL'
  const selfOverride = child.layoutAlignSelf !== 'AUTO'
  const stretchCross = selfOverride
    ? child.layoutAlignSelf === 'STRETCH'
    : parent.counterAxisAlign === 'STRETCH'

  const isText = child.type === 'TEXT'
  const textMeasurer = getTextMeasurer()
  const needsMeasureFunc = isText && textMeasurer && child.textAutoResize !== 'NONE'

  const fixedDerivedMainAxis = isRow
    ? derivedGrowingLeafFitsParent(graph, parent, child, 'width')
    : derivedGrowingLeafFitsParent(graph, parent, child, 'height')

  if (fixedDerivedMainAxis) {
    if (isRow) setYogaWidth(yogaChild, child.derivedLayout?.width ?? child.width)
    else setYogaHeight(yogaChild, child.derivedLayout?.height ?? child.height)
  }

  if (needsMeasureFunc) {
    configureTextLeaf(yogaChild, child, parent, fixedDerivedMainAxis)
  } else if (isText && !textMeasurer && child.textAutoResize !== 'NONE') {
    configureTextLeafWithoutMeasurer(yogaChild, child, parent, fixedDerivedMainAxis)
  } else {
    configureNonTextLeaf(yogaChild, child, isRow, stretchCross)
    // Fixed text still contributes its box to a HUG cross axis. Without
    // an intrinsic minimum, stretch collapses the text to its siblings.
    if (isText && stretchCross && parent.counterAxisSizing === 'HUG') {
      if (isRow) setYogaMinSize(yogaChild, 'height', child.height)
      else setYogaMinSize(yogaChild, 'width', child.width)
    }
  }

  const selfAlign = mapAlignSelf(child.layoutAlignSelf)
  if (selfAlign != null) yogaChild.setAlignSelf(selfAlign)

  applyLockedAspectRatio(yogaChild, child, parent)
  applyMinMaxConstraints(yogaChild, child)
}
