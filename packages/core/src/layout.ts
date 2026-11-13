import { resolveNodeLayoutDirection } from '@open-pencil/scene-graph/text/direction'
import { computeLayout as computeBoxes, type LayoutNode } from '@open-pencil/taffy'

import { applyComputedLayout } from './layout/apply'
import {
  asLaidOutIn,
  fillKeepsSizeInHuggingParent,
  heldHugAxes,
  ownAxisSizing,
  setCrossAxisSizing,
  setMainAxisSizing
} from './layout/axis-sizing'
import { usesDetachedDerivedLayout } from './layout/derived'
import { applyEffectiveGeneratedTextLayout } from './layout/effective-generated-text'
import { derivedMainAxisFitsParent } from './layout/fills-parent'
import { insertFlowBox, setFlexFlow, setFlowEdges } from './layout/flow-edges'
import { buildGridTree, createGridChildNode } from './layout/grid'
import { configureChildAsLeaf } from './layout/leaf'
import { sizeAutoResizingText } from './layout/text-auto-resize'
export { sizeAutoResizingText } from './layout/text-auto-resize'
export {
  flowChildren,
  flowGaps,
  PADDING_SIDES,
  paddingOf,
  paddingRect,
  paddingTick,
  type FlowGap,
  type PaddingSide
} from './layout/spacing-marks'
export {
  estimateTextSize,
  getTextMeasurer,
  installTextMeasurer,
  setTextMeasurer,
  type TextMeasurer
} from './layout/text-measurement'
import type { LayoutSizing, SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import { connectorSublayers, layoutConnector } from '@open-pencil/scene-graph/connectors'
import { layoutSizing } from '@open-pencil/scene-graph/layout'

import {
  applyMinMaxConstraints,
  applyLockedAspectRatio,
  configureAbsoluteChild,
  createLayoutNode,
  mapAlignSelf,
  mapGridTrack,
  parentStretchedAxis,
  setLayoutPadding
} from './layout/node'
import { fitShapeWithTextFrame } from './layout/shape-with-text'

export function computeLayout(graph: SceneGraph, frameId: string): void {
  graph.withLayoutMutations(() => computeLayoutInternal(graph, frameId))
}

function computeLayoutInternal(graph: SceneGraph, frameId: string): void {
  const frame = graph.getNode(frameId)
  if (!frame || frame.layoutMode === 'NONE') return
  // A shape with text takes its size from its label before laying the label out in it.
  fitShapeWithTextFrame(graph, frame)

  const rootDirection = resolveComputedLayoutDirection(graph, frame)
  const root =
    frame.layoutMode === 'GRID'
      ? buildGridTree(graph, frame, rootDirection)
      : buildFlexTree(graph, frame, rootDirection)
  computeBoxes(root)
  applyComputedLayout(graph, frame, root, computeLayoutInternal)
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

function buildFlexTree(
  graph: SceneGraph,
  frame: SceneNode,
  inheritedDirection: 'LTR' | 'RTL'
): LayoutNode {
  const root = createLayoutNode()
  const direction = resolveNodeLayoutDirection(frame, inheritedDirection)

  if (frame.primaryAxisSizing === 'FIXED') {
    if (frame.layoutMode === 'HORIZONTAL') root.style.width = frame.width
    else root.style.height = frame.height
  }
  if (frame.counterAxisSizing === 'FIXED') {
    if (frame.layoutMode === 'HORIZONTAL') root.style.height = frame.height
    else root.style.width = frame.width
  }
  // Laid out on its own, a frame its parent stretches keeps the size the parent gave it on
  // that axis, so its content aligns within that size rather than within a hug.
  const stretchedAxis = parentStretchedAxis(graph, frame)
  if (stretchedAxis === 'width') root.style.width = frame.width
  if (stretchedAxis === 'height') root.style.height = frame.height
  const heldAxes = heldHugAxes(graph, frame)
  if (heldAxes.includes('width')) root.style.width = frame.width
  if (heldAxes.includes('height')) root.style.height = frame.height

  configureFlexContainer(root, frame, direction)
  insertFlexChildren(root, frame, graph, direction)

  return root
}

function insertFlexChildren(
  parentNode: LayoutNode,
  parent: SceneNode,
  graph: SceneGraph,
  direction: 'LTR' | 'RTL'
): void {
  const box = insertFlowBox(parentNode, parent)
  const flow: LayoutNode[] = []
  for (const node of graph.getChildren(parent.id)) {
    const child = asLaidOutIn(graph, node, parent)
    const item = createLayoutNode()

    if (child.layoutPositioning === 'ABSOLUTE') {
      configureAbsoluteChild(item, child)
    } else if (!child.visible) {
      item.style.display = 'none'
    } else {
      configureInFlowChild(item, child, parent, graph, direction)
      flow.push(item)
    }

    box.append(item)
  }
  setFlowEdges(parentNode, box, parent, flow, direction)
}

function configureInFlowChild(
  item: LayoutNode,
  child: SceneNode,
  parent: SceneNode,
  graph: SceneGraph,
  direction: 'LTR' | 'RTL'
): void {
  if (child.layoutMode === 'GRID') {
    configureChildAsGrid(item, child, parent, graph, direction)
  } else if (child.layoutMode !== 'NONE') {
    configureChildAsAutoLayout(item, child, parent, graph, direction)
  } else {
    configureChildAsLeaf(item, child, parent, graph)
  }
}

function configureFlexContainer(
  layoutNode: LayoutNode,
  node: SceneNode,
  direction: Exclude<SceneNode['layoutDirection'], 'AUTO'>
): void {
  layoutNode.style.direction = direction === 'RTL' ? 'rtl' : 'ltr'
  setFlexFlow(layoutNode, node)
  if (node.clipsContent) layoutNode.style.overflow = 'hidden'
  setLayoutPadding(layoutNode, node)
  applyMinMaxConstraints(layoutNode, node)
}

function configureChildAsGrid(
  item: LayoutNode,
  child: SceneNode,
  parent: SceneNode,
  graph: SceneGraph,
  inheritedDirection: 'LTR' | 'RTL'
): void {
  const direction = resolveNodeLayoutDirection(child, inheritedDirection)
  item.style.display = 'grid'
  item.style.direction = direction === 'RTL' ? 'rtl' : 'ltr'

  if (child.gridTemplateColumns.length > 0) {
    item.style.gridTemplateColumns = child.gridTemplateColumns.map(mapGridTrack)
  }
  if (child.gridTemplateRows.length > 0) {
    item.style.gridTemplateRows = child.gridTemplateRows.map(mapGridTrack)
  }

  item.style.columnGap = child.gridColumnGap
  item.style.rowGap = child.gridRowGap

  setLayoutPadding(item, child)

  const isParentRow = parent.layoutMode === 'HORIZONTAL'
  const selfOverride = child.layoutAlignSelf !== 'AUTO'
  const stretchCross = selfOverride
    ? child.layoutAlignSelf === 'STRETCH'
    : parent.counterAxisAlign === 'STRETCH'

  if (child.layoutGrow > 0) {
    item.style.flexGrow = child.layoutGrow
    item.style.flexShrink = 1
    item.style.flexBasis = 0
    if (!stretchCross) {
      if (isParentRow) item.style.height = child.height
      else item.style.width = child.width
    }
  } else {
    if (isParentRow) {
      item.style.width = child.width
      if (!stretchCross) item.style.height = child.height
    } else {
      if (child.gridTemplateRows.length > 0) item.style.height = child.height
      if (!stretchCross) item.style.width = child.width
    }
  }

  const selfAlign = mapAlignSelf(child.layoutAlignSelf)
  if (selfAlign != null) item.style.alignSelf = selfAlign

  applyLockedAspectRatio(item, child, parent)
  applyMinMaxConstraints(item, child)

  const grandchildren = graph.getChildren(child.id)
  for (const gc of grandchildren) {
    if (gc.layoutPositioning === 'ABSOLUTE') {
      const grandchild = createLayoutNode()
      configureAbsoluteChild(grandchild, gc)
      item.append(grandchild)
    } else {
      item.append(createGridChildNode(graph, gc))
    }
  }
}

function configureAutoLayoutChildSizing(
  item: LayoutNode,
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
    if (fixedDerivedMainAxis) item.style.width = child.derivedLayout?.width ?? child.width
    else setMainAxisSizing(item, 'width', widthSizing, child.width, child.layoutGrow)
    const keepsSize = fillKeepsSizeInHuggingParent(child, parent, 'height')
    setCrossAxisSizing(item, 'height', heightSizing, child.height, keepsSize)
    return
  }

  const keepsSize = fillKeepsSizeInHuggingParent(child, parent, 'width')
  setCrossAxisSizing(item, 'width', widthSizing, child.width, keepsSize)
  if (fixedDerivedMainAxis) item.style.height = child.derivedLayout?.height ?? child.height
  else setMainAxisSizing(item, 'height', heightSizing, child.height, child.layoutGrow)
}

function configureChildAsAutoLayout(
  item: LayoutNode,
  child: SceneNode,
  parent: SceneNode,
  graph: SceneGraph,
  inheritedDirection: 'LTR' | 'RTL'
): void {
  const direction = resolveNodeLayoutDirection(child, inheritedDirection)
  const widthSizing = layoutSizing(graph, child, 'HORIZONTAL')
  const heightSizing = layoutSizing(graph, child, 'VERTICAL')

  configureAutoLayoutChildSizing(item, child, parent, graph, widthSizing, heightSizing)

  const selfAlign = mapAlignSelf(child.layoutAlignSelf)
  if (selfAlign != null) item.style.alignSelf = selfAlign
  applyLockedAspectRatio(item, child, parent)

  if (usesDetachedDerivedLayout(graph, child)) {
    // The imported size is what the child's own hug produced, whether or not it also fills.
    const derived = child.derivedLayout
    if (ownAxisSizing(child, 'width') === 'HUG') item.style.width = derived?.width ?? child.width
    if (ownAxisSizing(child, 'height') === 'HUG') {
      item.style.height = derived?.height ?? child.height
    }
    applyMinMaxConstraints(item, child)
    return
  }

  configureFlexContainer(item, child, direction)
  const heldAxes = heldHugAxes(graph, child)
  if (heldAxes.includes('width') && widthSizing === 'HUG') item.style.width = child.width
  if (heldAxes.includes('height') && heightSizing === 'HUG') item.style.height = child.height

  insertFlexChildren(item, child, graph, direction)
}
