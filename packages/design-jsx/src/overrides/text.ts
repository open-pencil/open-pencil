import { uniqBy } from 'es-toolkit'
import * as v from 'valibot'

import type { Fill, SceneNode, TextLength } from '@open-pencil/scene-graph'
import type { Color } from '@open-pencil/scene-graph/primitives'
import { percentLength, pixelLength } from '@open-pencil/scene-graph/text'

import { TEXT_DECORATION_STYLE } from '../enums'
import { parseScriptInput } from '../schema'
import { fillFromValue, isFillValue } from './fills'

/** Lengths that follow the font unless set take `'auto'`, as in CSS. */
export const AUTO = 'auto'
/** The decoration colour that follows the text's, as in CSS. */
export const CURRENT_COLOR = 'currentColor'

/** A percent of the font size, such as `'150%'`, which follows the size as in Figma. */
const PERCENT_LENGTH = /^(-?\d+(?:\.\d+)?)%$/

/** A line height or letter spacing a prop gives: pixels as a number, or a percent string. */
export function textLengthProp(value: unknown): TextLength | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return pixelLength(value)
  const match = typeof value === 'string' ? PERCENT_LENGTH.exec(value.trim()) : null
  return match ? percentLength(Number(match[1])) : undefined
}

/** A line height or letter spacing as a prop writes it. */
export function textLengthJSX(length: TextLength): number | `${number}%` {
  return length.unit === 'PIXELS' ? length.value : `${length.value}%`
}

const lengthSchema = v.pipe(v.number(), v.finite())
const autoLengthSchema = v.union([lengthSchema, v.literal(AUTO)])
/** An OpenType feature or axis tag: four printable ASCII characters, such as `tnum` or `wght`. */
const openTypeTagSchema = v.pipe(
  v.string(),
  v.regex(/^[\x20-\x7E]{4}$/, 'Expected a four-character tag')
)

const textPropsSchema = v.object({
  // Read by TEXT_DECORATION_STYLE, so an unknown style warns rather than failing the render.
  textDecorationStyle: v.optional(v.string()),
  textDecorationColor: v.optional(
    v.custom<string | Color | Fill>(isFillValue, 'Expected a colour or a paint')
  ),
  textDecorationThickness: v.optional(autoLengthSchema),
  textUnderlineOffset: v.optional(autoLengthSchema),
  textDecorationSkipInk: v.optional(v.boolean()),
  fontFeatures: v.optional(
    v.pipe(
      v.record(openTypeTagSchema, v.boolean()),
      // Tags are stored in capitals, so `liga` and `LIGA` are the same feature.
      v.check((features) => {
        const tags = Object.keys(features)
        return uniqBy(tags, (tag) => tag.toUpperCase()).length === tags.length
      }, 'Expected each feature tag once, in any case')
    )
  ),
  fontVariations: v.optional(v.record(openTypeTagSchema, lengthSchema)),
  lang: v.optional(v.nullable(v.pipe(v.string(), v.trim(), v.nonEmpty()))),
  fontOpticalSizing: v.optional(v.picklist([AUTO, 'none'])),
  paragraphSpacing: v.optional(lengthSchema),
  listSpacing: v.optional(lengthSchema),
  paragraphIndent: v.optional(lengthSchema),
  hangingList: v.optional(v.boolean())
})

function autoLength(value: number | typeof AUTO): number | null {
  return value === AUTO ? null : value
}

/**
 * The decoration details, font settings, and text-wide paragraph spacing a `<Text>` or `<Span>`
 * sets. Font settings replace the ones around them as a whole, as CSS's do.
 */
export function applyTextDetailOverrides(
  props: Record<string, unknown>,
  o: Partial<SceneNode>
): void {
  const parsed = parseScriptInput('Invalid <Text> props', textPropsSchema, props)
  const color = parsed.textDecorationColor
  const style = TEXT_DECORATION_STYLE.parse(parsed.textDecorationStyle)
  if (style) o.textDecorationStyle = style
  if (color !== undefined) {
    o.textDecorationFills =
      typeof color === 'string' && color.toLowerCase() === CURRENT_COLOR.toLowerCase()
        ? []
        : [fillFromValue(color)]
  }
  if (parsed.textDecorationThickness !== undefined)
    o.textDecorationThickness = autoLength(parsed.textDecorationThickness)
  if (parsed.textUnderlineOffset !== undefined)
    o.textUnderlineOffset = autoLength(parsed.textUnderlineOffset)
  if (parsed.textDecorationSkipInk !== undefined)
    o.textDecorationSkipInk = parsed.textDecorationSkipInk
  if (parsed.fontFeatures) {
    // The scene keeps feature tags as Figma does, in capitals.
    o.fontFeatures = Object.entries(parsed.fontFeatures).map(([tag, enabled]) => ({
      tag: tag.toUpperCase(),
      enabled
    }))
  }
  if (parsed.fontVariations) {
    o.fontVariations = Object.entries(parsed.fontVariations).map(([axis, value]) => ({
      axis,
      value
    }))
  }
  if (parsed.lang !== undefined) o.textLanguage = parsed.lang
  if (parsed.fontOpticalSizing !== undefined)
    o.opticalSizeFromFontSize = parsed.fontOpticalSizing === AUTO
  if (parsed.paragraphSpacing !== undefined) o.paragraphSpacing = parsed.paragraphSpacing
  if (parsed.listSpacing !== undefined) o.listSpacing = parsed.listSpacing
  if (parsed.paragraphIndent !== undefined) o.paragraphIndent = parsed.paragraphIndent
  if (parsed.hangingList !== undefined) o.hangingList = parsed.hangingList
}
