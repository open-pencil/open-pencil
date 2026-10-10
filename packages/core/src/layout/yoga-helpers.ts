import Yoga, {
  Align,
  Edge,
  GridTrackType,
  Justify,
  PositionType,
  type Node as YogaNode
} from 'yoga-layout'

import {
  enforcedAspectRatio,
  layoutSizingInParent,
  type GridTrack,
  type SceneGraph,
  type SceneNode
} from '@open-pencil/scene-graph'

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

export function configureNonTextLeaf(
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

/**
 * A locked aspect ratio sizes the axis Fill does not drive, as Figma lays it out: Fill along the
 * parent's primary axis drives when set, else Fill across it, and the other axis follows even past
 * the parent's edge. An axis that hugs keeps its own size.
 */
export function applyLockedAspectRatio(
  yogaNode: YogaNode,
  node: SceneNode,
  parent: SceneNode
): void {
  const ratio = enforcedAspectRatio(node)
  if (ratio === null) return
  const width = layoutSizingInParent(parent, node, 'HORIZONTAL')
  const height = layoutSizingInParent(parent, node, 'VERTICAL')
  const primaryIsWidth = parent.layoutMode !== 'VERTICAL'
  const primary = primaryIsWidth ? width : height
  const cross = primaryIsWidth ? height : width
  let drivesWidth: boolean
  if (primary === 'FILL') drivesWidth = primaryIsWidth
  else if (cross === 'FILL') drivesWidth = !primaryIsWidth
  else return
  if ((drivesWidth ? height : width) === 'HUG') return
  yogaNode.setAspectRatio(ratio)
  if (drivesWidth) yogaNode.setHeight('auto')
  else yogaNode.setWidth('auto')
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

/** The axis a frame's auto layout parent stretches it along, if any. */
export function parentStretchedAxis(
  graph: SceneGraph,
  frame: SceneNode
): 'width' | 'height' | null {
  const parent = frame.parentId ? graph.getNode(frame.parentId) : undefined
  if (!parent || frame.layoutPositioning === 'ABSOLUTE') return null
  if (parent.layoutMode !== 'HORIZONTAL' && parent.layoutMode !== 'VERTICAL') return null
  const stretched =
    frame.layoutAlignSelf === 'STRETCH' ||
    (frame.layoutAlignSelf === 'AUTO' && parent.counterAxisAlign === 'STRETCH')
  if (!stretched) return null
  return parent.layoutMode === 'VERTICAL' ? 'width' : 'height'
}
