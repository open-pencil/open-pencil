import type { GridTrack, SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import { enforcedAspectRatio, layoutSizingInParent } from '@open-pencil/scene-graph/layout'
import {
  type AlignContent,
  type AlignItems,
  type GridTrack as LayoutTrack,
  LayoutNode
} from '@open-pencil/taffy'

import { heldHugAxes } from './axis-sizing'

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
  // The ratio sizes the parent's cross axis over Fill across it, where CSS stretches instead, and
  // Figma centers the box in the room the Fill takes (`ratioRoomShift` moves it into a capped one).
  const followsAcross = drivesWidth === primaryIsWidth
  const alignSelf =
    layoutNode.style.alignSelf ?? (stretchesAcross(node, parent) ? 'stretch' : undefined)
  if (followsAcross && alignSelf === 'stretch') layoutNode.style.alignSelf = 'center'
}

/**
 * How far across a locked ratio's box moves from the middle of its parent, sized across by the
 * ratio over Fill: Figma centers it in the room the Fill takes, which a maximum size caps and the
 * parent's alignment places (50, 200, and 350 for a 200 px box capped at 300 in a 600 px column,
 * for MIN, CENTER, and MAX). `inner` is the parent's size across inside its padding.
 */
export function ratioRoomShift(
  layoutNode: LayoutNode,
  child: SceneNode,
  parent: SceneNode,
  inner: number
): number {
  if (layoutNode.style.aspectRatio === undefined || layoutNode.style.alignSelf !== 'center')
    return 0
  if (parent.layoutMode !== 'HORIZONTAL' && parent.layoutMode !== 'VERTICAL') return 0
  if (!stretchesAcross(child, parent)) return 0
  const across = parent.layoutMode === 'VERTICAL' ? 'width' : 'height'
  if (layoutNode.style[across] !== 'auto') return 0
  const cap = across === 'width' ? child.maxWidth : child.maxHeight
  if (cap === null || cap >= inner) return 0
  const room = (inner - cap) / 2
  if (parent.counterAxisAlign === 'MIN') return -room
  if (parent.counterAxisAlign === 'MAX') return room
  return 0
}

/**
 * Whether an auto layout parent has a size of its own across: fixed or filling there, or hugging
 * but holding its size or stretched by its own parent. A parent that hugs its children is as wide
 * as they are.
 */
export function parentSizedAcross(graph: SceneGraph, parent: SceneNode): boolean {
  if (parent.counterAxisSizing !== 'HUG') return true
  const across = parent.layoutMode === 'VERTICAL' ? 'width' : 'height'
  return (
    heldHugAxes(graph, parent).includes(across) || parentStretchedAxis(graph, parent) === across
  )
}

/**
 * A child that fills its parent across, capped by a maximum size there, sits where the parent's
 * alignment puts the children, as Figma lays it out: CSS's stretch clamps it and keeps it at the
 * start whatever the alignment. Only a parent with a size across has the room it fills, which
 * `sizedAcross` says, asked once per parent and only for a capped child.
 */
export function alignCappedFill(
  layoutNode: LayoutNode,
  child: SceneNode,
  parent: SceneNode,
  sizedAcross: () => boolean
): void {
  if (!stretchesAcross(child, parent)) return
  const across = parent.layoutMode === 'VERTICAL' ? 'width' : 'height'
  const cap = across === 'width' ? child.maxWidth : child.maxHeight
  if (cap === null) return
  // A locked ratio that sizes the axis from the other keeps sizing it.
  if (layoutNode.style.aspectRatio !== undefined && layoutNode.style[across] === 'auto') return
  const align = mapAlign(parent.counterAxisAlign)
  if (align === 'stretch' || align === 'baseline' || align === 'flex-start') return
  if (!sizedAcross()) return
  layoutNode.style[across] = '100%'
  layoutNode.style.alignSelf = align
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
