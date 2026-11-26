import valueParser from 'postcss-value-parser'

import type { Easing } from '../types'
import { easingForBezier, easingPreset } from '../variables/easing'
import { dimension } from './values'

/** A CSS `<time>` in seconds: `250ms` or `0.25s`; a bare number is seconds. Null otherwise. */
export function parseCSSTime(value: string): number | null {
  const parsed = dimension(value.trim())
  if (!parsed) return null
  if (parsed.unit === 'ms') return parsed.number / 1000
  return parsed.unit === 's' || parsed.unit === '' ? parsed.number : null
}

/** The CSS keywords that name one of Figma's curves, and `step-end`, which holds. */
const KEYWORD_CURVES: Partial<Record<string, Easing['easing']>> = {
  linear: 'LINEAR',
  'ease-in': 'EASE_IN',
  'ease-out': 'OUT_CUBIC',
  'ease-in-out': 'INOUT_CUBIC',
  'step-end': 'HOLD'
}

/**
 * A CSS easing function as an easing: a keyword Figma has a preset for, `ease`, or
 * `cubic-bezier(x1, y1, x2, y2)` with both x between 0 and 1. Null for anything else.
 */
export function parseCSSEasing(value: string): Easing | null {
  const nodes = valueParser(value.trim()).nodes.filter((node) => node.type !== 'space')
  const [node] = nodes
  if (nodes.length !== 1) return null
  if (node.type === 'word') {
    const keyword = node.value.toLowerCase()
    if (keyword === 'ease')
      return { easing: 'CUSTOM_CUBIC', bezier: { x1: 0.25, y1: 0.1, x2: 0.25, y2: 1 } }
    const curve = KEYWORD_CURVES[keyword]
    return curve ? easingPreset(curve) : null
  }
  if (node.type !== 'function' || node.value.toLowerCase() !== 'cubic-bezier') return null
  // Exactly four numbers between commas: nothing else, such as a fifth argument or a function.
  const parts = node.nodes.filter((part) => part.type !== 'space')
  const separated = parts.every((part, index) =>
    index % 2 === 0 ? part.type === 'word' : part.type === 'div' && part.value === ','
  )
  if (parts.length !== 7 || !separated) return null
  const numbers = parts.filter((_, index) => index % 2 === 0).map((part) => dimension(part.value))
  if (numbers.some((number) => number?.unit !== '')) return null
  const [x1, y1, x2, y2] = numbers.map((number) => number?.number ?? 0)
  if (x1 < 0 || x1 > 1 || x2 < 0 || x2 > 1) return null
  return easingForBezier({ x1, y1, x2, y2 })
}
