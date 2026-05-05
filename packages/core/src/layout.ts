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
import { buildGridTree, createGridChildNode } from './layout/grid'
import { resolveNodeLayoutDirection } from './text/direction'
export {
  estimateTextSize,
  getTextMeasurer,
  setTextMeasurer,
  type TextMeasurer
} from './layout/text-measurement'
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
import type { SceneGraph, SceneNode } from './scene-graph'

export function computeLayout(graph: SceneGraph, frameId: string): void {
  const frame = graph.getNode(frameId)
  if (!frame || frame.layoutMode === 'NONE') return

  const rootDirection = resolveComputedLayoutDirection(graph, frame)
  const yogaRoot =
    frame.layoutMode === 'GRID'
      ? buildGridTree(graph, frame, rootDirection)
      : buildYogaTree(graph, frame, rootDirection)
  yogaRoot.calculateLayout(
    undefined,
    undefined,
    rootDirection === 'RTL' ? Direction.RTL : Direction.LTR
  )
  applyYogaLayout(graph, frame, yogaRoot, computeLayout)
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
  const visited = new Set<string>()
  computeLayoutsBottomUp(graph, scopeId ?? graph.rootId, visited)
}

function computeLayoutsBottomUp(graph: SceneGraph, nodeId: string, visited: Set<string>): void {
  const node = graph.getNode(nodeId)
  if (!node || visited.has(nodeId)) return
  visited.add(nodeId)

  for (const childId of node.childIds) {
    computeLayoutsBottomUp(graph, childId, visited)
  }

  if (node.layoutMode !== 'NONE' && node.type !== 'INSTANCE') {
    computeLayout(graph, nodeId)
  }
}

// --- Flex layout ---

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
      configureChildAsLeaf(yogaChild, child, frame)
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

  yogaNode.setGap(
    Gutter.Column,
    node.layoutMode === 'HORIZONTAL' ? node.itemSpacing : node.counterAxisSpacing
  )
  yogaNode.setGap(
    Gutter.Row,
    node.layoutMode === 'HORIZONTAL' ? node.counterAxisSpacing : node.itemSpacing
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

function configureChildAsAutoLayout(
  yogaChild: YogaNode,
  child: SceneNode,
  parent: SceneNode,
  graph: SceneGraph,
  inheritedDirection: 'LTR' | 'RTL'
): void {
  const direction = resolveNodeLayoutDirection(child, inheritedDirection)
  const isParentRow = parent.layoutMode === 'HORIZONTAL'
  const isChildRow = child.layoutMode === 'HORIZONTAL'

  const widthSizing = isChildRow ? child.primaryAxisSizing : child.counterAxisSizing
  const heightSizing = isChildRow ? child.counterAxisSizing : child.primaryAxisSizing

  // Main axis: width for row parent, height for col parent — use grow for FILL
  // Cross axis: height for row parent, width for col parent — use stretch for FILL
  if (isParentRow) {
    setMainAxisSizing(yogaChild, 'width', widthSizing, child.width, child.layoutGrow)
    setCrossAxisSizing(yogaChild, 'height', heightSizing, child.height)
  } else {
    setCrossAxisSizing(yogaChild, 'width', widthSizing, child.width)
    setMainAxisSizing(yogaChild, 'height', heightSizing, child.height, child.layoutGrow)
  }

  const selfAlign = mapAlignSelf(child.layoutAlignSelf)
  if (selfAlign != null) yogaChild.setAlignSelf(selfAlign)

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
      configureChildAsLeaf(yogaGC, gc, child)
    }
    yogaChild.insertChild(yogaGC, yogaChild.getChildCount())
  }
}

function configureChildAsLeaf(yogaChild: YogaNode, child: SceneNode, parent: SceneNode): void {
  const isRow = parent.layoutMode === 'HORIZONTAL'
  const selfOverride = child.layoutAlignSelf !== 'AUTO'
  const stretchCross = selfOverride
    ? child.layoutAlignSelf === 'STRETCH'
    : parent.counterAxisAlign === 'STRETCH'

  const isText = child.type === 'TEXT'
  const textMeasurer = getTextMeasurer()
  const needsMeasureFunc = isText && textMeasurer && child.textAutoResize !== 'NONE'

  if (needsMeasureFunc) {
    configureTextLeaf(yogaChild, child, parent)
  } else if (isText && !textMeasurer && child.textAutoResize !== 'NONE') {
    // No CanvasKit — prefer stored dimensions from .fig import (Figma's
    // ground truth) over the rough character-count estimate. Only fall back
    // to estimateTextSize for newly-created nodes that still carry the
    // 100×100 default SceneNode size.
    const hasStoredSize =
      child.width > 0 && child.height > 0 && !(child.width === 100 && child.height === 100)

    if (child.textAutoResize === 'WIDTH_AND_HEIGHT') {
      if (hasStoredSize) {
        yogaChild.setWidth(child.width)
        yogaChild.setHeight(child.height)
      } else {
        const est = estimateTextSize(child)
        yogaChild.setWidth(est.width)
        yogaChild.setHeight(est.height)
      }
    } else if (child.textAutoResize === 'HEIGHT') {
      const stretches =
        child.layoutAlignSelf === 'STRETCH' ||
        (child.layoutAlignSelf === 'AUTO' && parent.counterAxisAlign === 'STRETCH')
      if (!(!isRow && stretches)) {
        yogaChild.setWidth(child.width)
      }
      if (hasStoredSize) {
        yogaChild.setHeight(child.height)
      } else {
        const est = estimateTextSize(child, child.width)
        yogaChild.setHeight(est.height)
      }
    }
  } else {
    configureNonTextLeaf(yogaChild, child, isRow, stretchCross)
  }

  const selfAlign = mapAlignSelf(child.layoutAlignSelf)
  if (selfAlign != null) yogaChild.setAlignSelf(selfAlign)

  applyMinMaxConstraints(yogaChild, child)
}

function configureTextLeaf(yogaChild: YogaNode, child: SceneNode, parent: SceneNode): void {
  const autoResize = child.textAutoResize
  const isRow = parent.layoutMode === 'HORIZONTAL'

  if (child.layoutGrow > 0) {
    yogaChild.setFlexGrow(child.layoutGrow)
  }

  const cache = new Map<number, { width: number; height: number }>()
  const UNCONSTRAINED_KEY = -1

  if (autoResize === 'WIDTH_AND_HEIGHT') {
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
    // Don't set fixed width when text stretches on cross axis (w="fill" in
    // flex="col" parent) — setWidth blocks Yoga's alignSelf:stretch, leaving
    // text at 100px default instead of filling the parent.
    const fillsWidth = !isRow && stretchesCross
    const fixedWidth = child.width
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
  sizing: string,
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
  sizing: string,
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
