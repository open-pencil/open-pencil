import { uniq } from 'es-toolkit/array'

import { exportWebFontFaceAssets } from '@open-pencil/core/text/web-font/assets'
import type { WebFontFaceResolver } from '@open-pencil/dom-css'

import { warn } from '#cli/format'

/**
 * The font files stories' text uses, from the web font providers the editor uses. A family no
 * provider has falls back to the browser's fonts, which the export warns about rather than
 * failing, since the stories still work.
 */
export const storyFonts: WebFontFaceResolver = async (fonts, assetBasePath) => {
  const { assets } = await exportWebFontFaceAssets({ fonts, assetBasePath })
  const found = new Set(assets.map((asset) => asset.family))
  const missing = uniq(fonts.map((font) => font.family).filter((family) => !found.has(family)))
  if (missing.length > 0)
    console.error(
      warn(`No font files found for ${missing.join(', ')}; stories use the browser's fonts.`)
    )
  return assets
}

/**
 * The folder a document's font files go in, named by its path relative to the output, such as
 * `fonts/kit-design` for `../kit/design.fig`, so documents exported into one folder, even ones
 * with the same name, never share one; a one-page export adds the page.
 */
export function fontFolder(source: string, page: string | undefined): string {
  const name = [source.replace(/\.[^./]*$/, ''), page ?? '']
    .join('-')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return `fonts/${name || 'document'}`
}
