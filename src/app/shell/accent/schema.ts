import * as v from 'valibot'

export const ACCENT_PRESETS = [
  'blue',
  'purple',
  'pink',
  'red',
  'orange',
  'yellow',
  'green',
  'graphite'
] as const
export type AccentPreset = (typeof ACCENT_PRESETS)[number]

/** A named accent, or any color the user picked, stored as `#RRGGBB`. */
export const accentPreferenceSchema = v.variant('kind', [
  v.object({ kind: v.literal('preset'), preset: v.picklist(ACCENT_PRESETS) }),
  v.object({
    kind: v.literal('custom'),
    color: v.pipe(v.string(), v.hexColor(), v.length(7), v.toUpperCase())
  })
])
export type AccentPreference = v.InferOutput<typeof accentPreferenceSchema>
