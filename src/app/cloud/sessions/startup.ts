import { toast } from '@/app/shell/ui'

import { cloudSignedIn } from '../connect/flow'
import { beginCloudInvitation, resumeCloudInvitation } from '../invitations/flow'
import { cloudServers, findCloudServer } from '../servers/store'
import { openCloudShareLink } from '../sharing/link'
import { refreshCloudConnection } from './connection'
import { takePendingCloudSignIn } from './sign-in'

const CLOUD_LINK_PATH = /^\/cloud\/(invitations|share)\/([^/]+)$/

/**
 * A Cloud link this tab was opened with: an invitation, `/cloud/invitations/:id?server=…#token`,
 * or a document shared by link, `/cloud/share/:id?server=…#secret`.
 */
function readCloudLink() {
  const url = new URL(globalThis.location.href)
  const [, kind, id] = url.pathname.match(CLOUD_LINK_PATH) ?? []
  const server = url.searchParams.get('server')
  const secret = url.hash.slice(1)
  if (!kind || !id || !server || !secret) return null
  return { kind, id: decodeURIComponent(id), server, secret }
}

/**
 * Checks every known server once the app starts, finishes a sign-in this tab left for the
 * server's pages to do, and opens an invitation or a shared link the tab was opened with. The
 * link's secret is taken out of the address at once.
 */
export async function startCloudSessions(options: {
  /** Leaves a Cloud link's address, so its secret is not kept in history. */
  leaveLinkAddress(): Promise<unknown>
}): Promise<void> {
  const link = readCloudLink()
  if (link) await options.leaveLinkAddress()
  const pending = takePendingCloudSignIn()
  await Promise.all(cloudServers.value.map((server) => refreshCloudConnection(server)))
  const server = pending ? findCloudServer(pending) : null
  if (server) cloudSignedIn.value = { serverId: server.id }
  if (link?.kind === 'invitations') beginCloudInvitation(link.id, link.server, link.secret)
  else resumeCloudInvitation()
  if (link?.kind === 'share') {
    await openCloudShareLink({ shareId: link.id, server: link.server, secret: link.secret }).catch(
      () => toast.error('This link doesn’t open a document. Ask for a new one.')
    )
  }
}
