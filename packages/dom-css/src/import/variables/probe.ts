import type { CSSComputeOptions, CSSRuntime, DesignDocument, DesignElement } from '#dom-css/types'

import { parseCSSColor, parseCSSNumber } from '@open-pencil/scene-graph/css'
import type { Color } from '@open-pencil/scene-graph/primitives'

/** What a custom property holds as a design variable: a color, or a number of pixels or units. */
export type CustomPropertyValue =
  | { type: 'COLOR'; color: Color }
  | { type: 'FLOAT'; number: number }

/** A color no page writes, which a probe keeps when its custom property is not a color. */
const NOT_A_COLOR = 'rgb(1 2 3 / 0.0039)'

function probe(name: string): DesignElement {
  const value = `var(${name}) !important`
  return {
    type: 'element',
    tagName: 'div',
    attrs: {
      style: `color: ${value}; width: ${value}; line-height: ${value}; display: block !important`
    },
    children: []
  }
}

function holder(children: DesignElement[]): DesignElement {
  const style = `color: ${NOT_A_COLOR} !important; width: auto !important; line-height: normal !important`
  return { type: 'element', tagName: 'div', attrs: { style }, children }
}

function lengthOf(value: string | undefined): number | null {
  return value?.endsWith('px') ? parseCSSNumber(value) : null
}

function numberOf(value: string | undefined): number | null {
  return value && /^[\d.]+$/.test(value) ? Number(value) : null
}

/**
 * The value of each of the root's custom properties as CSS resolves it, `calc()` and aliases
 * included, found by styling an element with it. One that is neither a color, a length, nor a
 * number, such as a font list, is left out.
 */
export async function customPropertyValues(
  runtime: CSSRuntime,
  cssText: string,
  names: readonly string[],
  compute: CSSComputeOptions
): Promise<Map<string, CustomPropertyValue>> {
  const document: DesignDocument = { type: 'document', children: [holder(names.map(probe))] }
  const styled = await runtime.computeStyles(document, cssText, { ...compute, references: false })
  const root = styled.children.at(0)
  const values = new Map<string, CustomPropertyValue>()
  if (root?.type !== 'element') return values
  const notAColor = root.computedStyle?.color
  for (const [index, name] of names.entries()) {
    const child = root.children.at(index)
    if (child?.type !== 'element') continue
    const { color: text, width, 'line-height': lineHeight } = child.computedStyle ?? {}
    const color = text === notAColor ? null : parseCSSColor(text)
    if (color) {
      values.set(name, { type: 'COLOR', color })
      continue
    }
    const number = lengthOf(width) ?? numberOf(lineHeight)
    if (number !== null) values.set(name, { type: 'FLOAT', number })
  }
  return values
}
