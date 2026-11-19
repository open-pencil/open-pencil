import { parseCSSNumber } from '@open-pencil/scene-graph/css'

import { contentInsets } from '../import/box'
import { inheritedTextStyle } from '../import/flow'
import type { DesignElement, DesignLayout, DesignStyleDeclaration } from '../types'

/** Input types that show what is typed, or their placeholder, as a line of text. */
const TEXT_INPUT_TYPES = new Set(['', 'text', 'email', 'search', 'url', 'tel', 'number'])

/** The text a form field shows: what is typed into it, else its placeholder, and which. */
function shownText(field: HTMLInputElement | HTMLTextAreaElement) {
  if (field.value) return { text: field.value, placeholder: false }
  return field.placeholder ? { text: field.placeholder, placeholder: true } : null
}

/**
 * Where a field's text sits: inside its border and padding, and for a one-line field, its line
 * centered on that box, as browsers center an input's text however tall the box is.
 */
function textBox(
  layout: DesignLayout,
  style: DesignStyleDeclaration,
  oneLine: boolean
): DesignLayout {
  const { top, right, bottom, left } = contentInsets(style)
  const { x, y, width, height } = layout.box
  const content = {
    x: x + left,
    y: y + top,
    width: Math.max(0, width - left - right),
    height: Math.max(0, height - top - bottom)
  }
  const fontSize = parseCSSNumber(style['font-size']) ?? 16
  const line = parseCSSNumber(style['line-height']) ?? fontSize * NORMAL_LINE_HEIGHT
  if (!oneLine) return { box: content }
  return { box: { ...content, y: content.y + (content.height - line) / 2, height: line } }
}

/** The line height `normal` gives most fonts, as a multiple of the font size. */
const NORMAL_LINE_HEIGHT = 1.2

/**
 * Shows the text a text field draws inside it, which no element of the page holds: what is typed
 * into it in its own style, or its placeholder in the `::placeholder` style, as a child named
 * `::value` or `::placeholder` laid out in its content box. A password's value stays hidden.
 */
export function showFormText(
  pairs: readonly [DesignElement, Element][],
  view: Window & typeof globalThis,
  styleOf: (style: CSSStyleDeclaration) => DesignStyleDeclaration
): void {
  for (const [designElement, domElement] of pairs) {
    const isInput =
      domElement instanceof view.HTMLInputElement && TEXT_INPUT_TYPES.has(domElement.type)
    const field = isInput || domElement instanceof view.HTMLTextAreaElement ? domElement : null
    if (!field) continue
    const shown = shownText(field)
    const own = designElement.computedStyle
    if (!shown || !own) continue
    const style = shown.placeholder
      ? styleOf(view.getComputedStyle(domElement, '::placeholder'))
      : own
    designElement.children = [
      {
        type: 'element',
        tagName: shown.placeholder ? '::placeholder' : '::value',
        attrs: {},
        children: [{ type: 'text', text: shown.text }],
        // Only the text's own styling: the field's padding, border, and background stay on it.
        computedStyle: {
          ...inheritedTextStyle(style),
          display: 'block',
          'white-space': isInput ? 'pre' : 'pre-wrap'
        },
        // The line is the field's own, whatever its placeholder's style says.
        layout: designElement.layout && textBox(designElement.layout, own, isInput)
      }
    ]
  }
}
