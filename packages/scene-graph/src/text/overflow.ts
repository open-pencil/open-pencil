import type { VisualBounds } from '../geometry'
import type { SceneNode } from '../types'

type TextBoxNode = Pick<SceneNode, 'height' | 'textAlignVertical'>
type TextBoundsNode = TextBoxNode & Pick<SceneNode, 'type' | 'derivedTextHeight'>

export type TextLinesReach = Pick<VisualBounds, 'minY' | 'maxY'>

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
 * The rows a text draws its lines over, in its own axes: its box, grown by the lines a fixed-size
 * box lets run past it above or below, as in Figma.
 */
export function textLinesReach(node: TextBoundsNode): TextLinesReach {
  if (node.type !== 'TEXT' || !node.derivedTextHeight) {
    return { minY: 0, maxY: node.height }
  }
  const linesTop = textVerticalOffset(node, node.derivedTextHeight)
  return {
    minY: Math.min(0, linesTop),
    maxY: Math.max(node.height, linesTop + node.derivedTextHeight)
  }
}
