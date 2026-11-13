import { useSessionStorage } from '@vueuse/core'
import * as v from 'valibot'
import { ref, watch } from 'vue'

import {
  cloudDesktopLinkURL,
  parseCloudLinkPath,
  type CloudLinkKind
} from '@open-pencil/cloud/contract'
import { useViewportKind } from '@open-pencil/vue/editor/viewport-kind'
import { cloudMessages } from '@open-pencil/vue/i18n'

import type { EditorStore } from '@/app/editor/session'
import { toast } from '@/app/shell/ui'
import { isTauri } from '@/app/tauri/env'
import { bindDesktopLinkQueue } from '@/app/tauri/link-queue'
import { IS_BROWSER } from '@/constants'

import { openCloudCommunityLink } from './community/link'
import { cloudSignedIn, signInToOpen } from './connect/flow'
import { beginCloudInvitation } from './invitations/flow'
import { cloudServerHost, normalizeCloudServerURL } from './servers/address'
import { cloudServerForLink, findCloudServer } from './servers/store'
import { cloudGuestLinkTabs, openCloudShareLink } from './sharing/link'

/**
 * An invitation, `/invitations/:id#token`, or a document shared by link, `/share/:id#secret`, on
 * the server they belong to. The desktop app gets the same link as
 * `openpencil://cloud?url=<link>#secret`.
 */
export type CloudLink = { kind: CloudLinkKind; id: string; server: string; secret: string }

/** Desktop events and commands for `openpencil://cloud` links (`desktop/src/launch/mod.rs`). */
const CLOUD_LINKS_EVENT = 'open-cloud-links'
const TAKE_PENDING_CLOUD_LINKS = 'take_pending_cloud_links'

const cloudLinkSchema = v.object({
  kind: v.picklist(['invitations', 'share']),
  id: v.string(),
  server: v.string(),
  secret: v.string()
})

/**
 * A link the desktop app received: an invitation or shared document with its secret, or a
 * community gallery document with the named version it asks for, if any.
 */
const desktopCloudLinkSchema = v.variant('kind', [
  cloudLinkSchema,
  v.object({
    kind: v.literal('community'),
    id: v.string(),
    server: v.string(),
    version: v.nullable(v.string())
  })
])

function openDesktopCloudLink(link: v.InferOutput<typeof desktopCloudLinkSchema>): Promise<void> {
  if (link.kind === 'community') {
    return openCloudCommunityLink({
      documentId: link.id,
      server: link.server,
      versionId: link.version
    })
  }
  return openCloudLink(link)
}

/** The Cloud link a web address carries, if it is one; its server is the address's own. */
export function readCloudLink(url: URL): CloudLink | null {
  const path = parseCloudLinkPath(url.pathname)
  const secret = url.hash.slice(1)
  if (!path || path.kind === 'documents' || path.kind === 'community' || !secret) return null
  return { kind: path.kind, id: path.id, server: url.origin, secret }
}

/** Hands a Cloud link to the desktop app; the browser asks before it opens the app. */
export function openCloudLinkInDesktop(link: CloudLink): void {
  globalThis.location.assign(cloudDesktopLinkURL(link.kind, link.id, link.server, link.secret))
}

/** The web editor offers the desktop app on computers; phones have none to offer. */
export function canOfferDesktopApp(): boolean {
  return IS_BROWSER && !isTauri() && !useViewportKind().isMobile.value
}

/**
 * A shared link this tab is opening while it signs in, kept for the tab so it survives leaving for
 * the server's sign-in pages, as an invitation is.
 */
const signingIn = IS_BROWSER
  ? useSessionStorage<string | null>('open-pencil:cloud-share-link', null)
  : ref<string | null>(null)

/** Drops a shared link kept while signing in, as when the tab opens with another link. */
export function forgetCloudLink(): void {
  signingIn.value = null
}

/** Signs in to the server a link names, then opens the link again; see `resumeCloudLink`. */
async function signInForLink(link: CloudLink): Promise<void> {
  const url = normalizeCloudServerURL(link.server)
  const server = url ? await cloudServerForLink(url) : null
  if (!url || !server) {
    const host = url ? cloudServerHost(url) : link.server
    toast.error(cloudMessages.get().documentLinkUnknownServer({ host }))
    return
  }
  signingIn.value = JSON.stringify(link satisfies CloudLink)
  await signInToOpen(server.id)
}

/**
 * Signs in to the server of a link a guest is viewing, then opens the link again with the
 * account, whose tab replaces the guest's.
 */
export async function signInToEditCloudShare(store: EditorStore): Promise<void> {
  const tab = cloudGuestLinkTabs.value.get(store)
  if (!tab) return
  const { shareId, server, secret } = tab.link
  await signInForLink({ kind: 'share', id: shareId, server, secret })
}

/** Opens an invitation's dialog, or a shared document. */
export async function openCloudLink(link: CloudLink): Promise<void> {
  if (link.kind === 'invitations') {
    beginCloudInvitation(link.id, link.server, link.secret)
    return
  }
  const messages = cloudMessages.get()
  signingIn.value = null
  let outcome: 'opened' | 'sign-in'
  try {
    outcome = await openCloudShareLink({
      shareId: link.id,
      server: link.server,
      secret: link.secret
    })
  } catch {
    toast.error(messages.shareLinkFailed)
    return
  }
  if (outcome === 'sign-in') {
    await signInForLink(link)
    return
  }
  if (canOfferDesktopApp()) {
    toast.info(messages.shareOpenedInBrowser, {
      label: messages.openInDesktopApp,
      run: () => openCloudLinkInDesktop(link)
    })
  }
}

/** Opens the shared link kept while signing in to `serverId`, if one was. */
export async function reopenCloudLink(serverId: string): Promise<void> {
  const parsed = v.safeParse(
    v.pipe(v.string(), v.parseJson(), cloudLinkSchema),
    signingIn.value ?? ''
  )
  if (!parsed.success) return
  const url = normalizeCloudServerURL(parsed.output.server)
  if (url !== findCloudServer(serverId)?.url) return
  await openCloudLink(parsed.output)
}

/** Opens a shared link again once signing in for it finished. */
export function resumeCloudLink(): () => void {
  return watch(cloudSignedIn, (signedIn) => {
    if (signedIn) void reopenCloudLink(signedIn.serverId)
  })
}

/**
 * Opens the Cloud links the desktop app received, at startup and while running. The native side
 * validates each link before it gets here.
 */
export function bindDesktopCloudLinks(): Promise<() => void> {
  return bindDesktopLinkQueue({
    event: CLOUD_LINKS_EVENT,
    command: TAKE_PENDING_CLOUD_LINKS,
    schema: desktopCloudLinkSchema,
    label: 'Cloud link',
    open: openDesktopCloudLink
  })
}
