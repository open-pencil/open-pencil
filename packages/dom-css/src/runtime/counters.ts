import valueParser from 'postcss-value-parser'

import { formatListNumber, type ListNumberFormat } from '@open-pencil/scene-graph/text'

/** One counter's instance: its value, and the element whose children see it, null at the root. */
interface CounterInstance {
  value: number
  scope: Element | null
}

/** The values a `counter-reset`, `counter-increment`, or `counter-set` gives each name. */
function counterValues(value: string, fallback: number): [string, number][] {
  if (value === 'none') return []
  const words = valueParser(value)
    .nodes.filter((node) => node.type === 'word')
    .map((node) => node.value)
  const pairs: [string, number][] = []
  for (let index = 0; index < words.length; index++) {
    const name = words[index]
    const next = Number(words[index + 1])
    if (Number.isInteger(next)) {
      pairs.push([name, next])
      index++
    } else pairs.push([name, fallback])
  }
  return pairs
}

/** The list number formats `formatListNumber` writes, by the CSS counter style that names each. */
const LIST_FORMATS: Partial<Record<string, ListNumberFormat>> = {
  'lower-alpha': 'LOWER_ALPHA',
  'lower-latin': 'LOWER_ALPHA',
  'lower-roman': 'LOWER_ROMAN'
}

/**
 * A counter's value in a list style, as `counter(name, style)` writes it; decimal by default.
 * Letters and Roman numerals count from 1, so other values stay decimal, as browsers fall back.
 */
function formatted(value: number, style: string | undefined): string {
  const name = style?.toLowerCase() ?? 'decimal'
  if (name === 'decimal-leading-zero') return value >= 0 && value < 10 ? `0${value}` : String(value)
  const upper = name.startsWith('upper-')
  const format = LIST_FORMATS[upper ? `lower-${name.slice('upper-'.length)}` : name]
  if (!format || value < 1 || (format === 'LOWER_ROMAN' && value >= 4000)) return String(value)
  const text = formatListNumber(value, format)
  return upper ? text.toUpperCase() : text
}

/** The counters in effect, by name, innermost last, as CSS scopes them in document order. */
export class CounterState {
  readonly #counters = new Map<string, CounterInstance[]>()

  /** Applies an element's or pseudo-element's `counter-reset`, `counter-increment`, and `counter-set`. */
  apply(style: CSSStyleDeclaration, scope: Element | null): void {
    for (const [name, value] of counterValues(style.getPropertyValue('counter-reset'), 0)) {
      const stack = this.#counters.get(name) ?? []
      // A reset among the siblings that share a counter replaces it; otherwise it nests a new one.
      const innermost = stack.at(-1)
      if (innermost?.scope === scope) innermost.value = value
      else stack.push({ value, scope })
      this.#counters.set(name, stack)
    }
    for (const [name, value] of counterValues(style.getPropertyValue('counter-increment'), 1)) {
      this.#innermost(name).value += value
    }
    for (const [name, value] of counterValues(style.getPropertyValue('counter-set'), 0)) {
      this.#innermost(name).value = value
    }
  }

  /** Ends the counters an element's children reset, as its subtree ends. */
  leave(element: Element): void {
    for (const stack of this.#counters.values()) {
      while (stack.at(-1)?.scope === element) stack.pop()
    }
  }

  /** The text `counter(name, style)` or `counters(name, separator, style)` shows now. */
  text(node: valueParser.FunctionNode): string {
    const args = node.nodes.filter((part) => part.type === 'word' || part.type === 'string')
    const name = args.at(0)?.value ?? ''
    const stack = this.#counters.get(name) ?? []
    if (node.value.toLowerCase() === 'counters') {
      const separator = args.at(1)?.value ?? ''
      const style = args.at(2)?.value
      const values = stack.length > 0 ? stack.map((instance) => instance.value) : [0]
      return values.map((value) => formatted(value, style)).join(separator)
    }
    return formatted(stack.at(-1)?.value ?? 0, args.at(1)?.value)
  }

  /** The innermost instance of a counter, made at the root when none is in effect, as in CSS. */
  #innermost(name: string): CounterInstance {
    const stack = this.#counters.get(name) ?? []
    let innermost = stack.at(-1)
    if (!innermost) {
      innermost = { value: 0, scope: null }
      stack.push(innermost)
      this.#counters.set(name, stack)
    }
    return innermost
  }
}
