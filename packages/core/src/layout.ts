import {
  Align,
  Direction,
  Display,
  FlexDirection,
  Gutter,
  Edge,
  MeasureMode,
  Overflow,
  Wrap,
  type Node as YogaNode
} from 'yoga-layout'

import { applyYogaLayout } from './layout/apply'
import { usesDetachedDerivedLayout } from './layout/derived'
import { applyEffectiveGeneratedTextLayout } from './layout/effective-generated-text'
import { buildGridTree, createGridChildNode } from './layout/grid'
import { resolveNodeLayoutDirection } from './text/direction'
export {
  estimateTextSize,
  getTextMeasurer,
  setTextMeasurer,
  type TextMeasurer
} from './layout/text-measurement'
import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'

import { estimateTextSize, getTextMeasurer } from './layout/text-measurement'
import {
  applyMinMaxConstraints,
  configureAbsoluteChild,
  createYogaNode,
  freeYogaTree,
  mapAlign,
  mapAlignSelf,
  mapGridTrack,
  mapJustify
} from './layout/yoga-helpers'

export function computeLayout(graph: SceneGraph, frameId: string): void {
  graph.withLayoutMutations(() => computeLayoutInternal(graph, frameId))
}

function computeLayoutInternal(graph: SceneGraph, frameId: string): void {
  const frame = graph.getNode(frameId)
  if (!frame || frame.layoutMode === 'NONE') return

  const rootDirection = resolveComputedLayoutDirection(graph, frame)
  const yogaDirection = rootDirection === 'RTL' ? Direction.RTL : Direction.LTR
  const yogaRoot =
    frame.layoutMode === 'GRID'
      ? buildGridTree(graph, frame, rootDirection)
      : buildYogaTree(graph, frame, rootDirection)
  yogaRoot.calculateLayout(undefined, undefined, yogaDirection)
  applyYogaLayout(graph, frame, yogaRoot, computeLayoutInternal)
  freeYogaTree(yogaRoot)
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
  graph.withLayoutMutations(() => {
    const rootId = scopeId ?? graph.rootId
    const visited = new Set<string>()
    computeLayoutsBottomUp(graph, rootId, visited)
    if (applyEffectiveGeneratedTextLayout(graph, rootId)) {
      computeLayoutsBottomUp(graph, rootId, new Set())
    }
  })
}

function computeLayoutsBottomUp(graph: SceneGraph, nodeId: string, visited: Set<string>): void {
  const node = graph.getNode(nodeId)
  if (!node || visited.has(nodeId)) return
  visited.add(nodeId)

  for (const childId of node.childIds) {
    computeLayoutsBottomUp(graph, childId, visited)
  }

  if (node.layoutMode !== 'NONE' && !preservesImportedInstanceLayout(node)) {
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
    if (frame.layoutMode === 'HORIZONTAL') root.setWidth(frame.width)
    else root.setHeight(frame.height)
  }
  if (frame.counterAxisSizing === 'FIXED') {
    if (frame.layoutMode === 'HORIZONTAL') root.setHeight(frame.height)
    else root.setWidth(frame.width)
  }

  configureFlexContainer(root, frame, direction)

  const children = graph.getChildren(frame.id)
  for (const child of children) {
    const yogaChild = createYogaNode()

    if (child.layoutPositioning === 'ABSOLUTE') {
      configureAbsoluteChild(yogaChild, child)
    } else if (!child.visible) {
      yogaChild.setDisplay(Display.None)
    } else if (child.layoutMode === 'GRID') {
      configureChildAsGrid(yogaChild, child, frame, graph, direction)
    } else if (child.layoutMode !== 'NONE') {
      configureChildAsAutoLayout(yogaChild, child, frame, graph, direction)
    } else {
      configureChildAsLeaf(yogaChild, child, frame, graph)
    }

    root.insertChild(yogaChild, root.getChildCount())
  }

  return root
}

