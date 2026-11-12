import { ref } from 'vue'

import { IS_BROWSER, IS_CLOUD_SITE } from '@/constants'

import { checkCloudAvailability } from '../availability'
import { openCloudCommunityLink, readCloudCommunityLink } from '../community/link'
import { cloudSignedIn } from '../connect/flow'
import {
  forgetCloudDocumentLink,
  openCloudDocumentLink,
  readCloudDocumentLink,
  reopenCloudDocumentLink,
  resumeCloudDocumentLink
} from '../documents/link'
import { startCloudDrafts, type SaveToCloud } from '../drafts/save'
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
import { cloudConnection, cloudPortalClient, refreshCloudConnection } from './connection'
import { onCloudLocaleChange, tellCloudLocale } from './locale'
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
    readCloudCommunityLink(address) !== null ||
    readCloudLink(address)?.kind === 'share' ||
    leftForCloudSignIn()
  )
}

/** States in which a server has an account to write to. */
const WRITTEN_TO = new Set(['signed-in', 'pending', 'terms'])

/** Tells every server the app is signed in to the language the person picks. */
function followCloudLocale(): void {
  onCloudLocaleChange(() => {
    for (const server of cloudServers.value) {
      const { state, discovery } = cloudConnection(server.id)
      if (discovery && WRITTEN_TO.has(state)) {
        void tellCloudLocale(server.id, cloudPortalClient(server, discovery))
      }
    }
  })
}

/**
 * Adds the server that serves this editor, if one does, checks every known server once the app
 * starts, finishes a sign-in this tab left for the server's pages to do, and opens an invitation,
 * a shared link, a document link, or a community gallery document the tab was opened with, or
 * the desktop app was sent. A link's secret is taken out of the address at once.
 */
export async function startCloudSessions(options: {
  /** Leaves a Cloud link's address, so its secret is not kept in history. */
  leaveLinkAddress(): Promise<unknown>
  /** Save to, kept to one server, for a draft on its way to Cloud. */
  saveTo: SaveToCloud
}): Promise<void> {
  // Taken first, so a sign-in this tab leaves for below is the only one left pending.
  const pending = takePendingCloudSignIn()
  followCloudLocale()
  try {
    if (IS_CLOUD_SITE) await addCloudSiteServer()
    void checkCloudAvailability(globalThis.location.href)
    const address = new URL(globalThis.location.href)
    const link = readCloudLink(address)
    const documentLink = readCloudDocumentLink(address)
    const communityLink = readCloudCommunityLink(address)
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
    await startCloudDrafts({ returnedFrom: pending, saveTo: options.saveTo })
    // Later sign-ins, as in the connect dialog, open what they were for once they finish.
    resumeCloudDocumentLink()
    resumeCloudLink()
    if (link?.kind !== 'invitations') resumeCloudInvitation()
    if (link) await openCloudLink(link)
    if (documentLink) await openCloudDocumentLink(documentLink)
    if (communityLink) await openCloudCommunityLink(communityLink)
  } finally {
    // A link that needs a sign-in leaves for the server's page, so nothing shows before it goes.
    openingCloudLink.value = leftForCloudSignIn()
  }
  await bindDesktopCloudLinks()
}
