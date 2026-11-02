import { ref } from 'vue'

import { IS_BROWSER, IS_CLOUD_SITE } from '@/constants'

import { checkCloudAvailability } from '../availability'
import { cloudSignedIn } from '../connect/flow'
import {
  forgetCloudDocumentLink,
  openCloudDocumentLink,
  readCloudDocumentLink,
  reopenCloudDocumentLink,
  resumeCloudDocumentLink
} from '../documents/link'
import { resumeCloudInvitation } from '../invitations/flow'
import {
  bindDesktopCloudLinks,
  forgetCloudLink,
  openCloudLink,
  readCloudLink,
  reopenCloudLink,
  resumeCloudLink
} from '../links'
import { addCloudSiteServer, cloudServers, findCloudServer } from '../servers/store'
import { cloudConnection, refreshCloudConnection } from './connection'
import { leftForCloudSignIn, takePendingCloudSignIn } from './sign-in'

/**
 * Whether the tab is still opening what it started with: a document or shared file its address
 * links to, or whatever a sign-in it comes back from was for. The window shows only that it is
 * opening until the document shows or nothing is left to open, so no empty editor or Home comes
 * first.
 */
export const openingCloudLink = ref(IS_BROWSER && opensWithCloudDocument())

function opensWithCloudDocument(): boolean {
  const address = new URL(globalThis.location.href)
  return (
    readCloudDocumentLink(address) !== null ||
    readCloudLink(address)?.kind === 'share' ||
    leftForCloudSignIn()
  )
}

/**
 * Adds the server that serves this editor, if one does, checks every known server once the app
 * starts, finishes a sign-in this tab left for the server's pages to do, and opens an invitation,
 * a shared link, or a document link the tab was opened with, or the desktop app was sent. A
 * link's secret is taken out of the address at once.
 */
export async function startCloudSessions(options: {
  /** Leaves a Cloud link's address, so its secret is not kept in history. */
  leaveLinkAddress(): Promise<unknown>
}): Promise<void> {
  // Taken first, so a sign-in this tab leaves for below is the only one left pending.
  const pending = takePendingCloudSignIn()
  try {
    if (IS_CLOUD_SITE) await addCloudSiteServer()
    void checkCloudAvailability(globalThis.location.href)
    const address = new URL(globalThis.location.href)
    const link = readCloudLink(address)
    const documentLink = readCloudDocumentLink(address)
    // The link the tab opens with is the one to open, not one kept from an earlier sign-in.
    if (documentLink || link) {
      forgetCloudDocumentLink()
      forgetCloudLink()
    }
    if (link) await options.leaveLinkAddress()
    await Promise.all(cloudServers.value.map((server) => refreshCloudConnection(server)))
    const server = pending ? findCloudServer(pending) : null
    if (server) cloudSignedIn.value = { serverId: server.id }
    if (server && cloudConnection(server.id).state === 'signed-in') {
      // What the sign-in was for opens before the window shows anything.
      await Promise.all([reopenCloudDocumentLink(server.id), reopenCloudLink(server.id)])
    } else if (server) {
      // Back from the sign-in page without signing in: what it was for is not asked for again.
      forgetCloudDocumentLink()
      forgetCloudLink()
    }
    // Later sign-ins, as in the connect dialog, open what they were for once they finish.
    resumeCloudDocumentLink()
    resumeCloudLink()
    if (link?.kind !== 'invitations') resumeCloudInvitation()
    if (link) await openCloudLink(link)
    if (documentLink) await openCloudDocumentLink(documentLink)
  } finally {
    // A link that needs a sign-in leaves for the server's page, so nothing shows before it goes.
    openingCloudLink.value = leftForCloudSignIn()
  }
  await bindDesktopCloudLinks()
}