function configureFlexContainer(
  yogaNode: YogaNode,
  node: SceneNode,
  direction: Exclude<SceneNode['layoutDirection'], 'AUTO'>
): void {
  yogaNode.setDirection(direction === 'RTL' ? Direction.RTL : Direction.LTR)
  yogaNode.setFlexDirection(
    node.layoutMode === 'HORIZONTAL' ? FlexDirection.Row : FlexDirection.Column
  )
  yogaNode.setFlexWrap(node.layoutWrap === 'WRAP' ? Wrap.Wrap : Wrap.NoWrap)
  yogaNode.setJustifyContent(mapJustify(node.primaryAxisAlign))
  yogaNode.setAlignItems(mapAlign(node.counterAxisAlign))
  if (node.clipsContent) yogaNode.setOverflow(Overflow.Hidden)

  if (node.layoutWrap === 'WRAP' && node.counterAxisAlignContent === 'SPACE_BETWEEN') {
    yogaNode.setAlignContent(Align.SpaceBetween)
  }

  yogaNode.setPadding(Edge.Top, node.paddingTop)
  yogaNode.setPadding(Edge.Right, node.paddingRight)
  yogaNode.setPadding(Edge.Bottom, node.paddingBottom)
  yogaNode.setPadding(Edge.Left, node.paddingLeft)

  const primaryGap = node.primaryAxisAlign === 'SPACE_BETWEEN' ? 0 : node.itemSpacing
  yogaNode.setGap(
    Gutter.Column,
    node.layoutMode === 'HORIZONTAL' ? primaryGap : node.counterAxisSpacing
  )
  yogaNode.setGap(
    Gutter.Row,
    node.layoutMode === 'HORIZONTAL' ? node.counterAxisSpacing : primaryGap
  )

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
    yogaChild.setGridTemplateColumns(child.gridTemplateColumns.map(mapGridTrack))
  }
  if (child.gridTemplateRows.length > 0) {
    yogaChild.setGridTemplateRows(child.gridTemplateRows.map(mapGridTrack))
  }

  yogaChild.setGap(Gutter.Column, child.gridColumnGap)
  yogaChild.setGap(Gutter.Row, child.gridRowGap)

  yogaChild.setPadding(Edge.Top, child.paddingTop)
  yogaChild.setPadding(Edge.Right, child.paddingRight)
  yogaChild.setPadding(Edge.Bottom, child.paddingBottom)
  yogaChild.setPadding(Edge.Left, child.paddingLeft)

  const isParentRow = parent.layoutMode === 'HORIZONTAL'
  const selfOverride = child.layoutAlignSelf !== 'AUTO'
  const stretchCross = selfOverride
    ? child.layoutAlignSelf === 'STRETCH'
    : parent.counterAxisAlign === 'STRETCH'

  if (child.layoutGrow > 0) {
    yogaChild.setFlexGrow(child.layoutGrow)
    yogaChild.setFlexShrink(1)
    yogaChild.setFlexBasis(0)
    if (!stretchCross) {
      if (isParentRow) yogaChild.setHeight(child.height)
      else yogaChild.setWidth(child.width)
    }
  } else {
    if (isParentRow) {
      yogaChild.setWidth(child.width)
      if (!stretchCross) yogaChild.setHeight(child.height)
    } else {
      if (child.gridTemplateRows.length > 0) yogaChild.setHeight(child.height)
      if (!stretchCross) yogaChild.setWidth(child.width)
    }
  }

  const selfAlign = mapAlignSelf(child.layoutAlignSelf)
  if (selfAlign != null) yogaChild.setAlignSelf(selfAlign)

  applyMinMaxConstraints(yogaChild, child)

  const grandchildren = graph.getChildren(child.id)
  for (const gc of grandchildren) {
    if (gc.layoutPositioning === 'ABSOLUTE') {
      const yogaGC = createYogaNode()
      configureAbsoluteChild(yogaGC, gc)
      yogaChild.insertChild(yogaGC, yogaChild.getChildCount())
    } else {
      yogaChild.insertChild(createGridChildNode(gc), yogaChild.getChildCount())
    }
  }
}

type AxisSizing = SceneNode['primaryAxisSizing']
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

function usesAuthoritativeGeneratedStretch(parent: SceneNode, child: SceneNode): boolean {
  if (
    child.layoutAlignSelf !== 'STRETCH' ||
    parent.source.format === 'fig' ||
    !parent.derivedLayout
  ) {
    return false
  }
  const derivedCrossSize =
    parent.layoutMode === 'HORIZONTAL' ? parent.derivedLayout.height : parent.derivedLayout.width
  const parentCrossSize = parent.layoutMode === 'HORIZONTAL' ? parent.height : parent.width
  return derivedCrossSize !== undefined && Math.abs(derivedCrossSize - parentCrossSize) < 0.001
}

