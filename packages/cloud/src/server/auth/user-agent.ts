import Bowser from 'bowser'
import { compact } from 'es-toolkit'

/** The browser and system a user agent names, as words for a person: `Chrome 141`, `macOS`. */
export function describeUserAgent(userAgent: string | null | undefined): {
  browser: string | null
  system: string | null
} {
  if (!userAgent) return { browser: null, system: null }
  const { browser, os } = Bowser.parse(userAgent)
  const version = browser.version?.split('.', 1)[0]
  return {
    browser: browser.name ? compact([browser.name, version]).join(' ') : null,
    system: os.name || null
  }
}
