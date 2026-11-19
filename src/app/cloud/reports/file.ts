import { shallowRef } from 'vue'

import { CloudAPIError } from '@open-pencil/cloud/client'
import type { DocumentReportReason } from '@open-pencil/cloud/contract'

import type { EditorStore } from '@/app/editor/session'

import { cloudServerHost } from '../servers/address'
import { cloudConnection } from '../sessions/connection'
import { cloudGuestId, shareLinkClient, type CloudShareLink } from '../sharing/link'
import { cloudShareLinkTabs } from './tabs'

/** The report being written: which link's document, and where it goes. */
export type CloudReportDraft = {
  link: CloudShareLink
  documentName: string
  host: string
  /** The reporter's email when they are signed in to the link's server, to offer for a reply. */
  email: string | null
}

/** The Report dialog's report, while it shows. */
export const cloudReport = shallowRef<CloudReportDraft | null>(null)

/** Whether the tab came from a share link, so its viewer may report it. */
export function canReport(store: EditorStore): boolean {
  return cloudShareLinkTabs.value.has(store)
}

/** Opens the Report dialog for the tab's document, when it came from a share link. */
export async function startCloudReport(store: EditorStore): Promise<void> {
  const link = cloudShareLinkTabs.value.get(store)
  if (!link) return
  const { serverId } = await shareLinkClient(link).catch(() => ({ serverId: null }))
  const account = serverId ? cloudConnection(serverId).account : null
  cloudReport.value = {
    link,
    documentName: store.state.documentName,
    host: cloudServerHost(link.server),
    email: account?.email ?? null
  }
}

export type CloudReportInput = {
  reason: DocumentReportReason
  description: string
  replyEmail?: string
}

/** Sends a report to the link's server: `sent`, `too-many` past the day's budget, or `failed`. */
export async function sendCloudReport(
  link: CloudShareLink,
  input: CloudReportInput
): Promise<'sent' | 'too-many' | 'failed'> {
  try {
    const { client } = await shareLinkClient(link)
    await client.fileDocumentReport(link.shareId, {
      secret: link.secret,
      guestId: cloudGuestId(),
      reason: input.reason,
      description: input.description,
      replyEmail: input.replyEmail || undefined
    })
    return 'sent'
  } catch (error) {
    if (error instanceof CloudAPIError && error.status === 429) return 'too-many'
    return 'failed'
  }
}
