import type {
  CloudAdminAuditFilter,
  CloudAdminDocumentFilter,
  CloudAdminEmailFilter,
  CloudAdminReportFilter,
  CloudAdminUserFilter,
  CloudAdminUserMethod,
  EnrollmentStatus
} from '#cloud/contract'

import type { CloudContractCall, PortalRouteClients } from './request'

/** A page of an admin list: words to search for, one of its filters, and where the page starts. */
export type AdminListRequest<Filter extends string> = {
  search?: string
  filter?: Filter
  limit?: number
  offset?: number
}

/** A count as a query string carries it. */
function countParameter(count: number | undefined): string | undefined {
  return count === undefined ? undefined : String(count)
}

/** The query string for `request`; an empty search asks for everything. */
function listQuery<Filter extends string>(request: AdminListRequest<Filter>) {
  return {
    query: {
      search: request.search || undefined,
      filter: request.filter,
      limit: countParameter(request.limit),
      offset: countParameter(request.offset)
    }
  }
}

export function createAdministrationAPI(
  callContract: CloudContractCall,
  { origin, contract, adminContract: admin }: PortalRouteClients
) {
  return {
    session(signal?: AbortSignal) {
      return callContract((options) => contract.session.session(undefined, options), signal)
    },
    enrollments(request: AdminListRequest<EnrollmentStatus>, signal?: AbortSignal) {
      return callContract((options) => admin.enrollments(listQuery(request), options), signal)
    },
    reviewEnrollment(
      id: string,
      action: 'approve' | 'reject' | 'revoke',
      note?: string,
      signal?: AbortSignal
    ) {
      const review = {
        approve: admin.approveEnrollment,
        reject: admin.rejectEnrollment,
        revoke: admin.revokeEnrollment
      }[action]
      return callContract((options) => review({ params: { id }, body: { note } }, options), signal)
    },
    /** A page of people; `method` narrows any filter to those who sign in that way. */
    users(
      request: AdminListRequest<CloudAdminUserFilter> & { method?: CloudAdminUserMethod },
      signal?: AbortSignal
    ) {
      const { query } = listQuery(request)
      return callContract(
        (options) => admin.users({ query: { ...query, method: request.method } }, options),
        signal
      )
    },
    user(id: string, signal?: AbortSignal) {
      return callContract((options) => admin.user({ params: { id } }, options), signal)
    },
    userAction(
      action: 'ban' | 'unban' | 'revoke-sessions' | 'reset-two-step' | 'remove-picture' | 'delete',
      userId: string,
      reason?: string,
      signal?: AbortSignal
    ) {
      const act = {
        ban: admin.ban,
        unban: admin.unban,
        'revoke-sessions': admin.revokeSessions,
        'reset-two-step': admin.resetTwoStep,
        'remove-picture': admin.removePicture,
        delete: admin.deleteUser
      }[action]
      return callContract((options) => act({ body: { userId, reason } }, options), signal)
    },
    /** Removes one of an account's sign-in methods; the server keeps its last. */
    removeSignInMethod(userId: string, methodId: string, signal?: AbortSignal) {
      return callContract(
        (options) => admin.removeSignInMethod({ body: { userId, methodId } }, options),
        signal
      )
    },
    setAdmin(userId: string, enabled: boolean, signal?: AbortSignal) {
      return callContract(
        (options) => admin.setAdmin({ body: { userId, enabled } }, options),
        signal
      )
    },
    email(request: AdminListRequest<CloudAdminEmailFilter>, signal?: AbortSignal) {
      return callContract((options) => admin.email(listQuery(request), options), signal)
    },
    regenerateEmail(id: string, signal?: AbortSignal) {
      return callContract((options) => admin.regenerateEmail({ params: { id } }, options), signal)
    },
    audit(request: AdminListRequest<CloudAdminAuditFilter>, signal?: AbortSignal) {
      return callContract((options) => admin.audit(listQuery(request), options), signal)
    },
    reports(request: AdminListRequest<CloudAdminReportFilter>, signal?: AbortSignal) {
      return callContract((options) => admin.reports(listQuery(request), options), signal)
    },
    /** Closes a report: dismissed, or acted on outside a takedown. */
    resolveReport(id: string, action: 'dismiss' | 'action', signal?: AbortSignal) {
      const resolve = action === 'dismiss' ? admin.dismissReport : admin.actionReport
      return callContract((options) => resolve({ params: { id } }, options), signal)
    },
    documents(request: AdminListRequest<CloudAdminDocumentFilter>, signal?: AbortSignal) {
      return callContract((options) => admin.documents(listQuery(request), options), signal)
    },
    /**
     * Where a document's thumbnail at `revisionId` is: an image the console shows on the server's
     * own address, so the administrator's session goes with it.
     */
    documentThumbnailURL(documentId: string, revisionId: string): string {
      const path = `/api/admin/documents/${encodeURIComponent(documentId)}/thumbnails/${encodeURIComponent(revisionId)}`
      return new URL(path, origin).href
    },
    /** Links to a document's file and images as it is now; the server records the download. */
    downloadDocument(id: string, signal?: AbortSignal) {
      return callContract((options) => admin.downloadDocument({ params: { id } }, options), signal)
    },
    /** Takes a document down, or puts it back. */
    documentAction(
      id: string,
      action: 'disable' | 'enable' | 'undelete',
      reason?: string,
      signal?: AbortSignal
    ) {
      return callContract((options) => {
        if (action === 'disable') {
          return admin.disableDocument({ params: { id }, body: { reason } }, options)
        }
        const act = action === 'enable' ? admin.enableDocument : admin.undeleteDocument
        return act({ params: { id } }, options)
      }, signal)
    },
    revokeShare(id: string, signal?: AbortSignal) {
      return callContract((options) => admin.revokeShare({ params: { id } }, options), signal)
    },
    operations(signal?: AbortSignal) {
      return callContract((options) => admin.operations(undefined, options), signal)
    }
  }
}
