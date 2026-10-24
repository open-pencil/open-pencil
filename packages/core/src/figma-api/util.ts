/// <reference types="@figma/plugin-typings" />

import * as v from 'valibot'

import { parseDisplayableColor } from '@open-pencil/scene-graph/color'
import type { Color } from '@open-pencil/scene-graph/primitives'

const channelSchema = v.pipe(v.number(), v.finite(), v.minValue(0), v.maxValue(1))
const colorObjectSchema = v.object({
  r: channelSchema,
  g: channelSchema,
  b: channelSchema,
  a: v.optional(channelSchema)
})

function readColor(color: unknown): Color | null {
  if (typeof color === 'string') return parseDisplayableColor(color)
  if (!v.is(colorObjectSchema, color)) return null
  return { r: color.r, g: color.g, b: color.b, a: color.a ?? 1 }
}

/** `color` as `figma.util` takes it: a CSS color string, or an RGB or RGBA object. */
function parseColor(method: string, color: unknown): RGBA {
  const parsed = readColor(color)
  if (parsed) return parsed
  throw new Error(
    `in ${method}: Cannot read ${JSON.stringify(color)} as a color. Pass a CSS color such as ` +
      `'#FF00FF' or 'hsl(300 100% 50% / 0.5)', or { r, g, b, a? } with channels from 0 to 1`
  )
}

function rgb(color: string | RGB | RGBA): RGB {
  const { r, g, b } = parseColor('rgb', color)
  return { r, g, b }
}

function rgba(color: string | RGB | RGBA, alphaOverride?: number): RGBA {
  const parsed = parseColor('rgba', color)
  if (alphaOverride === undefined) return parsed
  if (!v.is(channelSchema, alphaOverride)) {
    throw new Error('in rgba: alphaOverride must be a number from 0 to 1')
  }
  return { ...parsed, a: alphaOverride }
}

/** A solid paint of `color`, its alpha the opacity, keeping the other properties of `overrides`. */
function solidPaint(color: string | RGB | RGBA, overrides?: Partial<SolidPaint>): SolidPaint {
  const { r, g, b, a } = parseColor('solidPaint', color)
  return { ...overrides, type: 'SOLID', color: { r, g, b }, opacity: a }
}

/** Figma normalizes for its rich-text editors, which OpenPencil does not have. */
function normalizeMarkdown(): string {
  throw new Error('in normalizeMarkdown: OpenPencil does not support rich-text Markdown')
}

/** Figma's `figma.util`, whose functions a script may call detached (`const rgb = figma.util.rgb`). */
export const figmaUtil: UtilAPI = Object.freeze({ rgb, rgba, solidPaint, normalizeMarkdown })