function configureAutoLayoutChildSizing(
  yogaChild: YogaNode,
  child: SceneNode,
  parent: SceneNode,
  graph: SceneGraph,
  widthSizing: AxisSizing,
  heightSizing: AxisSizing
): void {
  const isParentRow = parent.layoutMode === 'HORIZONTAL'
  const fixedDerivedMainAxis = isParentRow
    ? derivedMainAxisFitsParent(graph, parent, child, 'width')
    : derivedMainAxisFitsParent(graph, parent, child, 'height')
  const stretchesAuthoritativeCrossAxis = usesAuthoritativeGeneratedStretch(parent, child)

  if (isParentRow) {
    if (fixedDerivedMainAxis) yogaChild.setWidth(child.derivedLayout?.width ?? child.width)
    else setMainAxisSizing(yogaChild, 'width', widthSizing, child.width, child.layoutGrow)
    if (!stretchesAuthoritativeCrossAxis) {
      setCrossAxisSizing(yogaChild, 'height', heightSizing, child.height)
    }
    return
  }

  if (!stretchesAuthoritativeCrossAxis) {
    setCrossAxisSizing(yogaChild, 'width', widthSizing, child.width)
  }
  if (fixedDerivedMainAxis) yogaChild.setHeight(child.derivedLayout?.height ?? child.height)
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
  const isChildRow = child.layoutMode === 'HORIZONTAL'
  const widthSizing = isChildRow ? child.primaryAxisSizing : child.counterAxisSizing
  const heightSizing = isChildRow ? child.counterAxisSizing : child.primaryAxisSizing

  configureAutoLayoutChildSizing(yogaChild, child, parent, graph, widthSizing, heightSizing)

  const selfAlign = mapAlignSelf(child.layoutAlignSelf)
  if (selfAlign != null) yogaChild.setAlignSelf(selfAlign)

  if (usesDetachedDerivedLayout(child)) {
    const derived = child.derivedLayout
    if (widthSizing === 'HUG') yogaChild.setWidth(derived?.width ?? child.width)
    if (heightSizing === 'HUG') yogaChild.setHeight(derived?.height ?? child.height)
    applyMinMaxConstraints(yogaChild, child)
    return
  }

  configureFlexContainer(yogaChild, child, direction)

  const grandchildren = graph.getChildren(child.id)
  for (const gc of grandchildren) {
    const yogaGC = createYogaNode()
    if (gc.layoutPositioning === 'ABSOLUTE') {
      configureAbsoluteChild(yogaGC, gc)
    } else if (!gc.visible) {
      yogaGC.setDisplay(Display.None)
    } else if (gc.layoutMode === 'GRID') {
      configureChildAsGrid(yogaGC, gc, child, graph, direction)
    } else if (gc.layoutMode !== 'NONE') {
      configureChildAsAutoLayout(yogaGC, gc, child, graph, direction)
    } else {
      configureChildAsLeaf(yogaGC, gc, child, graph)
    }
    yogaChild.insertChild(yogaGC, yogaChild.getChildCount())
  }
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

function configureTextLeafWithoutMeasurer(
  yogaChild: YogaNode,
  child: SceneNode,
  parent: SceneNode,
  fixedDerivedMainAxis: boolean
): void {
  const hasStoredSize =
    child.width > 0 && child.height > 0 && !(child.width === 100 && child.height === 100)

  if (child.textAutoResize === 'WIDTH_AND_HEIGHT') {
    if (hasStoredSize) {
      yogaChild.setWidth(child.width)
      yogaChild.setHeight(child.height)
    } else {
      const estimated = estimateTextSize(child)
      yogaChild.setWidth(estimated.width)
      yogaChild.setHeight(estimated.height)
    }
    return
  }
  if (child.textAutoResize !== 'HEIGHT') return

  const isRow = parent.layoutMode === 'HORIZONTAL'
  const measurementWidth = fixedDerivedMainAxis
    ? (child.derivedLayout?.width ?? child.width)
    : child.width
  const stretches =
    child.layoutAlignSelf === 'STRETCH' ||
    (child.layoutAlignSelf === 'AUTO' && parent.counterAxisAlign === 'STRETCH')
  if (!(!isRow && stretches) && !fixedDerivedMainAxis) yogaChild.setWidth(child.width)
  if (hasStoredSize) yogaChild.setHeight(child.height)
  else yogaChild.setHeight(estimateTextSize(child, measurementWidth).height)
}

function configureChildAsLeaf(
  yogaChild: YogaNode,
  child: SceneNode,
  parent: SceneNode,
  graph: SceneGraph
): void {
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
    if (isRow) yogaChild.setWidth(child.derivedLayout?.width ?? child.width)
    else yogaChild.setHeight(child.derivedLayout?.height ?? child.height)
  }

  if (needsMeasureFunc) {
    configureTextLeaf(yogaChild, child, parent, fixedDerivedMainAxis)
  } else if (isText && !textMeasurer && child.textAutoResize !== 'NONE') {
    configureTextLeafWithoutMeasurer(yogaChild, child, parent, fixedDerivedMainAxis)
  } else {
    configureNonTextLeaf(yogaChild, child, isRow, stretchCross)
  }

  const selfAlign = mapAlignSelf(child.layoutAlignSelf)
  if (selfAlign != null) yogaChild.setAlignSelf(selfAlign)

  applyMinMaxConstraints(yogaChild, child)
}

