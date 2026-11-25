import type { CSSComputeOptions, CSSRuntime, DesignDocument, DesignElement } from '#dom-css/types'

import { parseCSSNumber } from '@open-pencil/scene-graph/css'
import type { Color } from '@open-pencil/scene-graph/primitives'

import { anyCSSColor } from '../css-values'

/** What a custom property holds as a design variable: a color, or a number of pixels or units. */
export type CustomPropertyValue =
  | { type: 'COLOR'; color: Color }
  | { type: 'FLOAT'; number: number }

/** A color no page writes, which a probe keeps when its custom property is not a color. */
const NOT_A_COLOR = 'rgb(1 2 3 / 0.0039)'

/** A tag no page styles by name. */
const PROBE_TAG = 'open-pencil-probe'

function probe(name: string): DesignElement {
  const value = `var(${name}) !important`
  // Rules such as `* { --primary: red !important }` reach probes too; an inline declaration wins.
  const own = `${name}: inherit !important`
  return {
    type: 'element',
    tagName: PROBE_TAG,
    attrs: {
      style: `${own}; color: ${value}; width: ${value}; line-height: ${value}; display: block !important`
    },
    children: []
  }
}

function holder(children: DesignElement[], rootValues: string): DesignElement {
  const style = `${rootValues}; display: block !important; color: ${NOT_A_COLOR} !important; width: auto !important; line-height: normal !important`
  return { type: 'element', tagName: PROBE_TAG, attrs: { style }, children }
}

/** A computed length in pixels. */
export function lengthOf(value: string | undefined): number | null {
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
  declared: Readonly<Record<string, string>>,
  compute: CSSComputeOptions
): Promise<Map<string, CustomPropertyValue>> {
  const names = Object.keys(declared)
  const rootValues = Object.entries(declared)
    .map(([name, value]) => `${name}: ${value} !important`)
    .join('; ')
  const document: DesignDocument = {
    type: 'document',
    children: [holder(names.map(probe), rootValues)]
  }
  const styled = await runtime.computeStyles(document, cssText, {
    ...compute,
    references: false
  })
  const root = styled.children.at(0)
  const values = new Map<string, CustomPropertyValue>()
  if (root?.type !== 'element') return values
  const notAColor = root.computedStyle?.color
  // A page's `*::before` rules give the holder children of their own.
  const probes = root.children.filter(
    (child) => child.type === 'element' && child.tagName === PROBE_TAG
  )
  for (const [index, name] of names.entries()) {
    const child = probes.at(index)
    if (child?.type !== 'element') continue
    const { color: text, width, 'line-height': lineHeight } = child.computedStyle ?? {}
    const color = text === notAColor ? null : anyCSSColor(text)
    if (color) {
      values.set(name, { type: 'COLOR', color })
      continue
    }
    const number = lengthOf(width) ?? numberOf(lineHeight)
    if (number !== null) values.set(name, { type: 'FLOAT', number })
  }
  return values
}
