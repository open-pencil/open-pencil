/**
 * The pages a Cloud server shows on its own address, apart from the editor: the welcome page for
 * visitors who are not signed in, sign-in and desktop sign-in approval, account settings, and the
 * administration console. Every runtime serves the portal's `cloud.html` at and below these
 * paths, and the editor's `index.html` at the root and at any other page the API does not answer.
 */
export const CLOUD_PORTAL_PAGE_ROOTS = ['/welcome', '/auth', '/account', '/admin'] as const

/**
 * The community gallery's pages, which the portal serves too: the gallery at `/community` and a
 * document's page at `/community/:id`. The editor opens a document at `/community/:id/open`.
 */
export const CLOUD_PORTAL_COMMUNITY_PAGES = ['/community', '/community/:documentId'] as const

const COMMUNITY_PAGE = /^\/community(?:\/[^/]+)?\/?$/

export function isCloudPortalPage(path: string): boolean {
  return (
    COMMUNITY_PAGE.test(path) ||
    CLOUD_PORTAL_PAGE_ROOTS.some((root) => path === root || path.startsWith(`${root}/`))
  )
}
