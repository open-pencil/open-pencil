import { Direction, Display, Gutter, type Node as YogaNode } from 'yoga-layout'

import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import { layoutSizing } from '@open-pencil/scene-graph/layout'
import { resolveNodeLayoutDirection } from '@open-pencil/scene-graph/text/direction'

import {
  configureAbsoluteChild,
  createYogaNode,
  mapGridTracks,
  setLayoutPadding,
  setYogaGap,
  setYogaGridPlacement,
  setYogaHeight,
  setYogaWidth
} from './yoga-helpers'

function configureAsGrid(
  yogaNode: YogaNode,
  node: SceneNode,
  direction: Exclude<SceneNode['layoutDirection'], 'AUTO'>
): void {
  yogaNode.setDisplay(Display.Grid)
  yogaNode.setDirection(direction === 'RTL' ? Direction.RTL : Direction.LTR)
  setYogaWidth(yogaNode, node.width)
  if (node.gridTemplateRows.length > 0 || node.height > 0) {
    setYogaHeight(yogaNode, node.height)
  }

  if (node.gridTemplateColumns.length > 0) {
    yogaNode.setGridTemplateColumns(mapGridTracks(node.gridTemplateColumns))
  }
  if (node.gridTemplateRows.length > 0) {
    yogaNode.setGridTemplateRows(mapGridTracks(node.gridTemplateRows))
  }

  setYogaGap(yogaNode, Gutter.Column, node.gridColumnGap)
  setYogaGap(yogaNode, Gutter.Row, node.gridRowGap)

  setLayoutPadding(yogaNode, node)
}

export function createGridChildNode(graph: SceneGraph, child: SceneNode): YogaNode {
  const yogaChild = createYogaNode()
  if (!child.visible) {
    yogaChild.setDisplay(Display.None)
  } else {
    const pos = child.gridPosition
    if (pos) {
      // Yoga's grid asserts on a placement its WASM build cannot lay out and then aborts the
      // module, so a value an authored file or script got wrong is bounded here.
      setYogaGridPlacement(yogaChild, pos)
    }
    // Each axis fills its cell on its own, as in Figma: grow for width, stretch for height.
    if (layoutSizing(graph, child, 'HORIZONTAL') === 'FILL') yogaChild.setWidthStretch()
    else setYogaWidth(yogaChild, child.width)
    if (layoutSizing(graph, child, 'VERTICAL') === 'FILL') yogaChild.setHeightStretch()
    else setYogaHeight(yogaChild, child.height)
  }
  return yogaChild
}

export function buildGridTree(
  graph: SceneGraph,
  frame: SceneNode,
  inheritedDirection: 'LTR' | 'RTL'
): YogaNode {
  const root = createYogaNode()
  const direction = resolveNodeLayoutDirection(frame, inheritedDirection)
  configureAsGrid(root, frame, direction)

  const children = graph.getChildren(frame.id)
  for (const child of children) {
    if (child.layoutPositioning === 'ABSOLUTE') {
      const yogaChild = createYogaNode()
      configureAbsoluteChild(yogaChild, child)
      root.insertChild(yogaChild, root.getChildCount())
    } else {
      const yogaChild = createGridChildNode(graph, child)
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
