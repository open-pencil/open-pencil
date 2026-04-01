/* eslint-disable max-lines -- layout tree building is a single recursive pass */
import Yoga, {
  Align,
  Direction,
  Display,
  FlexDirection,
  GridTrackType,
  Gutter,
  Justify,
  Edge,
  MeasureMode,
  Overflow,
  PositionType,
  Wrap,
  type Node as YogaNode
} from 'yoga-layout'

import { resolveNodeLayoutDirection } from './direction'

import type { GridTrack, SceneGraph, SceneNode } from './scene-graph'

export type TextMeasurer = (
  node: SceneNode,
  maxWidth?: number
) => { width: number; height: number } | null

let globalTextMeasurer: TextMeasurer | null = null

const GLYPH_WIDTH_FACTOR = 0.6

// Rough estimate for text size when CanvasKit/font is not available.
// DO NOT REMOVE: without this, text nodes keep their 100×100 default size
// and blow up every HUG container. The real MeasureFunc (CanvasKit) overrides
// this when available — this is only the fallback.
function estimateTextSize(node: SceneNode, maxWidth?: number): { width: number; height: number } {
  const fontSize = node.fontSize || 14
  const text = node.text || ''
  const charWidth = fontSize * GLYPH_WIDTH_FACTOR
  const singleLineWidth = Math.ceil(text.length * charWidth)
  const lineH = (node.lineHeight ?? 0) > 0 ? (node.lineHeight as number) : Math.ceil(fontSize * 1.4)

  if (maxWidth && maxWidth > 0 && singleLineWidth > maxWidth) {
    const lines = Math.ceil(singleLineWidth / maxWidth)
    return { width: maxWidth, height: Math.ceil(lines * lineH) }
  }
  return { width: singleLineWidth, height: lineH }
}

export function getTextMeasurer(): TextMeasurer | null {
  return globalTextMeasurer
}

export function setTextMeasurer(measurer: TextMeasurer | null): void {
  globalTextMeasurer = measurer
}

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
  applyYogaLayout(graph, frame, yogaRoot)
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

  if (node.layoutMode !== 'NONE') {
    computeLayout(graph, nodeId)
  }
}

// --- Grid layout ---

function mapGridTrack(track: GridTrack): { type: GridTrackType; value: number } {
  switch (track.sizing) {
    case 'FR':
      return { type: GridTrackType.Fr, value: track.value }
    case 'FIXED':
      return { type: GridTrackType.Points, value: track.value }
    default:
      return { type: GridTrackType.Auto, value: 0 }
  }
}

function configureAsGrid(
  yogaNode: YogaNode,
  node: SceneNode,
  direction: Exclude<SceneNode['layoutDirection'], 'AUTO'>
): void {
  yogaNode.setDisplay(Display.Grid)
  yogaNode.setDirection(direction === 'RTL' ? Direction.RTL : Direction.LTR)
  yogaNode.setWidth(node.width)
  if (node.gridTemplateRows.length > 0 || node.height > 0) {
    yogaNode.setHeight(node.height)
  }

  if (node.gridTemplateColumns.length > 0) {
    yogaNode.setGridTemplateColumns(node.gridTemplateColumns.map(mapGridTrack))
  }
  if (node.gridTemplateRows.length > 0) {
    yogaNode.setGridTemplateRows(node.gridTemplateRows.map(mapGridTrack))
  }

  yogaNode.setGap(Gutter.Column, node.gridColumnGap)
  yogaNode.setGap(Gutter.Row, node.gridRowGap)

  yogaNode.setPadding(Edge.Top, node.paddingTop)
  yogaNode.setPadding(Edge.Right, node.paddingRight)
  yogaNode.setPadding(Edge.Bottom, node.paddingBottom)
  yogaNode.setPadding(Edge.Left, node.paddingLeft)
}

