import { fontManager } from '@open-pencil/core/text'

import { expectDefined } from '#tests/helpers/assert'

/**
 * Registers the app's bundled variable Inter as `family`, upright and italic, as a host's own
 * fonts are, so `loadFontAsync` loads any weight of it: text edits refuse unloaded fonts.
 */
export async function registerTestFont(family = 'Inter'): Promise<void> {
  const data = expectDefined(await fontManager.fetchBundledFont('/InterVariable.ttf'), 'Inter')
  await fontManager.markLoaded(family, 'Regular', data)
  await fontManager.markLoaded(family, 'Regular Italic', data)
}
