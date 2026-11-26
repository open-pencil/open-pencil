import { isCloudPortalPage } from '@open-pencil/cloud/contract'

/** Where a server answers on its own, besides a Cloud server's portal: its API, discovery, and OAuth callbacks. */
const SERVER_PATH_ROOTS = ['/api/', '/.well-known/', '/oauth/']

/**
 * Whether a page belongs to the server rather than the editor: a Cloud server's portal and
 * community pages (`isCloudPortalPage`, which its own routes follow), its API, and OAuth
 * callbacks. The service worker leaves these to the network and serves the editor everywhere
 * else, offline too.
 */
export function servedByServer(path: string): boolean {
  return isCloudPortalPage(path) || SERVER_PATH_ROOTS.some((root) => path.startsWith(root))
}
