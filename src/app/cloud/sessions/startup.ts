import { cloudSignedIn } from '../connect/flow'
import { beginCloudInvitation, resumeCloudInvitation } from '../invitations/flow'
import { cloudServers, findCloudServer } from '../servers/store'
import { refreshCloudConnection } from './connection'
import { takePendingCloudSignIn } from './sign-in'

const INVITATION_PATH = /^\/cloud\/invitations\/([^/]+)$/

/** An invitation link this tab was opened with: `/cloud/invitations/:id?server=…#token`. */
function readInvitationLink(): { id: string; server: string; token: string } | null {
  const url = new URL(globalThis.location.href)
  const id = url.pathname.match(INVITATION_PATH)?.[1]
  const server = url.searchParams.get('server')
  const token = url.hash.slice(1)
  if (!id || !server || !token) return null
  return { id: decodeURIComponent(id), server, token }
}

/**
 * Checks every known server once the app starts, finishes a sign-in this tab left for the
 * server's pages to do, and opens an invitation the tab was opened with or was working on. The
 * invitation's token is taken out of the address at once.
 */
export async function startCloudSessions(options: {
  /** Leaves the invitation's address, so its token is not kept in history. */
  leaveInvitationAddress(): Promise<unknown>
}): Promise<void> {
  const invitation = readInvitationLink()
  if (invitation) await options.leaveInvitationAddress()
  const pending = takePendingCloudSignIn()
  await Promise.all(cloudServers.value.map((server) => refreshCloudConnection(server)))
  const server = pending ? findCloudServer(pending) : null
  if (server) cloudSignedIn.value = { serverId: server.id }
  if (invitation) beginCloudInvitation(invitation.id, invitation.server, invitation.token)
  else resumeCloudInvitation()
}
