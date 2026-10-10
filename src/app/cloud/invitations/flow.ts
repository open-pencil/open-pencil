import { useSessionStorage } from '@vueuse/core'
import * as v from 'valibot'
import { computed, ref, shallowRef } from 'vue'

import { CloudAPIError, cloudDesktopLinkURL, createCloudAPIClient } from '@open-pencil/cloud/client'
import type { InvitationPreview } from '@open-pencil/cloud/contract'

import { openStorageDocumentInNewTab } from '@/app/tabs'
import { IS_BROWSER, OFFICIAL_CLOUD_URL } from '@/constants'

import { openCloudConnect } from '../connect/flow'
import { cloudServerHost, normalizeCloudServerURL } from '../servers/address'
import { addCloudServer, cloudServers } from '../servers/store'
import {
  cloudAPIClient,
  cloudConnection,
  cloudFetch,
  discoverCloudServer,
  refreshCloudConnection
} from '../sessions/connection'
import { CLOUD_STORAGE_PROVIDER_ID } from '../sessions/token'

export type CloudInvitationState =
  | 'loading'
  | 'ready'
  | 'accepting'
  | 'sign-in'
  | 'wrong-account'
  | 'unavailable'

const pendingSchema = v.object({ id: v.string(), server: v.string(), token: v.string() })
type PendingInvitation = v.InferOutput<typeof pendingSchema>

/**
 * The invitation this tab is opening, kept for the tab so it survives leaving for the server's
 * sign-in pages, and cleared once accepted or dismissed.
 */
const stored = IS_BROWSER
  ? useSessionStorage<string | null>('open-pencil:cloud-invitation', null)
  : ref<string | null>(null)
const pending = computed<PendingInvitation | null>(() => {
  const parsed = v.safeParse(v.pipe(v.string(), v.parseJson(), pendingSchema), stored.value ?? '')
  return parsed.success ? parsed.output : null
})

export const cloudInvitationOpen = ref(false)
export const cloudInvitationState = ref<CloudInvitationState>('loading')
export const cloudInvitationPreview = shallowRef<InvitationPreview | null>(null)

const knownServer = () => {
  const url = pending.value ? normalizeCloudServerURL(pending.value.server) : null
  return url ? (cloudServers.value.find((server) => server.url === url) ?? null) : null
}

/** What the dialog shows: the document, who invited, and where. */
export const cloudInvitation = computed(() => {
  const preview = cloudInvitationPreview.value
  const invitation = pending.value
  if (!preview || !invitation) return null
  const url = normalizeCloudServerURL(invitation.server) ?? invitation.server
  return {
    ...preview,
    host: cloudServerHost(url),
    unknownServer: !knownServer() && url !== OFFICIAL_CLOUD_URL
  }
})

export const cloudInvitationAccount = computed(() => {
  const server = knownServer()
  return server ? cloudConnection(server.id).account : null
})

function signedInServer() {
  const server = knownServer()
  return server && cloudConnection(server.id).state === 'signed-in' ? server : null
}

/** Re-reads the invitation and where this app stands with its server. */
export async function checkCloudInvitation(): Promise<void> {
  const invitation = pending.value
  if (!invitation) return
  const url = normalizeCloudServerURL(invitation.server)
  if (!url) {
    cloudInvitationState.value = 'unavailable'
    return
  }
  cloudInvitationState.value = 'loading'
  try {
    const discovery = await discoverCloudServer(url)
    const client = createCloudAPIClient(discovery.apiURL, { fetch: cloudFetch })
    cloudInvitationPreview.value = await client.previewDocumentInvitation(invitation.id, {
      token: invitation.token
    })
  } catch {
    cloudInvitationState.value = 'unavailable'
    return
  }
  const server = knownServer()
  if (server) await refreshCloudConnection(server)
  cloudInvitationState.value = signedInServer() ? 'ready' : 'sign-in'
}

/** Opens an invitation link: `/cloud/invitations/:id?server=…#token`. */
export function beginCloudInvitation(id: string, server: string, token: string): void {
  stored.value = JSON.stringify({ id, server, token } satisfies PendingInvitation)
  cloudInvitationOpen.value = true
  void checkCloudInvitation()
}

/** Picks an invitation back up after the tab came back from signing in. */
export function resumeCloudInvitation(): void {
  if (!pending.value) return
  cloudInvitationOpen.value = true
  void checkCloudInvitation()
}

/** Hands the invitation to the desktop app; the dialog stays in case the app isn't installed. */
export function openCloudInvitationInDesktop(): void {
  const invitation = pending.value
  if (!invitation) return
  globalThis.location.assign(
    cloudDesktopLinkURL('invitations', invitation.id, invitation.server, invitation.token)
  )
}

export function dismissCloudInvitation(): void {
  stored.value = null
  cloudInvitationOpen.value = false
}

/** Signs in to the invitation's server, remembering it first. */
export async function signInForCloudInvitation(): Promise<void> {
  const url = pending.value ? normalizeCloudServerURL(pending.value.server) : null
  if (!url) return
  const server = await addCloudServer({
    kind: url === OFFICIAL_CLOUD_URL ? 'official' : 'self-hosted',
    url
  })
  openCloudConnect({ serverId: server.id })
}

/**
 * Accepts the invitation and opens the document. The server refuses another account's
 * invitation the same way as a used one; right after a valid preview, that means the account.
 */
export async function acceptCloudInvitation(): Promise<void> {
  const invitation = pending.value
  const server = signedInServer()
  const discovery = server ? cloudConnection(server.id).discovery : null
  if (!invitation || !server || !discovery) return
  cloudInvitationState.value = 'accepting'
  const client = cloudAPIClient(server, discovery)
  let documentId: string
  try {
    documentId = (await client.acceptDocumentInvitation(invitation.id, { token: invitation.token }))
      .documentId
  } catch (error) {
    cloudInvitationState.value =
      error instanceof CloudAPIError && error.status === 404 ? 'wrong-account' : 'unavailable'
    return
  }
  dismissCloudInvitation()
  const { document } = await client.getDocument(documentId)
  await openStorageDocumentInNewTab(
    {
      id: document.id,
      name: document.name,
      updatedAt: document.updatedAt,
      revision: document.currentRevisionId
    },
    {
      providerId: CLOUD_STORAGE_PROVIDER_ID,
      profileId: server.id,
      containerId: document.workspaceId
    }
  )
}

/** Signs in with another account for the invitation. */
export function switchCloudInvitationAccount(): void {
  const server = knownServer()
  if (server) openCloudConnect({ serverId: server.id })
}
