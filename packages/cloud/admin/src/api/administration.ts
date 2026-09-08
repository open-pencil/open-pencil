import {
  adminAuditResponseSchema,
  adminEmailResponseSchema,
  adminMutationResponseSchema,
  adminOperationsResponseSchema,
  cloudAdminSessionResponseSchema,
  cloudAdminUsersResponseSchema,
  enrollmentReviewResponseSchema,
  enrollmentsResponseSchema
} from '@open-pencil/cloud/contract'

import type { CloudRequest } from './request'

export function createAdministrationAPI(request: CloudRequest) {
  return {
    session(signal?: AbortSignal) {
      return request('/session', cloudAdminSessionResponseSchema, { signal })
    },
    enrollments(status?: string, signal?: AbortSignal) {
      const query = new URLSearchParams()
      if (status) query.set('status', status)
      const suffix = query.size ? `?${query}` : ''
      return request(`/admin/enrollments${suffix}`, enrollmentsResponseSchema, { signal })
    },
    reviewEnrollment(
      id: string,
      action: 'approve' | 'reject' | 'revoke',
      note?: string,
      signal?: AbortSignal
    ) {
      return request(
        `/admin/enrollments/${encodeURIComponent(id)}/${action}`,
        enrollmentReviewResponseSchema,
        { method: 'POST', body: JSON.stringify({ note }), signal }
      )
    },
    users(search?: string, signal?: AbortSignal) {
      const query = new URLSearchParams()
      if (search) query.set('search', search)
      const suffix = query.size ? `?${query}` : ''
      return request(`/admin/users${suffix}`, cloudAdminUsersResponseSchema, { signal })
    },
    userAction(
      action: 'ban' | 'unban' | 'revoke-sessions',
      userId: string,
      reason?: string,
      signal?: AbortSignal
    ) {
      return request(`/admin/users/${action}`, adminMutationResponseSchema, {
        method: 'POST',
        body: JSON.stringify({ userId, reason }),
        signal
      })
    },
    setAdmin(userId: string, enabled: boolean, signal?: AbortSignal) {
      return request('/admin/users/set-admin', adminMutationResponseSchema, {
        method: 'POST',
        body: JSON.stringify({ userId, enabled }),
        signal
      })
    },
    email(signal?: AbortSignal) {
      return request('/admin/email', adminEmailResponseSchema, { signal })
    },
    regenerateEmail(id: string, signal?: AbortSignal) {
      return request(
        `/admin/email/${encodeURIComponent(id)}/regenerate`,
        adminMutationResponseSchema,
        { method: 'POST', signal }
      )
    },
    audit(signal?: AbortSignal) {
      return request('/admin/audit', adminAuditResponseSchema, { signal })
    },
    operations(signal?: AbortSignal) {
      return request('/admin/operations', adminOperationsResponseSchema, { signal })
    }
  }
}
