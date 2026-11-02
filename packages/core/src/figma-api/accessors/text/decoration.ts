import * as v from 'valibot'

import type { SceneNode } from '@open-pencil/scene-graph'

import {
  raw,
  updateNode,
  type NodeProxyInternals,
  type ProxyThis
} from '#core/figma-api/accessor-utils'
import { assertTextFontsLoaded } from '#core/figma-api/fonts/loaded'
import { getTextStyle, rangeHasUnderline } from '#core/figma-api/text/style'
import { parseFigma } from '#core/figma-api/validation'
import { textStyleChanges, type TextStylePatch } from '#core/text/character-style'

import { DECORATION_STYLES, decorationColorFills, enumValue, lengthOrAuto, sized } from './values'

/** The text properties that style an underline, as Figma names them. */
export type DecorationField =
  | 'textDecorationStyle'
  | 'textDecorationOffset'
  | 'textDecorationThickness'
  | 'textDecorationColor'
  | 'textDecorationSkipInk'

/** How Figma names each property in its messages. */
const NAMES: Record<DecorationField, string> = {
  textDecorationStyle: 'style',
  textDecorationOffset: 'offset',
  textDecorationThickness: 'thickness',
  textDecorationColor: 'color',
  textDecorationSkipInk: 'skip ink'
}

/** What a value gives the characters it styles, checked as Figma checks it for `property`. */
const PATCHES: Record<
  DecorationField,
  (method: string, value: unknown, property: string) => TextStylePatch
> = {
  textDecorationStyle: (method, value, property) => ({
    textDecorationStyle: enumValue(method, value, DECORATION_STYLES, property)
  }),
  // Kept in pixels, so a percent gives characters of each size their own length.
  textDecorationOffset: (method, value, property) => {
    const length = sized(lengthOrAuto(method, value, property))
    return (fontSize) => ({ textUnderlineOffset: length(fontSize) })
  },
  textDecorationThickness: (method, value, property) => {
    const length = sized(lengthOrAuto(method, value, property))
    return (fontSize) => ({ textDecorationThickness: length(fontSize) })
  },
  textDecorationColor: (method, value) => ({
    textDecorationFills: decorationColorFills(method, value)
  }),
  textDecorationSkipInk: (method, value, property) => {
    return { textDecorationSkipInk: parseFigma(v.boolean(), value, method, property) }
  }
}

/** Underline styles apply to underlined text only; Figma refuses a range with none. */
function assertUnderlined(
  method: string,
  field: DecorationField,
  node: SceneNode,
  start: number,
  end: number
): void {
  if (!rangeHasUnderline(node, start, end)) {
    throw new Error(
      `in ${method}: Cannot set text decoration ${NAMES[field]} on a non-underlined text range`
    )
  }
}

/** The style a `setRangeTextDecoration*` method gives `text[start, end)`. */
export function rangeDecorationPatch(
  field: DecorationField,
  method: string,
  node: SceneNode,
  start: number,
  end: number,
  value: unknown
): TextStylePatch {
  const patch = PATCHES[field](method, value, 'value')
  assertUnderlined(method, field, node, start, end)
  return patch
}

/**
 * The node's underline style setters, which give every character the value. Each refuses text
 * with no underline, as the range methods do, except skip ink, which Figma keeps for an underline
 * added later (Figma desktop 126).
 */
function decorationAccessor(
  internals: NodeProxyInternals,
  field: DecorationField,
  mixed: symbol
): PropertyDescriptor {
  return {
    get(this: ProxyThis): unknown {
      return getTextStyle(raw(this, internals), field, mixed)
    },
    set(this: ProxyThis, value: unknown) {
      const method = `set_${field}`
      const node = raw(this, internals)
      const patch = PATCHES[field](method, value, field)
      if (field !== 'textDecorationSkipInk')
        assertUnderlined(method, field, node, 0, node.text.length)
      // The colour is a paint, which Figma takes with the text's fonts unloaded.
      if (field !== 'textDecorationColor') assertTextFontsLoaded(method, node)
      const changes =
        typeof patch === 'function'
          ? textStyleChanges(node, patch(node.fontSize), patch)
          : textStyleChanges(node, patch)
      updateNode(this, internals, changes)
    }
  }
}

export function installTextDecorationAccessors(
  prototype: object,
  internals: NodeProxyInternals,
  mixed: symbol
): void {
  const fields = Object.keys(NAMES) as DecorationField[]
  Object.defineProperties(
    prototype,
    Object.fromEntries(fields.map((field) => [field, decorationAccessor(internals, field, mixed)]))
  )
}
