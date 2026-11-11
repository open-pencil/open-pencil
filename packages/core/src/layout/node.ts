import type { GridTrack, SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import { enforcedAspectRatio, layoutSizingInParent } from '@open-pencil/scene-graph/layout'
import {
  type AlignContent,
  type AlignItems,
  type GridTrack as LayoutTrack,
  LayoutNode
} from '@open-pencil/taffy'

/**
 * A layout node with auto layout's defaults where they differ from CSS's, as Figma lays layers
 * out: children stack in a column and never shrink below their size, wrapped lines pack at the
 * start, and a box has no automatic minimum size.
 */
export function createLayoutNode(): LayoutNode {
  return new LayoutNode({
    flexDirection: 'column',
    flexShrink: 0,
    alignContent: 'flex-start',
    minWidth: 0,
    minHeight: 0
  })
}

/**
 * Measures a leaf, such as text, by the width layout gives it: the width layout fixed, else a
 * definite width it has room for, else none, when it is sized to its content.
 */
export function measureByWidth(
  layoutNode: LayoutNode,
  measure: (width: number | undefined) => { width: number; height: number }
): void {
  layoutNode.measure = (known, available) =>
    measure(known.width ?? (typeof available.width === 'number' ? available.width : undefined))
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
export function setLayoutPadding(layoutNode: LayoutNode, node: SceneNode): void {
  layoutNode.style.padding = layoutPadding(node)
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

export function configureAbsoluteChild(item: LayoutNode, child: SceneNode): void {
  item.style.position = 'absolute'
  item.style.inset = { left: child.x, top: child.y }
  item.style.width = child.width
  item.style.height = child.height
}

export function configureNonTextLeaf(
  item: LayoutNode,
  child: SceneNode,
  isRow: boolean,
  stretchCross: boolean
): void {
  const w = child.width
  const h = child.height

  if (child.layoutGrow > 0) {
    item.style.flexGrow = child.layoutGrow
    if (!stretchCross) {
      if (isRow) item.style.height = h
      else item.style.width = w
    }
  } else {
    if (isRow) {
      item.style.width = w
      if (!stretchCross) item.style.height = h
    } else {
      item.style.height = h
      if (!stretchCross) item.style.width = w
    }
  }
}

/**
 * A locked aspect ratio sizes the axis Fill does not drive, as Figma lays it out: Fill along the
 * parent's primary axis drives when set, else Fill across it, and the other axis follows even past
 * the parent's edge. An axis that hugs keeps its own size.
 */
export function applyLockedAspectRatio(
  layoutNode: LayoutNode,
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
  layoutNode.style.aspectRatio = ratio
  if (drivesWidth) layoutNode.style.height = 'auto'
  else layoutNode.style.width = 'auto'
  // The ratio sizes the parent's cross axis over Fill across it, where CSS stretches instead.
  const followsAcross = drivesWidth === primaryIsWidth
  const alignSelf =
    layoutNode.style.alignSelf ?? (stretchesAcross(node, parent) ? 'stretch' : undefined)
  if (followsAcross && alignSelf === 'stretch') layoutNode.style.alignSelf = 'flex-start'
}

export function applyMinMaxConstraints(layoutNode: LayoutNode, node: SceneNode): void {
  if (node.minWidth != null) layoutNode.style.minWidth = node.minWidth
  if (node.maxWidth != null) layoutNode.style.maxWidth = node.maxWidth
  if (node.minHeight != null) layoutNode.style.minHeight = node.minHeight
  if (node.maxHeight != null) layoutNode.style.maxHeight = node.maxHeight
}

export function mapGridTrack(track: GridTrack): LayoutTrack {
  switch (track.sizing) {
    case 'FR':
      return `${track.value}fr`
    case 'FIXED':
      return track.value
    default:
      return 'auto'
  }
}

export function mapJustify(align: string): AlignContent {
  switch (align) {
    case 'CENTER':
      return 'center'
    case 'MAX':
      return 'flex-end'
    case 'SPACE_BETWEEN':
      return 'space-between'
    default:
      return 'flex-start'
  }
}

export function mapAlign(align: string): AlignItems {
  switch (align) {
    case 'CENTER':
      return 'center'
    case 'MAX':
      return 'flex-end'
    case 'STRETCH':
      return 'stretch'
    case 'BASELINE':
      return 'baseline'
    default:
      return 'flex-start'
  }
}

export function mapAlignSelf(alignSelf: string): AlignItems | null {
  switch (alignSelf) {
    case 'MIN':
      return 'flex-start'
    case 'CENTER':
      return 'center'
    case 'MAX':
      return 'flex-end'
    case 'STRETCH':
      return 'stretch'
    case 'BASELINE':
      return 'baseline'
    default:
      return null
  }
}

/** Whether a child stretches across its auto layout parent, by its own alignment or the parent's. */
function stretchesAcross(child: SceneNode, parent: SceneNode): boolean {
  return (
    child.layoutAlignSelf === 'STRETCH' ||
    (child.layoutAlignSelf === 'AUTO' && parent.counterAxisAlign === 'STRETCH')
  )
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
