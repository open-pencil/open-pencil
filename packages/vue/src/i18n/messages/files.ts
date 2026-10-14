import { params } from '@nanostores/i18n'

import { i18n } from '#vue/i18n/create'

export const filesMessageDefaults = {
  importLabel: 'Import',
  importHTMLCSS: 'Import HTML/CSS',
  importHTMLCSSDescription: 'Paste HTML plus optional CSS or compiled Tailwind CSS.',
  importFailed: 'Import failed. Check the HTML and CSS, then try again.',
  importReplacesDocument: 'Import replaces the current document.',
  importing: 'Importing…',
  importToCanvas: 'Import to canvas',
  newTab: 'New tab',
  home: 'Home',
  closeTab: params('Close {name}'),
  saveBeforeClosing: params('Save changes to “{name}”?'),
  saveBeforeClosingDescription: 'Your changes will be discarded if you close without saving.',
  discard: 'Don’t Save',
  clipboardImageUnavailableWeb:
    'Pasted design includes 1 image that cannot be loaded in the web app. Use the desktop app to include it.',
  clipboardImagesUnavailableWeb: params(
    'Pasted design includes {count} images that cannot be loaded in the web app. Use the desktop app to include them.'
  ),
  clipboardImageFetchFailed:
    'Failed to fetch 1 image from Figma. Check that the source file is accessible and try again.',
  clipboardImagesFetchFailed: params(
    'Failed to fetch {count} images from Figma. Check that the source file is accessible and try again.'
  ),
  recentFiles: 'Recent files',
  recents: 'Recents',
  onThisDevice: 'Saved on this device',
  syncedTo: params('Synced to {location}'),
  syncingTo: params('Syncing to {location}…'),
  syncFailed: params('Can’t sync to {location}'),
  syncOffline: 'Offline: saved on this device until the network is back',
  noDesigns: 'No designs yet',
  open: 'Open',
  rename: 'Rename',
  duplicate: 'Duplicate',
  moveToTrash: 'Move to trash',
  trash: 'Trash',
  restore: 'Restore',
  deletePermanently: 'Permanently delete',
  emptyTrash: 'Empty trash',
  trashEmpty: 'Trash is empty',
  trashEmptyDescription: 'Designs you move to the trash stay here until you delete them.',
  emptyTrashHeading: 'Empty trash?',
  emptyTrashDescription:
    'Every design in the trash is removed from this device and from storage. This can’t be undone.',
  deletePermanentlyDescription:
    'It is removed from this device and from storage. This can’t be undone.',
  deletePermanentlyHeading: params('Permanently delete “{name}”?'),
  trashedOn: params('Trashed {date}'),
  noDesignsDescription: 'Designs you create or open are saved here automatically.',
  recentFilesDescription: 'Continue working on a design or start a new one.',
  searchFiles: 'Search files…',
  newDesign: 'New design',
  noMatchingFiles: params('No files match “{query}”.'),
  saveAsPrompt: 'Save as:',
  deck: 'Deck',
  deckMetadata: params('Deck · {date}'),
  deckCannotOpen: 'Slide decks can’t be opened in this version of OpenPencil.',
  downloadDeck: 'Download .deck',
  conflictedCopy: params('{name} (conflicted copy)'),
  duplicateName: params('{name} (Copy)'),
  changedOnAnotherDevice: 'Changed on another device',
  keepMyVersionAsCopy: 'Keep my version as a copy',
  useOtherDeviceVersion: 'Use the other device’s version',
  browserFileAPINotSupported:
    "Your browser doesn't support the local file API. Files will be downloaded instead of saved in place."
} as const

export const filesMessages = i18n('files', filesMessageDefaults)
