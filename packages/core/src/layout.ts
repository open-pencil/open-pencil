import Yoga, {
  Align,
  Direction,
  Display,
  FlexDirection,
  GridTrackType,
  Gutter,
  Justify,
  Edge,
  Wrap,
  type Node as YogaNode
} from 'yoga-layout'

import type { GridTrack, SceneGraph, SceneNode } from './scene-graph'

export type TextMeasurer = (node: SceneNode) => { width: number; height: number } | null

let globalTextMeasurer: TextMeasurer | null = null

export function setTextMeasurer(measurer: TextMeasurer | null): void {
  globalTextMeasurer = measurer
}

export function computeLayout(graph: SceneGraph, frameId: string): void {
  const frame = graph.getNode(frameId)
  if (!frame || frame.layoutMode === 'NONE') return

  const yogaRoot =
    frame.layoutMode === 'GRID' ? buildGridTree(graph, frame) : buildYogaTree(graph, frame)
  yogaRoot.calculateLayout(undefined, undefined, Direction.LTR)
  applyYogaLayout(graph, frame, yogaRoot)
  freeYogaTree(yogaRoot)
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
    case 'AUTO':
      return { type: GridTrackType.Auto, value: 0 }
  }
}

function configureAsGrid(yogaNode: YogaNode, node: SceneNode): void {
  yogaNode.setDisplay(Display.Grid)
  yogaNode.setWidth(node.width)
  yogaNode.setHeight(node.height)

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
    if (child.layoutGrow > 0 || child.layoutAlignSelf === 'STRETCH') {
      yogaChild.setFlexGrow(1)
    } else {
      yogaChild.setWidth(child.width)
      yogaChild.setHeight(child.height)
    }
  }
  return yogaChild
}

function buildGridTree(graph: SceneGraph, frame: SceneNode): YogaNode {
  const root = Yoga.Node.create()
  configureAsGrid(root, frame)

  const children = graph.getChildren(frame.id)
  for (const child of children) {
    if (child.layoutPositioning === 'ABSOLUTE') continue
    root.insertChild(createGridChildNode(child), root.getChildCount())
  }

  return root
}

// --- Flex layout ---

function buildYogaTree(graph: SceneGraph, frame: SceneNode): YogaNode {
  const root = Yoga.Node.create()

  if (frame.primaryAxisSizing === 'FIXED') {
    if (frame.layoutMode === 'HORIZONTAL') root.setWidth(frame.width)
    else root.setHeight(frame.height)
  }
  if (frame.counterAxisSizing === 'FIXED') {
    if (frame.layoutMode === 'HORIZONTAL') root.setHeight(frame.height)
    else root.setWidth(frame.width)
  }

  root.setFlexDirection(
    frame.layoutMode === 'HORIZONTAL' ? FlexDirection.Row : FlexDirection.Column
  )
  root.setFlexWrap(frame.layoutWrap === 'WRAP' ? Wrap.Wrap : Wrap.NoWrap)
  root.setJustifyContent(mapJustify(frame.primaryAxisAlign))
  root.setAlignItems(mapAlign(frame.counterAxisAlign))

  root.setPadding(Edge.Top, frame.paddingTop)
  root.setPadding(Edge.Right, frame.paddingRight)
  root.setPadding(Edge.Bottom, frame.paddingBottom)
  root.setPadding(Edge.Left, frame.paddingLeft)

  root.setGap(
    Gutter.Column,
    frame.layoutMode === 'HORIZONTAL' ? frame.itemSpacing : frame.counterAxisSpacing
  )
  root.setGap(
    Gutter.Row,
    frame.layoutMode === 'HORIZONTAL' ? frame.counterAxisSpacing : frame.itemSpacing
  )

  const children = graph.getChildren(frame.id)
  for (let i = 0; i < children.length; i++) {
    const child = children[i]

    if (child.layoutPositioning === 'ABSOLUTE') continue

    const yogaChild = Yoga.Node.create()

    if (!child.visible) {
      yogaChild.setDisplay(Display.None)
    } else if (child.layoutMode === 'GRID') {
      configureChildAsGrid(yogaChild, child, frame, graph)
    } else if (child.layoutMode !== 'NONE') {
      configureChildAsAutoLayout(yogaChild, child, frame, graph)
    } else {
      configureChildAsLeaf(yogaChild, child, frame)
    }

    root.insertChild(yogaChild, root.getChildCount())
  }

  return root
}

function configureChildAsGrid(
  yogaChild: YogaNode,
  child: SceneNode,
  _parent: SceneNode,
  graph: SceneGraph
): void {
  configureAsGrid(yogaChild, child)

  if (child.layoutGrow > 0) {
    yogaChild.setFlexGrow(child.layoutGrow)
  }
  if (child.layoutAlignSelf === 'STRETCH') {
    yogaChild.setAlignSelf(Align.Stretch)
  }

  const grandchildren = graph.getChildren(child.id)
  for (const gc of grandchildren) {
    if (gc.layoutPositioning === 'ABSOLUTE') continue
    yogaChild.insertChild(createGridChildNode(gc), yogaChild.getChildCount())
  }
}

