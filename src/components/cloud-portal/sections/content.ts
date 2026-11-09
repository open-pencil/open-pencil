import type { CloudAdminDocument } from '@open-pencil/cloud/contract'

import { usePortal } from '@/app/cloud-portal/context'
import { usePortalAction } from '@/app/cloud-portal/state'
import { formatDate } from '@/app/i18n/date'

import type { PortalContentAction, PortalDocumentRow } from '../types'

/** A document from the server as the console's rows show it. */
export function documentRow(document: CloudAdminDocument, locale: string): PortalDocumentRow {
  return {
    id: document.id,
    name: document.name,
    workspace: document.workspace.name,
    owner: document.owner,
    updated: formatDate(document.updatedAt, 'date', locale),
    takenDown: document.disabledAt !== null,
    takenDownReason: document.disabledReason,
    openReports: document.openReports
  }
}

/**
 * Does what an administrator chose about a document, its link, its owner, or a report, keyed by
 * the row it was chosen on, and then has the list load again.
 */
export function useContentActions(reload: () => Promise<void> | undefined, changed: () => void) {
  const portal = usePortal()
  return usePortalAction(
    async (
      _row: string,
      action: PortalContentAction,
      target: {
        document: PortalDocumentRow
        reportId?: string
        shareId?: string
      },
      reason?: string
    ) => {
      if (action === 'take-down') {
        await portal.api.documentAction(target.document.id, 'disable', reason)
      } else if (action === 'restore') {
        await portal.api.documentAction(target.document.id, 'enable')
      } else if (action === 'revoke-link' && target.shareId) {
        await portal.api.revokeShare(target.shareId)
      } else if (action === 'suspend-owner' && target.document.owner) {
        await portal.api.userAction('ban', target.document.owner.id, reason)
      } else if (action === 'dismiss' && target.reportId) {
        await portal.api.resolveReport(target.reportId, 'dismiss')
      } else if (action === 'mark-handled' && target.reportId) {
        await portal.api.resolveReport(target.reportId, 'action')
      }
      changed()
      await reload()
    }
  )
}
