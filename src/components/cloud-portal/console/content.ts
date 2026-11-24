import type { MessagesOf } from '@open-pencil/vue/i18n'

import type { PortalContentAction, PortalDocumentRow, PortalReportRow } from '../types'

type Messages = MessagesOf<'cloud/portal'>

/** The actions a document's row menu offers; a report adds its link and its own decision. */
export function contentActions(
  messages: Messages,
  document: PortalDocumentRow,
  report?: Pick<PortalReportRow, 'status' | 'share'>
): { action: PortalContentAction; label: string; separated?: boolean }[] {
  const items: { action: PortalContentAction; label: string; separated?: boolean }[] = []
  // Out of everyone's sight, one deleted forever can only come back.
  if (document.deletedForever) return [{ action: 'undelete', label: messages.undeleteDocument }]
  // Looking at what is in it comes before deciding.
  if (document.saved) items.push({ action: 'download', label: messages.downloadDocument })
  if (report?.status === 'open') {
    items.push({ action: 'dismiss', label: messages.dismissReport, separated: items.length > 0 })
    items.push({ action: 'mark-handled', label: messages.markHandled })
  }
  const separated = items.length > 0
  items.push(
    document.takenDown
      ? { action: 'restore', label: messages.restoreDocument, separated }
      : { action: 'take-down', label: messages.takeDown, separated }
  )
  if (report?.share && !report.share.revoked) {
    items.push({ action: 'revoke-link', label: messages.revokeLink })
  }
  if (document.owner) items.push({ action: 'suspend-owner', label: messages.suspendOwner })
  return items
}

/** Whether an action is asked once more before it is done. */
export function needsConfirmation(action: PortalContentAction): boolean {
  return action !== 'download' && action !== 'dismiss' && action !== 'mark-handled'
}

/** What the confirmation for an action says, and whether it takes a reason. */
export function contentConfirmation(
  messages: Messages,
  action: PortalContentAction,
  document: PortalDocumentRow
): {
  heading: string
  description: string
  confirm: string
  reason: boolean
  /** Bringing something back is no danger; taking it away is. */
  tone: 'danger' | 'primary'
} {
  if (action === 'take-down') {
    return {
      heading: messages.takeDownHeading({ name: document.name }),
      description: messages.takeDownDescription,
      confirm: messages.takeDown,
      reason: true,
      tone: 'danger'
    }
  }
  if (action === 'restore') {
    return {
      heading: messages.restoreDocumentHeading({ name: document.name }),
      description: messages.restoreDocumentDescription,
      confirm: messages.restoreDocument,
      reason: false,
      tone: 'primary'
    }
  }
  if (action === 'undelete') {
    return {
      heading: messages.undeleteHeading({ name: document.name }),
      description: messages.undeleteDescription,
      confirm: messages.undeleteDocument,
      reason: false,
      tone: 'primary'
    }
  }
  if (action === 'revoke-link') {
    return {
      heading: messages.revokeLinkHeading({ name: document.name }),
      description: messages.revokeLinkDescription,
      confirm: messages.revokeLink,
      reason: false,
      tone: 'danger'
    }
  }
  return {
    heading: messages.suspendHeading({ name: document.owner?.name ?? '' }),
    description: messages.suspendDescription,
    confirm: messages.suspendAccount,
    reason: true,
    tone: 'danger'
  }
}

type Problem = { label: string; tone: 'warning' | 'error' }

/**
 * The most serious thing an administrator should know about a document, or null when nothing is
 * wrong: deleted forever, then taken down, then reported.
 */
export function documentProblem(messages: Messages, document: PortalDocumentRow): Problem | null {
  if (document.deletedForever) return { label: messages.deletedForever, tone: 'error' }
  if (document.takenDown) return { label: messages.takenDown, tone: 'error' }
  if (document.openReports) {
    return { label: messages.openReports(document.openReports), tone: 'warning' }
  }
  return null
}

/** How far a document reaches, from the widest: anyone, through links, or its workspace alone. */
export type DocumentAccess = 'community' | 'edit-link' | 'link' | 'private'

/** The widest way beyond its workspace someone can open a document. */
export function documentAccess(document: PortalDocumentRow): DocumentAccess {
  const { community, links, editLinks } = document.exposure
  if (community) return 'community'
  if (editLinks) return 'edit-link'
  return links ? 'link' : 'private'
}
