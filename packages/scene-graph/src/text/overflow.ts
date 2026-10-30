import type { VisualBoundsNode } from '../geometry'

type TextBoundsNode = Pick<VisualBoundsNode, 'type' | 'height' | 'derivedTextHeight'>

/**
 * How far a text's lines reach below its box: a fixed-size box does not clip them, as in Figma,
 * and the renderer starts them at its top.
 */
export function textLinesOverflow(node: TextBoundsNode): number {
  if (node.type !== 'TEXT' || !node.derivedTextHeight) return 0
  return Math.max(0, node.derivedTextHeight - node.height)
}
