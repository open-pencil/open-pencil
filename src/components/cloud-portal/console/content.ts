import type { useCloudPortalMessages } from '@open-pencil/vue/i18n'

import type { PortalContentAction, PortalDocumentRow, PortalReportRow } from '../types'

type Messages = ReturnType<typeof useCloudPortalMessages>['value']

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

type Status = { label: string; tone: 'neutral' | 'warning' | 'error' }

/**
 * Where a document stands: deleted forever, taken down, or reported, and, unless deleted, who
 * beyond its workspace can open it, in the community gallery or through its links, or nobody.
 */
export function documentStatuses(messages: Messages, document: PortalDocumentRow): Status[] {
  const problems: Status[] = [
    ...(document.deletedForever
      ? [{ label: messages.deletedForever, tone: 'error' as const }]
      : []),
    ...(document.takenDown ? [{ label: messages.takenDown, tone: 'error' as const }] : []),
    ...(document.openReports
      ? [{ label: messages.openReports(document.openReports), tone: 'warning' as const }]
      : [])
  ]
  // Nobody can open a document deleted forever, so who could does not matter any more.
  if (document.deletedForever) return problems
  const { community, links, editLinks } = document.exposure
  const linkLabel = editLinks ? messages.editableByLink : messages.sharedByLink
  const reach: Status[] = [
    ...(community ? [{ label: messages.inCommunity, tone: 'neutral' as const }] : []),
    ...(links ? [{ label: linkLabel, tone: 'neutral' as const }] : [])
  ]
  return [
    ...problems,
    ...(reach.length ? reach : [{ label: messages.privateDocument, tone: 'neutral' as const }])
  ]
}
