import { MATERIAL_SYMBOLS_PREFIXES } from './material-symbols/font'
import { createMaterialSymbolsProvider } from './material-symbols/provider'
import { createIconifyProvider, type IconProvider } from './provider'
import { createIconSetsProvider, type IconSetSource } from './sets'

export {
  createIconifyProvider,
  parseIconName,
  type IconProvider,
  type IconSearchOptions
} from './provider'
export {
  detachIcon,
  drawIcon,
  iconColor,
  placeIcon,
  recolorIcon,
  swapIcon,
  type PlaceIconOptions
} from './render'
export type { IconCollection, IconData, IconOption, IconPath, IconSearchResult } from './types'
export { createMaterialSymbolsProvider } from './material-symbols/provider'
export { MATERIAL_SYMBOLS_PREFIXES } from './material-symbols/font'
export { createIconSetsProvider, type IconSetSource, type IconSetsOptions } from './sets'
export {
  createSFSymbolsProvider,
  SF_SYMBOLS_PREFIX,
  type SFSymbolsHost
} from './sf-symbols/provider'

/** Iconify's icons, every set as Iconify serves it. */
export const iconify: IconProvider = createIconifyProvider()

/** Iconify's copies of Material Symbols: one fixed weight each, without the fonts' axes. */
const ICONIFY_MATERIAL_SYMBOLS = ['material-symbols', 'material-symbols-light']

/**
 * Icons from Iconify, with Material Symbols drawn from Google's variable fonts at any of their
 * axes in place of Iconify's copies. `fetcher` reaches Google, as a host's web fonts do; `sources`
 * adds sets only some hosts draw, such as SF Symbols on a Mac.
 */
export function createIconProvider(
  fetcher: typeof globalThis.fetch = globalThis.fetch,
  sources: readonly IconSetSource[] = []
): IconProvider {
  return createIconSetsProvider({
    sources: [
      { prefixes: MATERIAL_SYMBOLS_PREFIXES, provider: createMaterialSymbolsProvider(fetcher) },
      ...sources
    ],
    fallback: iconify,
    replaced: ICONIFY_MATERIAL_SYMBOLS
  })
}

/** The icons hosts use unless they pass a provider of their own. */
export const defaultIcons: IconProvider = createIconProvider()
