import * as v from 'valibot'

import type { CloudFetch } from '@open-pencil/cloud/client'
import {
  adminAuditResponseSchema,
  adminEmailResponseSchema,
  adminErrorResponseSchema,
  adminMutationResponseSchema,
  adminOperationsResponseSchema,
  cloudAccountStatusResponseSchema,
  cloudAdminSessionResponseSchema,
  cloudAdminUsersResponseSchema,
  enrollmentReviewResponseSchema,
  enrollmentsResponseSchema,
  type AdminErrorCode
} from '@open-pencil/cloud/contract'

export type CloudAdminAPIErrorKind =
  | 'authentication-required'
  | 'authorization-required'
  | 'cancelled'
  | 'domain'
  | 'network'
  | 'protocol'
  | 'timeout'

export class CloudAdminAPIError extends Error {
  override readonly name = 'CloudAdminAPIError'

  constructor(
    readonly kind: CloudAdminAPIErrorKind,
    readonly code?: AdminErrorCode,
    options?: ErrorOptions
  ) {
    super(kind, options)
  }
}

export type CloudAdminAPIClientOptions = {
  baseURL?: string
  fetch?: CloudFetch
  timeoutMs?: number
}

function requestURL(baseURL: string, path: string): URL {
  return new URL(`/api${path}`, baseURL)
}

export function createCloudAdminAPIClient(options: CloudAdminAPIClientOptions = {}) {
  const baseURL = options.baseURL
  const requestFetch = options.fetch ?? globalThis.fetch
  const timeoutMs = options.timeoutMs ?? 10_000

  async function request<Output>(
    path: string,
    schema: v.GenericSchema<unknown, Output>,
    init: RequestInit = {}
  ): Promise<Output> {
    const headers = new Headers(init.headers)
    headers.set('Accept', 'application/json')
    if (init.body) headers.set('Content-Type', 'application/json')
    const timeout = AbortSignal.timeout(timeoutMs)
    const signal = init.signal ? AbortSignal.any([init.signal, timeout]) : timeout
    let response: Response
    try {
      response = await requestFetch(requestURL(baseURL ?? globalThis.location.origin, path), {
        ...init,
        credentials: 'include',
        headers,
        signal
      })
    } catch (cause) {
      if (init.signal?.aborted) throw new CloudAdminAPIError('cancelled', undefined, { cause })
      if (timeout.aborted) throw new CloudAdminAPIError('timeout', undefined, { cause })
      throw new CloudAdminAPIError('network', undefined, { cause })
    }
    if (response.status === 401) throw new CloudAdminAPIError('authentication-required')
    if (response.status === 403) throw new CloudAdminAPIError('authorization-required')

    let body: unknown
    try {
      body = await response.json()
    } catch (cause) {
      throw new CloudAdminAPIError('protocol', undefined, { cause })
    }
    if (!response.ok) {
      const error = v.safeParse(adminErrorResponseSchema, body)
      throw new CloudAdminAPIError('domain', error.success ? error.output.error.code : undefined)
    }
    const parsed = v.safeParse(schema, body)
    if (!parsed.success)
      throw new CloudAdminAPIError('protocol', undefined, { cause: parsed.issues })
    return parsed.output
  }

  return {
    accountStatus(signal?: AbortSignal) {
      return request('/account/status', cloudAccountStatusResponseSchema, { signal })
    },
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
        {
          method: 'POST',
          body: JSON.stringify({ note }),
          signal
        }
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
        {
          method: 'POST',
          signal
        }
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

export type CloudAdminAPIClient = ReturnType<typeof createCloudAdminAPIClient>
export const cloudAdminAPI = createCloudAdminAPIClient()
