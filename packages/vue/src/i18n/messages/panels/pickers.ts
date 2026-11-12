import { count, params } from '@nanostores/i18n'

/**
 * Messages of the `panels` namespace for the font, icon, and stock photo pickers, and the color
 * editor.
 */
export const pickerPanelMessageDefaults = {
  searchFonts: 'Search fonts...',
  noFontsFound: 'No fonts found',
  searchIcons: 'Search icons...',
  searchingIcons: 'Searching…',
  loadingIcons: 'Loading icons…',
  loadingIconSets: 'Loading icon sets…',
  noIconsFound: 'No icons found',
  iconSearchHint: 'Type to search over 200,000 open-source icons',
  iconSearchFailed: 'Icons could not be loaded. Check your connection.',
  insertIconFailed: 'The icon could not be inserted.',
  iconSet: 'Icon set',
  allIconSets: 'All icon sets',
  searchIconSets: 'Search icon sets...',
  noIconSetsFound: 'No icon sets found',
  recentIcons: 'Recent',
  iconsInFile: 'In this file',
  otherIconSets: 'Other',
  /** The image fill's button that fills it with a photo from Unsplash or Pexels. */
  stockPhoto: 'Stock photo',
  searchPhotos: 'Search photos...',
  noPhotosFound: 'No photos found',
  photoSearchHint: params('Type to search free photos on {service}'),
  photoSearchFailed: params('{service} could not be searched. Check your connection and key.'),
  insertPhotoFailed: 'The photo could not be inserted.',
  photoService: 'Photo service',
  /** The picker's credit for a photo, as the services ask to be credited. */
  photoCredit: params('Photo by {photographer} on {service}'),
  photoKeyHeading: params('Connect {service}'),
  photoKeyDescription: params(
    '{service} photos are free to use. Add its free API key in Settings to search them here.'
  ),
  photoKeyAction: 'Open Settings',
  iconResultCount: count({ one: '{count} result', many: '{count} results' }),
  /** More icons match than a search returns. */
  iconResultCountCapped: params('{count}+ results'),
  noLocalFontsAvailable: 'No local fonts available.',
  localFontsAccessHint: 'Use the desktop app or Chrome/Edge to access system fonts.',
  editColor: 'Edit color',
  red: 'Red',
  green: 'Green',
  blue: 'Blue',
  hue: 'Hue',
  saturation: 'Saturation',
  brightness: 'Brightness',
  lightness: 'Lightness',
  chroma: 'Chroma',
  alpha: 'Alpha'
} as const
