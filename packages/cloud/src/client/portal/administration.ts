import {
  adminAuditResponseSchema,
  adminEmailResponseSchema,
  adminMutationResponseSchema,
  adminOperationsResponseSchema,
  cloudAdminSessionResponseSchema,
  cloudAdminUserDetailSchema,
  cloudAdminUsersResponseSchema,
  enrollmentReviewResponseSchema,
  enrollmentsResponseSchema,
  type CloudAdminAuditFilter,
  type CloudAdminEmailFilter,
  type CloudAdminUserFilter,
  type EnrollmentStatus
} from '#cloud/contract'

import type { CloudCall, PortalRouteClients } from './request'

/** A page of an admin list: words to search for, one of its filters, and where the page starts. */
export type AdminListRequest<Filter extends string> = {
  search?: string
  filter?: Filter
  limit?: number
  offset?: number
}

/** The query string for `request`; an empty search asks for everything. */
function listQuery<Filter extends string>(request: AdminListRequest<Filter>) {
  return {
    query: {
      search: request.search || undefined,
      filter: request.filter,
      limit: request.limit,
      offset: request.offset
    }
  }
}

export function createAdministrationAPI(call: CloudCall, { admin, api }: PortalRouteClients) {
  return {
    session(signal?: AbortSignal) {
      return call(
        (options) => api.session.$get(undefined, options),
        cloudAdminSessionResponseSchema,
        signal
      )
    },
    enrollments(request: AdminListRequest<EnrollmentStatus>, signal?: AbortSignal) {
      return call(
        (options) => admin.enrollments.$get(listQuery(request), options),
        enrollmentsResponseSchema,
        signal
      )
    },
    reviewEnrollment(
      id: string,
      action: 'approve' | 'reject' | 'revoke',
      note?: string,
      signal?: AbortSignal
    ) {
      return call(
        (options) =>
          admin.enrollments[':id'][action].$post({ param: { id }, json: { note } }, options),
        enrollmentReviewResponseSchema,
        signal
      )
    },
    users(request: AdminListRequest<CloudAdminUserFilter>, signal?: AbortSignal) {
      return call(
        (options) => admin.users.$get(listQuery(request), options),
        cloudAdminUsersResponseSchema,
        signal
      )
    },
    user(id: string, signal?: AbortSignal) {
      return call(
        (options) => admin.users[':id'].$get({ param: { id } }, options),
        cloudAdminUserDetailSchema,
        signal
      )
    },
    userAction(
      action: 'ban' | 'unban' | 'revoke-sessions' | 'reset-two-step' | 'remove-picture',
      userId: string,
      reason?: string,
      signal?: AbortSignal
    ) {
      return call(
        (options) => admin.users[action].$post({ json: { userId, reason } }, options),
        adminMutationResponseSchema,
        signal
      )
    },
    setAdmin(userId: string, enabled: boolean, signal?: AbortSignal) {
      return call(
        (options) => admin.users['set-admin'].$post({ json: { userId, enabled } }, options),
        adminMutationResponseSchema,
        signal
      )
    },
    email(request: AdminListRequest<CloudAdminEmailFilter>, signal?: AbortSignal) {
      return call(
        (options) => admin.email.$get(listQuery(request), options),
        adminEmailResponseSchema,
        signal
      )
    },
    regenerateEmail(id: string, signal?: AbortSignal) {
      return call(
        (options) => admin.email[':id'].regenerate.$post({ param: { id } }, options),
        adminMutationResponseSchema,
        signal
      )
    },
    audit(request: AdminListRequest<CloudAdminAuditFilter>, signal?: AbortSignal) {
      return call(
        (options) => admin.audit.$get(listQuery(request), options),
        adminAuditResponseSchema,
        signal
      )
    },
    operations(signal?: AbortSignal) {
      return call(
        (options) => admin.operations.$get(undefined, options),
        adminOperationsResponseSchema,
        signal
      )
    }
  }
}
