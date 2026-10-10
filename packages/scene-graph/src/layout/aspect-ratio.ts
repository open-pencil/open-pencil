import type { SceneGraph } from '../index'
import { findInstanceAncestor } from '../instances'
import type { Vector } from '../primitives'
import type { SceneNode } from '../types'

type AspectRatioNode = Pick<SceneNode, 'type' | 'targetAspectRatio' | 'textAutoResize'>

/** The value Figma's `lockAspectRatio()` stores: the size the layer has when it is locked. */
export function lockedAspectRatioTarget(width: number, height: number): Vector {
  return { x: width, y: height }
}

/** Whether the lock can change: a layer inside an instance keeps its component's, as in Figma. */
export function aspectRatioLockEditable(graph: SceneGraph, node: SceneNode): boolean {
  return !node.parentId || !findInstanceAncestor(graph, node.parentId)
}

/**
 * The width-to-height ratio a resize keeps, or `null` when the layer's proportions are free.
 * Text that sizes itself to its content keeps the lock without following it, as in Figma.
 */
export function enforcedAspectRatio(node: AspectRatioNode): number | null {
  const target = node.targetAspectRatio
  if (!target || !(target.x > 0) || !(target.y > 0)) return null
  if (node.type === 'TEXT' && node.textAutoResize !== 'NONE') return null
  return target.x / target.y
}

/**
 * A resize that ignores a locked ratio, such as Figma's plugin `resize()` or a Control-drag,
 * keeps the lock and stores the new size as the ratio to keep.
 */
export function recapturedAspectRatio(
  node: Pick<SceneNode, 'targetAspectRatio'>,
  width: number,
  height: number
): Partial<Pick<SceneNode, 'targetAspectRatio'>> {
  if (!node.targetAspectRatio) return {}
  if (node.targetAspectRatio.x === width && node.targetAspectRatio.y === height) return {}
  return { targetAspectRatio: lockedAspectRatioTarget(width, height) }
}

/** The size that keeps `ratio` when one axis is set to `value`. */
export function sizeKeepingAspectRatio(
  ratio: number,
  axis: 'width' | 'height',
  value: number
): { width: number; height: number } {
  return axis === 'width'
    ? { width: value, height: value / ratio }
    : { width: value * ratio, height: value }
}
