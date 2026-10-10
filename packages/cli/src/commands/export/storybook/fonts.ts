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
 * The folder a document's shared files, its fonts and design tokens, go in, named by its own
 * folder and file name, such as `openpencil/kit-design` for `../kit/design.fig`, so documents of
 * the same name in different folders exported together keep theirs apart; a one-page export
 * adds the page.
 */
export function documentFolder(source: string, page: string | undefined): string {
  const parts = source.split('/').filter((part) => part !== '..' && part !== '.')
  const file = (parts.pop() ?? '').replace(/\.[^.]*$/, '')
  const name = [parts.at(-1) ?? '', file, page ?? '']
    .join('-')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return `openpencil/${name || 'document'}`
}
