import type { NodeChange } from '@open-pencil/kiwi/fig/codec'

import { TEXT_STYLE_FIELDS, type TextStyleLookup } from '../node-change/style/lookup'
import type { InstanceOccurrence } from './occurrence/types'

/** In Figma a decoration override keeps the text style attached; every other style field detaches it. */
const FIELDS_AN_OVERRIDE_DETACHES = TEXT_STYLE_FIELDS.filter((field) => field !== 'textDecoration')

/** Figma draws an inherited text style's values over those a claim saves beside it (saved glyphs, desktop 126). */
export function yieldToInheritedTextStyle(
  target: InstanceOccurrence,
  claim: Partial<NodeChange>,
  textStyle: TextStyleLookup
): void {
  const claimsStyledField = FIELDS_AN_OVERRIDE_DETACHES.some((field) => field in claim)
  if (!claimsStyledField || 'styleIdForText' in claim) {
    return
  }
  const style = textStyle(target.properties.styleIdForText)
  if (!style) {
    return
  }
  for (const field of FIELDS_AN_OVERRIDE_DETACHES) {
    const styleValue = style[field]
    if (styleValue !== undefined) {
      Reflect.deleteProperty(claim, field)
      Object.assign(target.properties, { [field]: structuredClone(styleValue) })
    }
  }
}