function createGridChildNode(child: SceneNode): YogaNode {
  const yogaChild = Yoga.Node.create()
  if (!child.visible) {
    yogaChild.setDisplay(Display.None)
  } else {
    const pos = child.gridPosition
    if (pos) {
      yogaChild.setGridColumnStart(pos.column)
      yogaChild.setGridColumnEndSpan(pos.columnSpan)
      yogaChild.setGridRowStart(pos.row)
      yogaChild.setGridRowEndSpan(pos.rowSpan)
    }
    const hasLayout = child.layoutMode !== 'NONE'
    const explicitStretch = child.layoutGrow > 0 || child.layoutAlignSelf === 'STRETCH'

    if (explicitStretch || hasLayout) {
      yogaChild.setWidthStretch()
    } else {
      yogaChild.setWidth(child.width)
    }
    if (explicitStretch) {
      yogaChild.setHeightStretch()
    } else {
      yogaChild.setHeight(child.height)
    }
  }
  return yogaChild
}

function buildGridTree(
  graph: SceneGraph,
  frame: SceneNode,
  inheritedDirection: 'LTR' | 'RTL'
): YogaNode {
  const root = Yoga.Node.create()
  const direction = resolveNodeLayoutDirection(frame, inheritedDirection)
  configureAsGrid(root, frame, direction)

  const children = graph.getChildren(frame.id)
  for (const child of children) {
    if (child.layoutPositioning === 'ABSOLUTE') {
      const yogaChild = Yoga.Node.create()
      configureAbsoluteChild(yogaChild, child)
      root.insertChild(yogaChild, root.getChildCount())
    } else {
      const yogaChild = createGridChildNode(child)
      if (
        child.layoutMode === 'GRID' ||
        child.layoutMode === 'HORIZONTAL' ||
        child.layoutMode === 'VERTICAL'
      ) {
        const childDirection = resolveNodeLayoutDirection(child, direction)
        yogaChild.setDirection(childDirection === 'RTL' ? Direction.RTL : Direction.LTR)
      }
      root.insertChild(yogaChild, root.getChildCount())
    }
  }

  return root
}

// --- Flex layout ---

function buildYogaTree(
  graph: SceneGraph,
  frame: SceneNode,
  inheritedDirection: 'LTR' | 'RTL'
): YogaNode {
  const root = Yoga.Node.create()
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
    const yogaChild = Yoga.Node.create()

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

function configureAbsoluteChild(yogaChild: YogaNode, child: SceneNode): void {
  yogaChild.setPositionType(PositionType.Absolute)
  yogaChild.setPosition(Edge.Left, child.x)
  yogaChild.setPosition(Edge.Top, child.y)
  yogaChild.setWidth(child.width)
  yogaChild.setHeight(child.height)
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
      const yogaGC = Yoga.Node.create()
      configureAbsoluteChild(yogaGC, gc)
      yogaChild.insertChild(yogaGC, yogaChild.getChildCount())
    } else {
      yogaChild.insertChild(createGridChildNode(gc), yogaChild.getChildCount())
    }
  }
}

