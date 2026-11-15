import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import { layoutSizing } from '@open-pencil/scene-graph/layout'
import { resolveNodeLayoutDirection } from '@open-pencil/scene-graph/text/direction'
import type { LayoutNode } from '@open-pencil/taffy'

import { configureAbsoluteChild, createLayoutNode, mapGridTrack, setLayoutPadding } from './node'

function configureAsGrid(
  layoutNode: LayoutNode,
  node: SceneNode,
  direction: Exclude<SceneNode['layoutDirection'], 'AUTO'>
): void {
  layoutNode.style.display = 'grid'
  layoutNode.style.direction = direction === 'RTL' ? 'rtl' : 'ltr'
  layoutNode.style.width = node.width
  if (node.gridTemplateRows.length > 0 || node.height > 0) {
    layoutNode.style.height = node.height
  }

  if (node.gridTemplateColumns.length > 0) {
    layoutNode.style.gridTemplateColumns = node.gridTemplateColumns.map(mapGridTrack)
  }
  if (node.gridTemplateRows.length > 0) {
    layoutNode.style.gridTemplateRows = node.gridTemplateRows.map(mapGridTrack)
  }

  layoutNode.style.columnGap = node.gridColumnGap
  layoutNode.style.rowGap = node.gridRowGap

  setLayoutPadding(layoutNode, node)
}

export function createGridChildNode(graph: SceneGraph, child: SceneNode): LayoutNode {
  const item = createLayoutNode()
  if (!child.visible) {
    item.style.display = 'none'
  } else {
    const pos = child.gridPosition
    if (pos) {
      item.style.gridColumn = { start: pos.column, span: pos.columnSpan }
      item.style.gridRow = { start: pos.row, span: pos.rowSpan }
    }
    // Each axis fills its cell on its own, as in Figma: grow for width, stretch for height.
    if (layoutSizing(graph, child, 'HORIZONTAL') === 'FILL') item.style.justifySelf = 'stretch'
    else item.style.width = child.width
    if (layoutSizing(graph, child, 'VERTICAL') === 'FILL') item.style.alignSelf = 'stretch'
    else item.style.height = child.height
  }
  return item
}

export function buildGridTree(
  graph: SceneGraph,
  frame: SceneNode,
  inheritedDirection: 'LTR' | 'RTL'
): LayoutNode {
  const root = createLayoutNode()
  const direction = resolveNodeLayoutDirection(frame, inheritedDirection)
  configureAsGrid(root, frame, direction)

  const children = graph.getChildren(frame.id)
  for (const child of children) {
    if (child.layoutPositioning === 'ABSOLUTE') {
      const item = createLayoutNode()
      configureAbsoluteChild(item, child)
      root.append(item)
    } else {
      const item = createGridChildNode(graph, child)
      if (
        child.layoutMode === 'GRID' ||
        child.layoutMode === 'HORIZONTAL' ||
        child.layoutMode === 'VERTICAL'
      ) {
        const childDirection = resolveNodeLayoutDirection(child, direction)
        item.style.direction = childDirection === 'RTL' ? 'rtl' : 'ltr'
      }
      root.append(item)
    }
  }

  return root
}
