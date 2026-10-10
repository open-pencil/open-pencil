import { cloudSignedIn } from '../connect/flow'
import { cloudServers, findCloudServer } from '../servers/store'
import { refreshCloudConnection } from './connection'
import { takePendingCloudSignIn } from './sign-in'

/**
 * Checks every known server once the app starts, and finishes a sign-in this tab left for the
 * server's pages to do.
 */
export async function startCloudSessions(): Promise<void> {
  const pending = takePendingCloudSignIn()
  await Promise.all(cloudServers.value.map((server) => refreshCloudConnection(server)))
  const server = pending ? findCloudServer(pending) : null
  if (server) cloudSignedIn.value = { serverId: server.id }
}
