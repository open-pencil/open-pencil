import { count, params } from '@nanostores/i18n'

/** Messages of the `cloudPortal` namespace for the server's community gallery pages. */
export const communityPortalMessageDefaults = {
  communityTitle: 'Community',
  communityDescription: 'Files to open, explore, and copy into your own workspace.',
  communityFileCount: count({ one: '{count} file', many: '{count} files' }),
  communityEmpty: 'Nothing has been published here yet.',
  communityAllFiles: 'All files',
  communityFilterAll: 'All',
  communityKindDesign: 'Design file',
  communityKindDesigns: 'Design files',
  communityKindBoard: 'Board',
  communityKindBoards: 'Boards',
  communitySearch: 'Search files',
  communityNoMatches: params('No files match “{query}”.'),
  communityUpdated: params('Updated {date}'),
  communityPreview: params('Preview of {name}'),
  communityOpenInBrowser: 'Open in browser',
  communityOpenInDesktop: 'Open in desktop app',
  communityOpenNote: 'Files open read-only. Save a copy to edit one.',
  communityCopyLink: 'Copy link',
  communityLinkCopied: 'Link copied',
  communityDetailType: 'Type',
  communityDetailUpdated: 'Last updated',
  communityVersions: 'Versions',
  communityLatest: 'Latest',
  communityLatestDescription: 'The file as it is now.',
  communityMore: 'More from the community',
  communityNotFoundTitle: 'This file isn’t here anymore',
  communityNotFoundDescription: 'It may have been taken down. See what else is in the community.'
} as const
