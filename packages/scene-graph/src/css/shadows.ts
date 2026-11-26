import valueParser, { type Node } from 'postcss-value-parser'

import { tryParseColor } from '../color'
import { BLACK } from '../constants'
import type { Color } from '../primitives'
import type { ColorProfile, Effect } from '../types'
import { cssLayerNodes, parseCSSNumber } from './values'

/**
 * One layer: `inset`, two to four lengths, and a color in any order. Without a color it is
 * black, as `currentColor` usually is; a layer with anything else, such as `none`, is dropped.
 */
function shadowOf(nodes: Node[], profile: ColorProfile): Effect[] {
  let inset = false
  let color: Color | null = null
  const lengths: number[] = []
  for (const node of nodes) {
    if (node.type === 'word' && node.value.toLowerCase() === 'inset') {
      inset = true
      continue
    }
    const length = node.type === 'word' ? parseCSSNumber(node.value) : null
    if (length !== null) {
      lengths.push(length)
      continue
    }
    const parsed = tryParseColor(valueParser.stringify(node), profile)
    if (!parsed || color) return []
    color = parsed
  }
  if (lengths.length < 2 || lengths.length > 4 || color?.a === 0) return []
  const [x = 0, y = 0, radius = 0, spread = 0] = lengths
  return [
    {
      type: inset ? 'INNER_SHADOW' : 'DROP_SHADOW',
      color: color ?? { ...BLACK },
      offset: { x, y },
      radius,
      spread,
      visible: true
    }
  ]
}

/**
 * The shadows of a CSS `box-shadow` or `text-shadow` list, such as
 * `0 4px 8px rgb(0 0 0 / 0.2), inset 0 1px #fff`: drop shadows, and inner shadows for `inset`,
 * their colors read into `profile`.
 */
export function parseCSSShadows(value: string | undefined, profile: ColorProfile): Effect[] {
  if (!value) return []
  return cssLayerNodes(valueParser(value).nodes).flatMap((layer) => shadowOf(layer, profile))
}
