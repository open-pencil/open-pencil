import * as v from 'valibot'

import { cloudDesktopLinkURL, type CloudLinkKind } from '@open-pencil/cloud/client'
import { cloudMessages, useViewportKind } from '@open-pencil/vue'

import { toast } from '@/app/shell/ui'
import { isTauri } from '@/app/tauri/env'
import { bindDesktopLinkQueue } from '@/app/tauri/link-queue'
import { IS_BROWSER } from '@/constants'

import { beginCloudInvitation } from './invitations/flow'
import { openCloudShareLink } from './sharing/link'

/**
 * An invitation, `/cloud/invitations/:id?server=…#token`, or a document shared by link,
 * `/cloud/share/:id?server=…#secret`. The desktop app gets the same link as
 * `openpencil://cloud/<kind>/<id>?server=…#secret`.
 */
export type CloudLink = { kind: CloudLinkKind; id: string; server: string; secret: string }

const CLOUD_LINK_PATH = /^\/cloud\/(invitations|share)\/([^/]+)$/

/** Desktop events and commands for `openpencil://cloud` links (`desktop/src/lib.rs`). */
const CLOUD_LINKS_EVENT = 'open-cloud-links'
const TAKE_PENDING_CLOUD_LINKS = 'take_pending_cloud_links'

const cloudLinkSchema = v.object({
  kind: v.picklist(['invitations', 'share']),
  id: v.string(),
  server: v.string(),
  secret: v.string()
})

/** The Cloud link a web address carries, if it is one. */
export function readCloudLink(url: URL): CloudLink | null {
  const [, kind, id] = url.pathname.match(CLOUD_LINK_PATH) ?? []
  const server = url.searchParams.get('server')
  const secret = url.hash.slice(1)
  if ((kind !== 'invitations' && kind !== 'share') || !id || !server || !secret) return null
  return { kind, id: decodeURIComponent(id), server, secret }
}

/** Hands a Cloud link to the desktop app; the browser asks before it opens the app. */
export function openCloudLinkInDesktop(link: CloudLink): void {
  globalThis.location.assign(cloudDesktopLinkURL(link.kind, link.id, link.server, link.secret))
}

/** The web editor offers the desktop app on computers; phones have none to offer. */
export function canOfferDesktopApp(): boolean {
  return IS_BROWSER && !isTauri() && !useViewportKind().isMobile.value
}

/** Opens an invitation's dialog, or a shared document as a guest. */
export async function openCloudLink(link: CloudLink): Promise<void> {
  if (link.kind === 'invitations') {
    beginCloudInvitation(link.id, link.server, link.secret)
    return
  }
  const messages = cloudMessages.get()
  try {
    await openCloudShareLink({ shareId: link.id, server: link.server, secret: link.secret })
  } catch {
    toast.error(messages.shareLinkFailed)
    return
  }
  if (canOfferDesktopApp()) {
    toast.info(messages.shareOpenedInBrowser, {
      label: messages.openInDesktopApp,
      run: () => openCloudLinkInDesktop(link)
    })
  }
}

/**
 * Opens the Cloud links the desktop app received, at startup and while running. The native side
 * validates each link before it gets here.
 */
export function bindDesktopCloudLinks(): Promise<() => void> {
  return bindDesktopLinkQueue({
    event: CLOUD_LINKS_EVENT,
    command: TAKE_PENDING_CLOUD_LINKS,
    schema: cloudLinkSchema,
    label: 'Cloud link',
    open: openCloudLink
  })
}
