import * as v from 'valibot'

import {
  graph,
  raw,
  updateNode,
  type NodeProxyInternals,
  type ProxyThis
} from '#core/figma-api/accessor-utils'
import { STYLE_NOT_FOUND } from '#core/figma-api/styles/apply'
import { setRangeParagraphSpacing } from '#core/figma-api/text'
import {
  assertTextBindableField,
  getRangeBoundVariable,
  rangeBindingChanges,
  rangeSharedStylePatch
} from '#core/figma-api/text/bindings'
import { assertTextRange } from '#core/figma-api/text/style'
import { parseFigma } from '#core/figma-api/validation'
import { styleRunsWithPatch } from '#core/text/character-style'

/** Methods that give characters a text or fill style, deprecated and async alike. */
const SHARED_STYLE_SETTERS = {
  setRangeTextStyleId: 'text',
  setRangeTextStyleIdAsync: 'text',
  setRangeFillStyleId: 'fill',
  setRangeFillStyleIdAsync: 'fill'
} as const

/**
 * Figma's range methods for what characters refer to outside the text: the text and fill styles
 * they use and the variables their fields are bound to.
 */
export function installTextReferenceMethods(
  methods: PropertyDescriptorMap,
  internals: NodeProxyInternals,
  mixed: symbol
): void {
  for (const [method, kind] of Object.entries(SHARED_STYLE_SETTERS)) {
    // The async methods reject with Figma's message alone, as its own do.
    const set = function (
      this: ProxyThis,
      start: number,
      end: number,
      styleId: unknown,
      async = false
    ) {
      const node = raw(this, internals)
      const id = parseFigma(v.string(), styleId, method, 'styleId')
      assertTextRange(method, node, start, end)
      const patch = rangeSharedStylePatch(graph(this, internals), kind, id)
      if (!patch) throw new Error(async ? STYLE_NOT_FOUND : `in ${method}: ${STYLE_NOT_FOUND}`)
      updateNode(this, internals, { styleRuns: styleRunsWithPatch(node, start, end, patch) })
    }
    methods[method] = {
      value: method.endsWith('Async')
        ? async function (this: ProxyThis, start: number, end: number, styleId: unknown) {
            set.call(this, start, end, styleId, true)
          }
        : set
    }
  }
  methods.getRangeBoundVariable = {
    value(this: ProxyThis, start: number, end: number, field: unknown) {
      const method = 'getRangeBoundVariable'
      const node = raw(this, internals)
      assertTextRange(method, node, start, end)
      return getRangeBoundVariable(node, start, end, assertTextBindableField(method, field), mixed)
    }
  }
  methods.setRangeBoundVariable = {
    value(this: ProxyThis, start: number, end: number, field: unknown, variable: unknown) {
      const method = 'setRangeBoundVariable'
      const node = raw(this, internals)
      const bindable = assertTextBindableField(method, field)
      assertTextRange(method, node, start, end)
      const g = graph(this, internals)
      const changes = rangeBindingChanges(g, node, start, end, bindable, variable)
      updateNode(this, internals, { styleRuns: changes.styleRuns })
      if (
        changes.paragraphValue !== null &&
        (bindable === 'paragraphSpacing' || bindable === 'paragraphIndent')
      ) {
        setRangeParagraphSpacing(
          g,
          raw(this, internals),
          bindable,
          start,
          end,
          changes.paragraphValue
        )
      }
    }
  }
}
