import type { LayoutSizing, SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import { layoutSizing } from '@open-pencil/scene-graph/layout'
import type { LayoutNode } from '@open-pencil/taffy'

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
 * The axes a frame hugs but keeps its size on, as Figma keeps them. With nothing in its flow,
 * no visible layer that is not placed absolutely, it keeps every axis it hugs: a new frame keeps
 * the size it was made at, and one that loses its last layer keeps the size it hugged to. On the
 * counter axis it also keeps its size when every child in its flow fills that axis and none has
 * content of its own to hug.
 */
export function heldHugAxes(graph: SceneGraph, frame: SceneNode): ('width' | 'height')[] {
  if (frame.layoutMode !== 'HORIZONTAL' && frame.layoutMode !== 'VERTICAL') return []
  const [primary, counter] =
    frame.layoutMode === 'HORIZONTAL'
      ? (['width', 'height'] as const)
      : (['height', 'width'] as const)
  const hugged = [
    ...(frame.primaryAxisSizing === 'HUG' ? [primary] : []),
    ...(frame.counterAxisSizing === 'HUG' ? [counter] : [])
  ]
  const flow = graph
    .getChildren(frame.id)
    .filter((child) => child.visible && child.layoutPositioning !== 'ABSOLUTE')
  if (flow.length === 0) return hugged
  const filled = flow.every(
    (child) =>
      child.layoutMode === 'NONE' &&
      child.type !== 'TEXT' &&
      (child.layoutAlignSelf === 'STRETCH' ||
        (child.layoutAlignSelf === 'AUTO' && frame.counterAxisAlign === 'STRETCH'))
  )
  return filled && frame.counterAxisSizing === 'HUG' ? [counter] : []
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
  layoutNode: LayoutNode,
  axis: Axis,
  sizing: LayoutSizing,
  fixedValue: number,
  grow: number
): void {
  if (grow > 0) {
    layoutNode.style.flexGrow = grow
    layoutNode.style.flexShrink = 1
    layoutNode.style.flexBasis = 0
    return
  }

  switch (sizing) {
    case 'FIXED':
      if (axis === 'width') layoutNode.style.width = fixedValue
      else layoutNode.style.height = fixedValue
      break
    case 'HUG':
      break
    case 'FILL':
      layoutNode.style.flexGrow = 1
      layoutNode.style.flexShrink = 1
      layoutNode.style.flexBasis = 0
      break
  }
}

export function setCrossAxisSizing(
  layoutNode: LayoutNode,
  axis: Axis,
  sizing: LayoutSizing,
  fixedValue: number,
  fillKeepsSize = false
): void {
  switch (sizing) {
    case 'FIXED':
      if (axis === 'width') layoutNode.style.width = fixedValue
      else layoutNode.style.height = fixedValue
      break
    case 'HUG':
      break
    case 'FILL':
      layoutNode.style.alignSelf = 'stretch'
      if (fillKeepsSize) {
        if (axis === 'width') layoutNode.style.minWidth = fixedValue
        else layoutNode.style.minHeight = fixedValue
      }
      break
  }
}
