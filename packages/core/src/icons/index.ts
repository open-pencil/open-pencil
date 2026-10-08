import { createIconifyProvider, type IconProvider } from './provider'

export {
  createIconifyProvider,
  parseIconName,
  type IconProvider,
  type IconSearchOptions
} from './provider'
export { iconColor, placeIcon, recolorIcon, swapIcon, type PlaceIconOptions } from './render'
export type { IconData, IconPath, IconSearchResult } from './types'

/** The Iconify icons hosts use unless they pass a provider of their own. */
export const iconify: IconProvider = createIconifyProvider()
