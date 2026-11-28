import { fontManager } from '@open-pencil/core/text'

/**
 * Test preload: no web font provider is on, so no test waits on Google or Fontsource, whose
 * answers outside a browser would come from the real network. A test that needs a provider turns
 * it on with `setOnlineFontProviders`, stubs `setWebFontFetch`, and restores what it found.
 */
fontManager.setOnlineFontProviders({})

/**
 * Nor does the CLI read the machine's installed fonts, in the tests or the CLI they run, so a
 * document draws in the same fonts on every machine. A test that needs installed fonts names
 * its own folders in `OPENPENCIL_FONT_DIRS`.
 */
process.env.OPENPENCIL_FONT_DIRS = ''
