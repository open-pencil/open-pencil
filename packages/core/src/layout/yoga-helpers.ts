import Yoga, {
  Align,
  Edge,
  GridTrackType,
  Justify,
  PositionType,
  type Gutter,
  type Node as YogaNode
} from 'yoga-layout'

import type { GridPosition, GridTrack, SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import {
  clampGridPosition,
  clampGridTracks,
  clampLayoutLength,
  clampLayoutPosition,
  enforcedAspectRatio,
  layoutSizingInParent,
  MAX_LAYOUT_FACTOR,
  MAX_LAYOUT_SPACING
} from '@open-pencil/scene-graph/layout'

const yogaConfig = Yoga.Config.create()
yogaConfig.setPointScaleFactor(0)

export function createYogaNode(): YogaNode {
  return Yoga.Node.create(yogaConfig)
}

/**
 * Every number these helpers write stays inside layout's bounds. A document's sizes, positions,
 * and spacing reach Yoga from files and scripts as well as from tools, and Yoga's WASM build
 * aborts on some values and carries a non-finite one into every size it computes.
 */
export function setYogaWidth(node: YogaNode, value: number): void {
  node.setWidth(clampLayoutLength(value))
}

export function setYogaHeight(node: YogaNode, value: number): void {
  node.setHeight(clampLayoutLength(value))
}

/** A coordinate along an axis, which may lie outside the parent. */
export function setYogaPosition(node: YogaNode, edge: Edge, value: number): void {
  node.setPosition(edge, clampLayoutPosition(value))
}

/** The room a container keeps inside its border, as a CSS padding takes room. */
export function setYogaPadding(node: YogaNode, edge: Edge, value: number): void {
  node.setPadding(edge, clampLayoutLength(value, MAX_LAYOUT_SPACING))
}

/** The room a child keeps outside itself, negative where siblings overlap. */
export function setYogaMargin(node: YogaNode, edge: Edge, value: number): void {
  node.setMargin(edge, clampLayoutPosition(value, MAX_LAYOUT_SPACING))
}

/** The bounds layout holds a node to on one axis. */
export function setYogaMinSize(node: YogaNode, axis: 'width' | 'height', value: number): void {
  if (axis === 'width') node.setMinWidth(clampLayoutLength(value))
  else node.setMinHeight(clampLayoutLength(value))
}

export function setYogaMaxSize(node: YogaNode, axis: 'width' | 'height', value: number): void {
  if (axis === 'width') node.setMaxWidth(clampLayoutLength(value))
  else node.setMaxHeight(clampLayoutLength(value))
}

/** The space between siblings: a gap, or the negative margin an overlap leaves. */
export function setYogaGap(node: YogaNode, gutter: Gutter, value: number): void {
  node.setGap(gutter, clampLayoutPosition(value, MAX_LAYOUT_SPACING))
}

/** A grid item's placement, which Yoga aborts the whole module on unless it can lay it out. */
export function setYogaGridPlacement(node: YogaNode, position: GridPosition): void {
  const placement = clampGridPosition(position)
  node.setGridColumnStart(placement.column)
  node.setGridColumnEndSpan(placement.columnSpan)
  node.setGridRowStart(placement.row)
  node.setGridRowEndSpan(placement.rowSpan)
}

/** The share of the free space a child takes, which layout adds up as a ratio. */
export function setYogaFlexGrow(node: YogaNode, value: number): void {
  node.setFlexGrow(clampLayoutLength(value, MAX_LAYOUT_FACTOR))
}

/**
 * The stroke a frame counts inside its padding, per side: its visible INSIDE strokes when its
 * strokes are included in layout, as Figma lays it out and as a CSS border takes room.
 */
function includedStrokeWeights(
  node: SceneNode
): Record<'top' | 'right' | 'bottom' | 'left', number> {
  const stroke = node.strokes.find((paint) => paint.visible)
  if (!node.strokesIncludedInLayout || stroke?.align !== 'INSIDE') {
    return { top: 0, right: 0, bottom: 0, left: 0 }
  }
  if (!node.independentStrokeWeights) {
    return { top: stroke.weight, right: stroke.weight, bottom: stroke.weight, left: stroke.weight }
  }
  return {
    top: node.borderTopWeight,
    right: node.borderRightWeight,
    bottom: node.borderBottomWeight,
    left: node.borderLeftWeight
  }
}

/** A layout container's padding, with the strokes it includes in layout added to each side. */
export function setLayoutPadding(yogaNode: YogaNode, node: SceneNode): void {
  const padding = layoutPadding(node)
  setYogaPadding(yogaNode, Edge.Top, padding.top)
  setYogaPadding(yogaNode, Edge.Right, padding.right)
  setYogaPadding(yogaNode, Edge.Bottom, padding.bottom)
  setYogaPadding(yogaNode, Edge.Left, padding.left)
}

/** A layout container's padding on each side, with the strokes it includes in layout added. */
export function layoutPadding(
  node: SceneNode
): Record<'top' | 'right' | 'bottom' | 'left', number> {
  const stroke = includedStrokeWeights(node)
  return {
    top: node.paddingTop + stroke.top,
    right: node.paddingRight + stroke.right,
    bottom: node.paddingBottom + stroke.bottom,
    left: node.paddingLeft + stroke.left
  }
}

export function configureAbsoluteChild(yogaChild: YogaNode, child: SceneNode): void {
  yogaChild.setPositionType(PositionType.Absolute)
  setYogaPosition(yogaChild, Edge.Left, child.x)
  setYogaPosition(yogaChild, Edge.Top, child.y)
  setYogaWidth(yogaChild, child.width)
  setYogaHeight(yogaChild, child.height)
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
    setYogaFlexGrow(yogaChild, child.layoutGrow)
    if (!stretchCross) {
      if (isRow) setYogaHeight(yogaChild, h)
      else setYogaWidth(yogaChild, w)
    }
  } else {
    if (isRow) {
      setYogaWidth(yogaChild, w)
      if (!stretchCross) setYogaHeight(yogaChild, h)
    } else {
      setYogaHeight(yogaChild, h)
      if (!stretchCross) setYogaWidth(yogaChild, w)
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
  if (ratio === null || !Number.isFinite(ratio) || ratio <= 0) return
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
  if (node.minWidth != null) setYogaMinSize(yogaNode, 'width', node.minWidth)
  if (node.maxWidth != null) setYogaMaxSize(yogaNode, 'width', node.maxWidth)
  if (node.minHeight != null) setYogaMinSize(yogaNode, 'height', node.minHeight)
  if (node.maxHeight != null) setYogaMaxSize(yogaNode, 'height', node.maxHeight)
}

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

/** A template's tracks as Yoga sets them, bounded to what its WASM build lays out safely. */
export function mapGridTracks(tracks: readonly GridTrack[]): Array<{
  type: GridTrackType
  value: number
}> {
  return clampGridTracks(tracks).map(mapGridTrack)
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