function applyMinMaxConstraints(yogaNode: YogaNode, node: SceneNode): void {
  if (node.minWidth != null) yogaNode.setMinWidth(node.minWidth)
  if (node.maxWidth != null) yogaNode.setMaxWidth(node.maxWidth)
  if (node.minHeight != null) yogaNode.setMinHeight(node.minHeight)
  if (node.maxHeight != null) yogaNode.setMaxHeight(node.maxHeight)
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
    const yogaGC = Yoga.Node.create()
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
  const needsMeasureFunc = isText && globalTextMeasurer && child.textAutoResize !== 'NONE'

  if (needsMeasureFunc) {
    configureTextLeaf(yogaChild, child, parent)
  } else if (isText && !globalTextMeasurer && child.textAutoResize !== 'NONE') {
    // No CanvasKit — use rough estimate so HUG containers don't inherit
    // the 100×100 default SceneNode size. See estimateTextSize above.
    if (child.textAutoResize === 'WIDTH_AND_HEIGHT') {
      const est = estimateTextSize(child)
      yogaChild.setWidth(est.width)
      yogaChild.setHeight(est.height)
    } else if (child.textAutoResize === 'HEIGHT') {
      const stretches =
        child.layoutAlignSelf === 'STRETCH' ||
        (child.layoutAlignSelf === 'AUTO' && parent.counterAxisAlign === 'STRETCH')
      if (!(!isRow && stretches)) {
        yogaChild.setWidth(child.width)
      }
      const est = estimateTextSize(child, child.width)
      yogaChild.setHeight(est.height)
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

      const measured = globalTextMeasurer?.(child, maxW)
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

      const measured = globalTextMeasurer?.(child, constraintW)
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

function applyFrameSize(graph: SceneGraph, frame: SceneNode, yogaNode: YogaNode): void {
  if (frame.layoutMode === 'GRID') {
    if (frame.gridTemplateRows.length === 0) {
      graph.updateNode(frame.id, { height: yogaNode.getComputedHeight() })
    }
    return
  }

  if (frame.primaryAxisSizing !== 'HUG' && frame.counterAxisSizing !== 'HUG') return

  const computedW = yogaNode.getComputedWidth()
  const computedH = yogaNode.getComputedHeight()
  const updates: Partial<SceneNode> = {}

  if (frame.primaryAxisSizing === 'HUG') {
    if (frame.layoutMode === 'HORIZONTAL') updates.width = computedW
    else updates.height = computedH
  }
  if (frame.counterAxisSizing === 'HUG') {
    if (frame.layoutMode === 'HORIZONTAL') updates.height = computedH
    else updates.width = computedW
  }

  graph.updateNode(frame.id, updates)
}

function applyYogaLayout(graph: SceneGraph, frame: SceneNode, yogaNode: YogaNode): void {
  applyFrameSize(graph, frame, yogaNode)

  const children = graph.getChildren(frame.id)
  let yogaIndex = 0
  for (const child of children) {
    const yogaChild = yogaNode.getChild(yogaIndex)
    yogaIndex++
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (!yogaChild) continue

    if (child.visible && child.layoutPositioning !== 'ABSOLUTE') {
      graph.updateNode(child.id, {
        x: yogaChild.getComputedLeft(),
        y: yogaChild.getComputedTop(),
        width: yogaChild.getComputedWidth(),
        height: yogaChild.getComputedHeight()
      })
    }

    if (child.layoutMode !== 'NONE') {
      if (child.layoutMode === 'GRID' && child.visible && child.layoutPositioning !== 'ABSOLUTE') {
        computeLayout(graph, child.id)
      } else if (
        frame.layoutMode === 'GRID' &&
        child.visible &&
        child.layoutPositioning !== 'ABSOLUTE'
      ) {
        recomputeGridChild(graph, child)
      } else {
        applyYogaLayout(graph, child, yogaChild)
      }
    }
  }
}

function recomputeGridChild(graph: SceneGraph, child: SceneNode): void {
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

function freeYogaTree(node: YogaNode): void {
  for (let i = node.getChildCount() - 1; i >= 0; i--) {
    freeYogaTree(node.getChild(i))
  }
  if ('free' in node) (node as { free(): void }).free()
}

function mapJustify(align: string): Justify {
  switch (align) {
    case 'CENTER':
      return Justify.Center
    case 'MAX':
      return Justify.FlexEnd
    case 'SPACE_BETWEEN':
      return Justify.SpaceBetween
    default:
      return Justify.FlexStart
  }
}

function mapAlign(align: string): Align {
  switch (align) {
    case 'CENTER':
      return Align.Center
    case 'MAX':
      return Align.FlexEnd
    case 'STRETCH':
      return Align.Stretch
    case 'BASELINE':
      return Align.Baseline
    default:
      return Align.FlexStart
  }
}

function mapAlignSelf(alignSelf: string): Align | null {
  switch (alignSelf) {
    case 'MIN':
      return Align.FlexStart
    case 'CENTER':
      return Align.Center
    case 'MAX':
      return Align.FlexEnd
    case 'STRETCH':
      return Align.Stretch
    case 'BASELINE':
      return Align.Baseline
    default:
      return null
  }
}
