import Yoga, {
  Align,
  Edge,
  GridTrackType,
  Justify,
  PositionType,
  type Node as YogaNode
} from 'yoga-layout'

import type { GridTrack, SceneNode } from '#core/scene-graph'

const yogaConfig = Yoga.Config.create()
yogaConfig.setPointScaleFactor(0)

export function createYogaNode(): YogaNode {
  return Yoga.Node.create(yogaConfig)
}

export function configureAbsoluteChild(yogaChild: YogaNode, child: SceneNode): void {
  yogaChild.setPositionType(PositionType.Absolute)
  yogaChild.setPosition(Edge.Left, child.x)
  yogaChild.setPosition(Edge.Top, child.y)
  yogaChild.setWidth(child.width)
  yogaChild.setHeight(child.height)
}

export function applyMinMaxConstraints(yogaNode: YogaNode, node: SceneNode): void {
  if (node.minWidth != null) yogaNode.setMinWidth(node.minWidth)
  if (node.maxWidth != null) yogaNode.setMaxWidth(node.maxWidth)
  if (node.minHeight != null) yogaNode.setMinHeight(node.minHeight)
  if (node.maxHeight != null) yogaNode.setMaxHeight(node.maxHeight)
}

export function mapGridTrack(track: GridTrack): { type: GridTrackType; value: number } {
  switch (track.sizing) {
    case 'FR':
      return { type: GridTrackType.Fr, value: track.value }
    case 'FIXED':
      return { type: GridTrackType.Points, value: track.value }
    default:
      return { type: GridTrackType.Auto, value: 0 }
  }
}

export function freeYogaTree(node: YogaNode): void {
  for (let i = node.getChildCount() - 1; i >= 0; i--) {
    freeYogaTree(node.getChild(i))
  }
  if ('free' in node) (node as { free(): void }).free()
}

export function mapJustify(align: string): Justify {
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

export function mapAlign(align: string): Align {
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

export function mapAlignSelf(alignSelf: string): Align | null {
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
