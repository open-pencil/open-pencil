import * as v from 'valibot'

import type { CloudFetch } from '@open-pencil/cloud/client'
import {
  accountSecurityErrorResponseSchema,
  adminErrorResponseSchema,
  type AccountSecurityErrorCode,
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
    readonly code?: AdminErrorCode | AccountSecurityErrorCode,
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

export type CloudRequest = <Output>(
  path: string,
  schema: v.GenericSchema<unknown, Output>,
  init?: RequestInit
) => Promise<Output>

export function createCloudRequest(options: CloudAdminAPIClientOptions = {}): CloudRequest {
  const baseURL = options.baseURL
  const requestFetch = options.fetch ?? globalThis.fetch
  const timeoutMs = options.timeoutMs ?? 10_000
  return async (path, schema, init = {}) => {
    const headers = new Headers(init.headers)
    headers.set('Accept', 'application/json')
    if (init.body) headers.set('Content-Type', 'application/json')
    const timeout = AbortSignal.timeout(timeoutMs)
    const signal = init.signal ? AbortSignal.any([init.signal, timeout]) : timeout
    let response: Response
    try {
      response = await requestFetch(new URL(`/api${path}`, baseURL ?? globalThis.location.origin), {
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
      const accountError = v.safeParse(accountSecurityErrorResponseSchema, body)
      const adminError = v.safeParse(adminErrorResponseSchema, body)
      let code: AdminErrorCode | AccountSecurityErrorCode | undefined
      if (accountError.success) code = accountError.output.error.code
      else if (adminError.success) code = adminError.output.error.code
      throw new CloudAdminAPIError('domain', code)
    }
    const parsed = v.safeParse(schema, body)
    if (!parsed.success) {
      throw new CloudAdminAPIError('protocol', undefined, { cause: parsed.issues })
    }
    return parsed.output
  }
}
