import { expectDefined } from '#test-support/assert'

import { fontManager } from '@open-pencil/core/text'

/**
 * Registers the app's bundled variable Inter as `family`, its upright file and its italic one, as
 * a host's own fonts are, so `loadFontAsync` loads any weight of it: text edits refuse unloaded
 * fonts. The italic is the italic file, as the app loads it, since the font manager is shared by
 * every test file after this one.
 */
export async function registerTestFont(family = 'Inter'): Promise<void> {
  const upright = expectDefined(await fontManager.fetchBundledFont('/InterVariable.ttf'), 'Inter')
  const italic = expectDefined(
    await fontManager.fetchBundledFont('/InterVariable-Italic.ttf'),
    'Inter Italic'
  )
  await fontManager.markLoaded(family, 'Regular', upright)
  await fontManager.markLoaded(family, 'Regular Italic', italic)
}
