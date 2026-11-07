import type { SceneNode } from '../types'

type TextBoxNode = Pick<SceneNode, 'height' | 'textAlignVertical'>
type TextBoundsNode = Pick<SceneNode, 'type' | 'height' | 'derivedTextHeight'>

/**
 * Where the top of laid-out lines `contentHeight` tall sits in a text's box, by its vertical
 * alignment. Lines taller than the box overflow on the side away from the alignment, as Figma
 * lays them out.
 */
export function textVerticalOffset(node: TextBoxNode, contentHeight: number): number {
  const available = node.height - contentHeight
  if (node.textAlignVertical === 'CENTER') {
    return available / 2
  }
  if (node.textAlignVertical === 'BOTTOM') {
    return available
  }
  return 0
}

/**
 * How far a text's lines reach below its box: a fixed-size box does not clip them, as in Figma,
 * and the renderer starts them at its top.
 */
export function textLinesOverflow(node: TextBoundsNode): number {
  if (node.type !== 'TEXT' || !node.derivedTextHeight) return 0
  return Math.max(0, node.derivedTextHeight - node.height)
}
