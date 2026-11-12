import { fontManager } from '@open-pencil/core/text'

/**
 * Test preload: no web font provider is on, so no test waits on Google or Fontsource, whose
 * answers outside a browser would come from the real network. A test that needs a provider turns
 * it on with `setOnlineFontProviders`, stubs `setWebFontFetch`, and restores what it found.
 */
fontManager.setOnlineFontProviders({})
