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
