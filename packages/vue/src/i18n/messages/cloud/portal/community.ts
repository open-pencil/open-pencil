import { params } from '@nanostores/i18n'

/** Messages of the `cloudPortal` namespace for the server's community gallery pages. */
export const communityPortalMessageDefaults = {
  communityTitle: 'Community',
  communityDescription: 'Files to open, explore, and copy into your own workspace.',
  communityEmpty: 'Nothing has been published here yet.',
  communityAllFiles: 'All files',
  communityKindDesign: 'Design file',
  communityKindBoard: 'Board',
  communityUpdated: params('Updated {date}'),
  communityPreview: params('Preview of {name}'),
  communityOpenInBrowser: 'Open in browser',
  communityOpenInDesktop: 'Open in desktop app',
  communityOpenNote: 'Files open read-only. Save a copy to edit one.',
  communityVersions: 'Versions',
  communityLatest: 'Latest',
  communityLatestDescription: 'The file as it is now.',
  communityNotFoundTitle: 'This file isn’t here anymore',
  communityNotFoundDescription: 'It may have been taken down. See what else is in the community.'
} as const
