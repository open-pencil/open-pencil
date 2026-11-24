import { isGeneratedFrame } from '../generated'
import type { SceneNode } from '../types'

/**
 * The space between wrapped lines of an auto layout. A frame without its own follows the item
 * spacing, as Figma's `counterAxisSpacing: null` does.
 */
export function counterAxisSpacingOf(
  node: Pick<SceneNode, 'counterAxisSpacing' | 'itemSpacing'>
): number {
  return node.counterAxisSpacing ?? node.itemSpacing
}

/**
 * The space an auto layout keeps between its items along its axis. Space between takes the place
 * of the gap, as in Figma. A generated frame keeps it as the least space between its sublayers,
 * as a sticky note keeps its author clear of a long body.
 */
export function primaryAxisSpacingOf(
  node: Pick<SceneNode, 'type' | 'primaryAxisAlign' | 'itemSpacing'>
): number {
  return node.primaryAxisAlign === 'SPACE_BETWEEN' && !isGeneratedFrame(node) ? 0 : node.itemSpacing
}
