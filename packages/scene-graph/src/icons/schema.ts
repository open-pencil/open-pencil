import * as v from 'valibot'

/** An icon's name in its set, `prefix:name`, as Iconify names icons. */
export const ICON_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*:[a-z0-9]+(?:[-_][a-z0-9]+)*$/

export const iconSchema = v.object({
  name: v.pipe(v.string(), v.regex(ICON_NAME)),
  /** A fingerprint of the glyph as placed, to tell when its paths were edited; see `iconGlyph`. */
  glyph: v.optional(v.string())
})

/** An icon a frame draws. */
export type Icon = v.InferOutput<typeof iconSchema>

export const ICON_PAINTS = ['fill', 'stroke'] as const
export type IconPaint = (typeof ICON_PAINTS)[number]

export const iconTintSchema = v.pipe(v.array(v.picklist(ICON_PAINTS)), v.minLength(1))