function configureTextLeaf(
  yogaChild: YogaNode,
  child: SceneNode,
  parent: SceneNode,
  fixedDerivedMainAxis = false
): void {
  const autoResize = child.textAutoResize
  const isRow = parent.layoutMode === 'HORIZONTAL'

  if (child.layoutGrow > 0 && !fixedDerivedMainAxis) {
    yogaChild.setFlexGrow(child.layoutGrow)
  }

  const cache = new Map<number, { width: number; height: number }>()
  const UNCONSTRAINED_KEY = -1

  if (autoResize === 'WIDTH_AND_HEIGHT') {
    const importedSize = child.derivedLayout
    if (importedSize?.width !== undefined && importedSize.height !== undefined) {
      yogaChild.setWidth(child.width)
      yogaChild.setHeight(child.height)
      return
    }

    yogaChild.setMeasureFunc((width, widthMode, _height, _heightMode) => {
      const maxW = widthMode === MeasureMode.Undefined ? undefined : width
      const cacheKey = maxW === undefined ? UNCONSTRAINED_KEY : Math.round(maxW)
      const cached = cache.get(cacheKey)
      if (cached) return cached

      const measured = getTextMeasurer()?.(child, maxW)
      const result = measured ?? estimateTextSize(child, maxW)
      cache.set(cacheKey, result)
      return result
    })
  } else if (autoResize === 'HEIGHT') {
    const stretchesCross =
      child.layoutAlignSelf === 'STRETCH' ||
      (child.layoutAlignSelf === 'AUTO' && parent.counterAxisAlign === 'STRETCH')
    // Let Yoga stretch fill-width text instead of fixing its stored width.
    const fillsWidth = !isRow && stretchesCross
    const fixedWidth = fixedDerivedMainAxis
      ? (child.derivedLayout?.width ?? child.width)
      : child.width
    if (child.layoutGrow <= 0 && !fillsWidth) {
      yogaChild.setWidth(fixedWidth)
    }
    yogaChild.setMeasureFunc((width, widthMode, _height, _heightMode) => {
      let constraintW = fixedWidth
      if (fillsWidth) {
        if (widthMode !== MeasureMode.Undefined) constraintW = width
      } else if (widthMode !== MeasureMode.Undefined) {
        constraintW = Math.min(width, fixedWidth || width)
      }
      const cacheKey = Math.round(constraintW)
      const cached = cache.get(cacheKey)
      if (cached) return cached

      const measured = getTextMeasurer()?.(child, constraintW)
      const result = {
        width: constraintW,
        height: measured?.height ?? estimateTextSize(child, constraintW).height
      }
      cache.set(cacheKey, result)
      return result
    })
  }
}

function configureNonTextLeaf(
  yogaChild: YogaNode,
  child: SceneNode,
  isRow: boolean,
  stretchCross: boolean
): void {
  const w = child.width
  const h = child.height

  if (child.layoutGrow > 0) {
    yogaChild.setFlexGrow(child.layoutGrow)
    if (!stretchCross) {
      if (isRow) yogaChild.setHeight(h)
      else yogaChild.setWidth(w)
    }
  } else {
    if (isRow) {
      yogaChild.setWidth(w)
      if (!stretchCross) yogaChild.setHeight(h)
    } else {
      yogaChild.setHeight(h)
      if (!stretchCross) yogaChild.setWidth(w)
    }
  }
}

function setMainAxisSizing(
  yogaNode: YogaNode,
  axis: 'width' | 'height',
  sizing: AxisSizing,
  fixedValue: number,
  grow: number
): void {
  if (grow > 0) {
    yogaNode.setFlexGrow(grow)
    yogaNode.setFlexShrink(1)
    yogaNode.setFlexBasis(0)
    return
  }

  switch (sizing) {
    case 'FIXED':
      if (axis === 'width') yogaNode.setWidth(fixedValue)
      else yogaNode.setHeight(fixedValue)
      break
    case 'HUG':
      break
    case 'FILL':
      yogaNode.setFlexGrow(1)
      yogaNode.setFlexShrink(1)
      yogaNode.setFlexBasis(0)
      break
  }
}

function setCrossAxisSizing(
  yogaNode: YogaNode,
  axis: 'width' | 'height',
  sizing: AxisSizing,
  fixedValue: number
): void {
  switch (sizing) {
    case 'FIXED':
      if (axis === 'width') yogaNode.setWidth(fixedValue)
      else yogaNode.setHeight(fixedValue)
      break
    case 'HUG':
      break
    case 'FILL':
      yogaNode.setAlignSelf(Align.Stretch)
      break
  }
}
