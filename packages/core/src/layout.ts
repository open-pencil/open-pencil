import { resolveNodeLayoutDirection } from '@open-pencil/scene-graph/text/direction'
import { computeLayout as computeBoxes, type LayoutNode } from '@open-pencil/taffy'

import { applyComputedLayout } from './layout/apply'
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
import { sizeAutoResizingText } from './layout/text-auto-resize'
export { sizeAutoResizingText } from './layout/text-auto-resize'
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
  configureNonTextLeaf,
  createLayoutNode,
  mapAlignSelf,
  mapGridTrack,
  measureByWidth,
  parentStretchedAxis,
  setLayoutPadding
} from './layout/node'
import { fitShapeWithTextFrame } from './layout/shape-with-text'
import {
  estimateTextSize,
  getTextMeasurer,
  measureAutoWidthText,
  measureTextForLayout
} from './layout/text-measurement'

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

/**
 * Fill text shares its parent's main axis like a fill frame: it grows and shrinks from a zero
 * basis, so its stored width (100px for new text) never decides its share. Returns whether
 * it fills the row's width, where its stored width must not constrain it either.
 */
function configureGrowingText(
  item: LayoutNode,
  child: SceneNode,
  parent: SceneNode,
  fixedDerivedMainAxis: boolean
): boolean {
  if (child.layoutGrow <= 0 || fixedDerivedMainAxis) return false
  item.style.flexGrow = child.layoutGrow
  item.style.flexShrink = 1
  item.style.flexBasis = 0
  return parent.layoutMode === 'HORIZONTAL'
}

function configureTextLeafWithoutMeasurer(
  item: LayoutNode,
  child: SceneNode,
  parent: SceneNode,
  fixedDerivedMainAxis: boolean
): void {
  const hasStoredSize =
    child.width > 0 && child.height > 0 && !(child.width === 100 && child.height === 100)

  if (child.textAutoResize === 'WIDTH_AND_HEIGHT') {
    if (hasStoredSize) {
      item.style.width = child.width
      item.style.height = child.height
    } else {
      const estimated = estimateTextSize(child)
      item.style.width = estimated.width
      item.style.height = estimated.height
    }
    return
  }
  if (child.textAutoResize !== 'HEIGHT') return

  const growsWidth = configureGrowingText(item, child, parent, fixedDerivedMainAxis)
  const isRow = parent.layoutMode === 'HORIZONTAL'
  const measurementWidth = fixedDerivedMainAxis
    ? (child.derivedLayout?.width ?? child.width)
    : child.width
  const stretches =
    child.layoutAlignSelf === 'STRETCH' ||
    (child.layoutAlignSelf === 'AUTO' && parent.counterAxisAlign === 'STRETCH')
  if (!(!isRow && stretches) && !fixedDerivedMainAxis && !growsWidth) {
    item.style.width = child.width
  }
  if (hasStoredSize) item.style.height = child.height
  else item.style.height = estimateTextSize(child, measurementWidth).height
}

function configureChildAsLeaf(
  item: LayoutNode,
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
    if (isRow) item.style.width = child.derivedLayout?.width ?? child.width
    else item.style.height = child.derivedLayout?.height ?? child.height
  }

  if (needsMeasureFunc) {
    configureTextLeaf(item, child, parent, fixedDerivedMainAxis)
  } else if (isText && !textMeasurer && child.textAutoResize !== 'NONE') {
    configureTextLeafWithoutMeasurer(item, child, parent, fixedDerivedMainAxis)
  } else {
    configureNonTextLeaf(item, child, isRow, stretchCross)
    // Fixed text still contributes its box to a HUG cross axis. Without
    // an intrinsic minimum, stretch collapses the text to its siblings.
    if (isText && stretchCross && parent.counterAxisSizing === 'HUG') {
      if (isRow) item.style.minHeight = child.height
      else item.style.minWidth = child.width
    }
  }

  const selfAlign = mapAlignSelf(child.layoutAlignSelf)
  if (selfAlign != null) item.style.alignSelf = selfAlign

  applyLockedAspectRatio(item, child, parent)
  applyMinMaxConstraints(item, child)
}

function configureTextLeaf(
  item: LayoutNode,
  child: SceneNode,
  parent: SceneNode,
  fixedDerivedMainAxis = false
): void {
  const autoResize = child.textAutoResize
  const isRow = parent.layoutMode === 'HORIZONTAL'
  const growsWidth = configureGrowingText(item, child, parent, fixedDerivedMainAxis)
  const stretchesCross =
    child.layoutAlignSelf === 'STRETCH' ||
    (child.layoutAlignSelf === 'AUTO' && parent.counterAxisAlign === 'STRETCH')
  // Layout sets the width of text that grows along a row or stretches across a column.
  const fillsWidth = (!isRow && stretchesCross) || growsWidth

  const cache = new Map<number, { width: number; height: number }>()
  const UNCONSTRAINED_KEY = -1

  if (autoResize === 'WIDTH_AND_HEIGHT') {
    const importedSize = child.derivedLayout
    if (importedSize?.width !== undefined && importedSize.height !== undefined) {
      item.style.width = child.width
      item.style.height = child.height
      return
    }

    // Auto-width text keeps each line whole, as Figma's does, in a parent narrower than the text;
    // only a width that layout or a max width sets wraps it.
    const wraps = fillsWidth || child.maxWidth != null
    measureByWidth(item, (width) => {
      // Layout offers the room it has, which a max width narrows further, as Figma wraps at it.
      const limit = Math.min(width ?? Infinity, child.maxWidth ?? Infinity)
      const maxW = wraps && Number.isFinite(limit) ? limit : undefined
      const cacheKey = maxW === undefined ? UNCONSTRAINED_KEY : Math.round(maxW)
      const cached = cache.get(cacheKey)
      if (cached) return cached

      const result = measureAutoWidthText(child, maxW)
      cache.set(cacheKey, result)
      return result
    })
  } else if (autoResize === 'HEIGHT') {
    const fixedWidth = fixedDerivedMainAxis
      ? (child.derivedLayout?.width ?? child.width)
      : child.width
    // Let layout stretch or grow fill-width text instead of fixing its stored width.
    if (child.layoutGrow <= 0 && !fillsWidth) {
      item.style.width = fixedWidth
    }
    measureByWidth(item, (width) => {
      let constraintW = fixedWidth
      if (fillsWidth) {
        if (width !== undefined) constraintW = width
      } else if (width !== undefined) {
        constraintW = Math.min(width, fixedWidth || width)
      }
      const cacheKey = Math.round(constraintW)
      const cached = cache.get(cacheKey)
      if (cached) return cached

      if (constraintW === child.width && (child.derivedTextGlyphs?.length ?? 0) > 0) {
        return { width: constraintW, height: child.height }
      }
      const result = { width: constraintW, height: measureTextForLayout(child, constraintW).height }
      cache.set(cacheKey, result)
      return result
    })
  }
}
