import type { CharacterStyleOverride } from '@open-pencil/scene-graph'

import type { JSXProp } from './value'

/** The font settings a `<Text>` or `<Span>` writes, by their scene fields. */
export const FONT_SETTING_FIELDS = ['fontFeatures', 'fontVariations', 'textLanguage'] as const

type FontSettings = Pick<CharacterStyleOverride, (typeof FONT_SETTING_FIELDS)[number]>

/** The font settings set in `style`, as `<Text>` and `<Span>` write them. */
export function collectFontSettingProps(style: FontSettings, props: JSXProp[]): void {
  if (style.fontFeatures) {
    props.push([
      'fontFeatures',
      Object.fromEntries(style.fontFeatures.map(({ tag, enabled }) => [tag.toLowerCase(), enabled]))
    ])
  }
  if (style.fontVariations) {
    props.push([
      'fontVariations',
      Object.fromEntries(style.fontVariations.map(({ axis, value }) => [axis, value]))
    ])
  }
  if (style.textLanguage !== undefined) props.push(['lang', style.textLanguage])
}
