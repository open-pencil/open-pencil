import valueParser, { type Node } from 'postcss-value-parser'

import { tryParseColor } from '../color'
import { BLACK } from '../constants'
import type { Color } from '../primitives'
import type { Effect } from '../types'
import { parseCSSNumber } from './values'

/** The layers of a shadow list, split at its top-level commas. */
function layersOf(nodes: Node[]): Node[][] {
  const layers: Node[][] = []
  let current: Node[] = []
  for (const node of nodes) {
    if (node.type === 'div' && node.value === ',') {
      layers.push(current)
      current = []
    } else if (node.type !== 'space' && node.type !== 'comment') {
      current.push(node)
    }
  }
  layers.push(current)
  return layers
}

/**
 * One layer: `inset`, two to four lengths, and a color in any order. Without a color it is
 * black, as `currentColor` usually is; a layer with anything else, such as `none`, is dropped.
 */
function shadowOf(nodes: Node[]): Effect[] {
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
    const parsed = tryParseColor(valueParser.stringify(node))
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
 * `0 4px 8px rgb(0 0 0 / 0.2), inset 0 1px #fff`: drop shadows, and inner shadows for `inset`.
 */
export function parseCSSShadows(value: string | undefined): Effect[] {
  if (!value) return []
  return layersOf(valueParser(value).nodes).flatMap(shadowOf)
}