function configureChildAsAutoLayout(
  yogaChild: YogaNode,
  child: SceneNode,
  parent: SceneNode,
  graph: SceneGraph
): void {
  const isParentRow = parent.layoutMode === 'HORIZONTAL'
  const isChildRow = child.layoutMode === 'HORIZONTAL'

  const widthSizing = isChildRow ? child.primaryAxisSizing : child.counterAxisSizing
  const heightSizing = isChildRow ? child.counterAxisSizing : child.primaryAxisSizing

  if (isParentRow) {
    setSizing(yogaChild, 'width', widthSizing, child.width, child.layoutGrow)
    setSizing(yogaChild, 'height', heightSizing, child.height, 0)
  } else {
    setSizing(yogaChild, 'width', widthSizing, child.width, 0)
    setSizing(yogaChild, 'height', heightSizing, child.height, child.layoutGrow)
  }

  if (child.layoutAlignSelf === 'STRETCH') {
    yogaChild.setAlignSelf(Align.Stretch)
  }

  yogaChild.setFlexDirection(
    child.layoutMode === 'HORIZONTAL' ? FlexDirection.Row : FlexDirection.Column
  )
  yogaChild.setFlexWrap(child.layoutWrap === 'WRAP' ? Wrap.Wrap : Wrap.NoWrap)
  yogaChild.setJustifyContent(mapJustify(child.primaryAxisAlign))
  yogaChild.setAlignItems(mapAlign(child.counterAxisAlign))

  yogaChild.setPadding(Edge.Top, child.paddingTop)
  yogaChild.setPadding(Edge.Right, child.paddingRight)
  yogaChild.setPadding(Edge.Bottom, child.paddingBottom)
  yogaChild.setPadding(Edge.Left, child.paddingLeft)

  yogaChild.setGap(
    Gutter.Column,
    child.layoutMode === 'HORIZONTAL' ? child.itemSpacing : child.counterAxisSpacing
  )
  yogaChild.setGap(
    Gutter.Row,
    child.layoutMode === 'HORIZONTAL' ? child.counterAxisSpacing : child.itemSpacing
  )

  const grandchildren = graph.getChildren(child.id)
  for (const gc of grandchildren) {
    if (gc.layoutPositioning === 'ABSOLUTE') continue
    const yogaGC = Yoga.Node.create()
    if (!gc.visible) {
      yogaGC.setDisplay(Display.None)
    } else if (gc.layoutMode !== 'NONE') {
      configureChildAsAutoLayout(yogaGC, gc, child, graph)
    } else {
      configureChildAsLeaf(yogaGC, gc, child)
    }
    yogaChild.insertChild(yogaGC, yogaChild.getChildCount())
  }
}

function configureChildAsLeaf(yogaChild: YogaNode, child: SceneNode, parent: SceneNode): void {
  const isRow = parent.layoutMode === 'HORIZONTAL'
  const stretchCross = child.layoutAlignSelf === 'STRETCH' || parent.counterAxisAlign === 'STRETCH'

  const measured =
    child.type === 'TEXT' && child.textAutoResize === 'WIDTH_AND_HEIGHT'
      ? measureTextSize(child)
      : null
  const w = measured ? measured.width : child.width
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

  if (child.layoutAlignSelf === 'STRETCH') {
    yogaChild.setAlignSelf(Align.Stretch)
  }
}

function measureTextSize(node: SceneNode): { width: number; height: number } | null {
  if (!globalTextMeasurer) return null
  return globalTextMeasurer(node)
}

function setSizing(
  yogaNode: YogaNode,
  axis: 'width' | 'height',
  sizing: string,
  fixedValue: number,
  grow: number
): void {
  if (grow > 0) {
    yogaNode.setFlexGrow(grow)
    yogaNode.setFlexShrink(1)
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
      break
  }
}

function applyYogaLayout(graph: SceneGraph, frame: SceneNode, yogaNode: YogaNode): void {
  if (frame.layoutMode !== 'GRID') {
    if (frame.primaryAxisSizing === 'HUG' || frame.counterAxisSizing === 'HUG') {
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
  }

  const children = graph.getChildren(frame.id)
  let yogaIndex = 0
  for (const child of children) {
    if (child.layoutPositioning === 'ABSOLUTE') continue

    const yogaChild = yogaNode.getChild(yogaIndex)
    yogaIndex++
    if (!yogaChild) continue

    graph.updateNode(child.id, {
      x: yogaChild.getComputedLeft(),
      y: yogaChild.getComputedTop(),
      width: yogaChild.getComputedWidth(),
      height: yogaChild.getComputedHeight()
    })

    if (child.layoutMode !== 'NONE') {
      applyYogaLayout(graph, child, yogaChild)
    }
  }
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
