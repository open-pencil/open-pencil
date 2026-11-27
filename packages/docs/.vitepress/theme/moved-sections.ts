/** The Developers overview's URL scheme section, now a page of its own in every locale. */
const URL_SCHEME = Object.fromEntries(
  ['', '/de', '/es', '/fr', '/it', '/pl', '/ru'].map((locale) => [
    `${locale}/developers/`,
    { 'url-scheme': `${locale}/developers/url-scheme` }
  ])
)

/**
 * Sections that moved to pages of their own when OpenPencil Cloud got its own section. The server
 * redirects the old pages (`public/_redirects`) and the browser keeps the `#section`, which the
 * new page doesn't have, so the first load sends it on to where that section lives now.
 */
const MOVED_SECTIONS: Record<string, Record<string, string>> = {
  ...URL_SCHEME,
  // Opening and saving became a page of their own.
  '/user-guide/exporting/': {
    'fig-file-operations': '/user-guide/files',
    'opening-files': '/user-guide/files#open-a-document',
    'saving-files': '/user-guide/files#save',
    'round-trip-compatibility': '/user-guide/files#save'
  },
  // Libraries became a page of their own, and behaviours a task on the Components page.
  '/user-guide/components/': {
    'component-libraries': '/user-guide/component-libraries',
    'publish-a-library': '/user-guide/component-libraries#publish-a-library',
    'enable-and-insert-library-assets': '/user-guide/component-libraries#use-a-library',
    'review-and-accept-updates': '/user-guide/component-libraries#update-to-a-new-version',
    'local-storage-and-offline-use': '/user-guide/component-libraries#where-libraries-live',
    'saving-consumer-documents': '/user-guide/component-libraries#where-libraries-live',
    'behaviours-and-preview': '/user-guide/components#make-a-component-work-like-a-control'
  },
  // Was /user-guide/openpencil-cloud.
  '/cloud/': {
    'connect-a-server': '/cloud/connect',
    'your-account': '/cloud/account',
    'find-documents-on-home': '/cloud/documents#find-documents-on-home',
    'restore-a-deleted-document': '/cloud/documents#restore-a-deleted-document',
    'save-a-document-to-cloud': '/cloud/documents#save-a-document-to-cloud',
    'where-a-document-stands': '/cloud/documents#where-a-document-stands',
    'when-a-document-changed-in-two-places':
      '/cloud/documents#when-a-document-changed-in-two-places',
    'version-history': '/cloud/documents#version-history',
    'document-links': '/cloud/documents#document-links',
    'work-in-a-team-workspace': '/cloud/sharing#work-in-a-team-workspace',
    'share-a-document': '/cloud/sharing#share-a-document',
    'open-an-invitation': '/cloud/sharing#open-an-invitation',
    'edit-together': '/cloud/sharing#edit-together',
    'ai-on-cloud': '/cloud/ai'
  },
  // Was /reference/self-hosting-cloud.
  '/cloud/self-hosting/': {
    'cloudflare-workers': '/cloud/self-hosting/cloudflare',
    services: '/cloud/self-hosting/ai-services',
    email: '/cloud/self-hosting/storage-and-email#email',
    storage: '/cloud/self-hosting/storage-and-email#storage',
    'operator-commands': '/cloud/self-hosting/operations#operator-commands',
    'error-tracking': '/cloud/self-hosting/operations#error-tracking',
    'backups-and-upgrades': '/cloud/self-hosting/operations#backups-and-upgrades',
    hardening: '/cloud/self-hosting/operations#hardening'
  }
}

/** Where a page's `#section` lives now, if it moved; null when it didn't. */
export function movedSection(pathname: string, hash: string): string | null {
  const page = MOVED_SECTIONS[pathname.endsWith('/') ? pathname : `${pathname}/`]
  return page?.[decodeURIComponent(hash.replace(/^#/, ''))] ?? null
}
