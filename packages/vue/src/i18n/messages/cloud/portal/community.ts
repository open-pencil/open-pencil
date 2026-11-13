import { params } from '@nanostores/i18n'

/** Messages of the `cloudPortal` namespace for the server's community gallery pages. */
export const communityPortalMessageDefaults = {
  communityTitle: 'Community',
  communityDescription: 'Files to open, explore, and copy into your own workspace.',
  communityEmpty: 'Nothing has been published here yet.',
  communityAllFiles: 'All files',
  communityOpenInBrowser: 'Open in browser',
  communityOpenInDesktop: 'Open in desktop app',
  communityOpenNote: 'Files open read-only. Save a copy to edit one.',
  communityLatestVersion: params('{name} · Latest'),
  communityMore: 'More from the community',
  siteTagline: 'The open-source design editor. Open your Figma files, own your work.',
  siteProduct: 'Product',
  siteResources: 'Resources',
  siteLegal: 'Legal',
  siteDocs: 'Docs',
  siteCloudDocs: 'Cloud docs',
  siteDownload: 'Download',
  siteLicense: 'Released under the MIT License.',
  communityNotFoundTitle: 'This file isn’t here anymore',
  communityNotFoundDescription: 'It may have been taken down. See what else is in the community.'
} as const
