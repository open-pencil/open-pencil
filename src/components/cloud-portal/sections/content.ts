import { downloadCloudDocument } from '@open-pencil/cloud/client'
import type { CloudAdminDocument } from '@open-pencil/cloud/contract'

import { documentFileName } from '@/app/cloud-portal/archive'
import { usePortal } from '@/app/cloud-portal/context'
import { usePortalAction } from '@/app/cloud-portal/state'
import { downloadBlob } from '@/app/document/io/browser'
import { formatDate } from '@/app/i18n/date'

import type { PortalContentAction, PortalDocumentRow } from '../types'

/**
 * A document from the server as the console's rows show it; `thumbnailURL` names where its saved
 * thumbnail is.
 */
export function documentRow(
  document: CloudAdminDocument,
  locale: string,
  thumbnailURL: (documentId: string, revisionId: string) => string
): PortalDocumentRow {
  return {
    id: document.id,
    name: document.name,
    kind: document.kind,
    saved: document.revisionId !== null,
    workspace: document.workspace.name,
    owner: document.owner,
    updatedAt: document.updatedAt,
    thumbnail: document.revisionId ? thumbnailURL(document.id, document.revisionId) : null,
    exposure: document.exposure,
    takenDown: document.disabledAt !== null,
    takenDownReason: document.disabledReason,
    openReports: document.openReports,
    deletedForever: document.purgedAt !== null,
    destroyed: document.destroyedAt ? formatDate(document.destroyedAt, 'date', locale) : null
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
      if (action === 'download') {
        const download = await portal.api.downloadDocument(target.document.id)
        const bytes = await downloadCloudDocument(download, globalThis.fetch.bind(globalThis))
        downloadBlob(
          bytes,
          documentFileName(target.document.name, target.document.kind),
          'application/octet-stream'
        )
        // Nothing on the server changed, so the list stays as it is.
        return
      }
      if (action === 'take-down') {
        await portal.api.documentAction(target.document.id, 'disable', reason)
      } else if (action === 'restore') {
        await portal.api.documentAction(target.document.id, 'enable')
      } else if (action === 'undelete') {
        await portal.api.documentAction(target.document.id, 'undelete')
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
