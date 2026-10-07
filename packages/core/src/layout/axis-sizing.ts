import { Align, type Node as YogaNode } from 'yoga-layout'

import type { LayoutSizing, SceneNode } from '@open-pencil/scene-graph'

type Axis = 'width' | 'height'

/**
 * A fixed-size child that fills across a hugging parent still counts toward the hug, as in
 * Figma: the parent is at least as wide as the child was, and the child stretches beyond that.
 */
export function fillKeepsSizeInHuggingParent(
  child: SceneNode,
  parent: SceneNode,
  axis: Axis
): boolean {
  return parent.counterAxisSizing === 'HUG' && ownAxisSizing(child, axis) === 'FIXED'
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
