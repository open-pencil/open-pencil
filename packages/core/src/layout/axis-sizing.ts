import { Align, type Node as YogaNode } from 'yoga-layout'

import {
  layoutSizing,
  type LayoutSizing,
  type SceneGraph,
  type SceneNode
} from '@open-pencil/scene-graph'

type Axis = 'width' | 'height'

/**
 * A Fill child along the axis its parent hugs keeps its own size there, as Figma lays it out: the
 * parent hugs the child as it is, and neither collapses to nothing.
 */
export function asLaidOutIn(graph: SceneGraph, child: SceneNode, parent: SceneNode): SceneNode {
  if (child.layoutGrow <= 0) return child
  if (parent.layoutMode !== 'HORIZONTAL' && parent.layoutMode !== 'VERTICAL') return child
  return layoutSizing(graph, parent, parent.layoutMode) === 'HUG'
    ? { ...child, layoutGrow: 0 }
    : child
}

/**
 * Figma resizes a line or vector by scaling its geometry, so one with no extent along an axis
 * keeps none there: it neither fills that axis nor stretches across it, and sits where its
 * parent aligns the other children.
 */
export function asFlatLeaf(child: SceneNode, parent: SceneNode): SceneNode {
  if (child.type !== 'LINE' && child.type !== 'VECTOR') return child
  // A turned layer's own width and height do not run along the layout's axes.
  if (child.rotation !== 0) return child
  const isRow = parent.layoutMode === 'HORIZONTAL'
  const main = isRow ? child.width : child.height
  const cross = isRow ? child.height : child.width
  if (main !== 0 && cross !== 0) return child
  const align = parent.counterAxisAlign === 'STRETCH' ? 'MIN' : parent.counterAxisAlign
  return {
    ...child,
    layoutGrow: main === 0 ? 0 : child.layoutGrow,
    layoutAlignSelf: cross === 0 ? align : child.layoutAlignSelf
  }
}

/**
 * The counter axis a frame hugs but keeps its size on, because every child in its flow fills
 * that axis and none has content of its own to hug, as Figma keeps it.
 */
export function heldHugAxis(graph: SceneGraph, frame: SceneNode): 'width' | 'height' | null {
  if (frame.counterAxisSizing !== 'HUG') return null
  if (frame.layoutMode !== 'HORIZONTAL' && frame.layoutMode !== 'VERTICAL') return null
  const flow = graph
    .getChildren(frame.id)
    .filter((child) => child.visible && child.layoutPositioning !== 'ABSOLUTE')
  const holds =
    flow.length > 0 &&
    flow.every(
      (child) =>
        child.layoutMode === 'NONE' &&
        child.type !== 'TEXT' &&
        (child.layoutAlignSelf === 'STRETCH' ||
          (child.layoutAlignSelf === 'AUTO' && frame.counterAxisAlign === 'STRETCH'))
    )
  if (!holds) return null
  return frame.layoutMode === 'HORIZONTAL' ? 'height' : 'width'
}

/** The fields that set how a layer sizes in its parent's layout. */
const SIZING_FIELDS: ReadonlySet<string> = new Set([
  'layoutGrow',
  'layoutAlignSelf',
  'primaryAxisSizing',
  'counterAxisSizing'
])

/**
 * A fixed-size child that fills across a hugging parent counts toward the hug with the size it
 * has, as files Figma saved were laid out: the parent is at least as wide as the child was. Once
 * Fill is set by an edit, the child counts only with its content, as Figma lays it out then.
 */
export function fillKeepsSizeInHuggingParent(
  child: SceneNode,
  parent: SceneNode,
  axis: Axis
): boolean {
  return (
    parent.counterAxisSizing === 'HUG' &&
    ownAxisSizing(child, axis) === 'FIXED' &&
    !child.source.editedFields.some((field) => SIZING_FIELDS.has(field))
  )
}

/** An auto-layout frame's own sizing along a screen axis, before any fill from its parent. */
export function ownAxisSizing(child: SceneNode, axis: Axis): SceneNode['primaryAxisSizing'] {
  const childPrimary = child.layoutMode === 'VERTICAL' ? 'height' : 'width'
  return axis === childPrimary ? child.primaryAxisSizing : child.counterAxisSizing
}

export function setMainAxisSizing(
  yogaNode: YogaNode,
  axis: Axis,
  sizing: LayoutSizing,
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

export function setCrossAxisSizing(
  yogaNode: YogaNode,
  axis: Axis,
  sizing: LayoutSizing,
  fixedValue: number,
  fillKeepsSize = false
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
      if (fillKeepsSize) {
        if (axis === 'width') yogaNode.setMinWidth(fixedValue)
        else yogaNode.setMinHeight(fixedValue)
      }
      break
  }
}
