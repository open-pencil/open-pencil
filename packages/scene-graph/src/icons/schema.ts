import * as v from 'valibot'

/**
 * An icon's name in its set, `prefix:name`, as Iconify names icons. Names may hold dots, as SF
 * Symbols' do (`house.fill`).
 */
export const ICON_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*:[a-z0-9]+(?:[-_.][a-z0-9]+)*$/

/**
 * How an icon from a set we draw ourselves is drawn: a font's axes, such as Material Symbols'
 * `wght` and `FILL`, or SF Symbols' weight and scale. Icons from Iconify have none.
 */
export const iconOptionsSchema = v.record(v.string(), v.union([v.number(), v.string()]))

export type IconOptions = v.InferOutput<typeof iconOptionsSchema>

export const iconSchema = v.object({
  name: v.pipe(v.string(), v.regex(ICON_NAME)),
  /** A fingerprint of the glyph as placed, to tell when its paths were edited; see `iconGlyph`. */
  glyph: v.optional(v.string()),
  /**
   * Set for an icon drawn from one of our own sets rather than Iconify, so it is drawn again and
   * exported as the paths it draws rather than by its name alone.
   */
  options: v.optional(iconOptionsSchema)
})

/** An icon a frame draws. */
export type Icon = v.InferOutput<typeof iconSchema>

export const ICON_PAINTS = ['fill', 'stroke'] as const
export type IconPaint = (typeof ICON_PAINTS)[number]

export const iconTintSchema = v.pipe(v.array(v.picklist(ICON_PAINTS)), v.minLength(1))
