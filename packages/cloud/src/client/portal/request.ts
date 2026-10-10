import type { CloudFetch } from '#cloud/client/discovery'
import {
  accountSecurityErrorResponseSchema,
  adminErrorResponseSchema,
  type AccountSecurityErrorCode,
  type AdminErrorCode
} from '#cloud/contract'
import * as v from 'valibot'

export type CloudPortalAPIErrorKind =
  | 'authentication-required'
  | 'authorization-required'
  | 'cancelled'
  | 'domain'
  | 'network'
  | 'protocol'
  | 'timeout'

export class CloudPortalAPIError extends Error {
  override readonly name = 'CloudPortalAPIError'

  constructor(
    readonly kind: CloudPortalAPIErrorKind,
    readonly code?: AdminErrorCode | AccountSecurityErrorCode,
    options?: ErrorOptions
  ) {
    super(kind, options)
  }
}

export type CloudPortalClientOptions = {
  baseURL?: string
  fetch?: CloudFetch
  timeoutMs?: number
}

export type CloudRequest = <Output>(
  path: string,
  schema: v.GenericSchema<unknown, Output>,
  init?: RequestInit
) => Promise<Output>

export function createCloudRequest(options: CloudPortalClientOptions = {}): CloudRequest {
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
      if (init.signal?.aborted) throw new CloudPortalAPIError('cancelled', undefined, { cause })
      if (timeout.aborted) throw new CloudPortalAPIError('timeout', undefined, { cause })
      throw new CloudPortalAPIError('network', undefined, { cause })
    }
    if (response.status === 401) throw new CloudPortalAPIError('authentication-required')
    if (response.status === 403) throw new CloudPortalAPIError('authorization-required')
    let body: unknown
    try {
      body = await response.json()
    } catch (cause) {
      throw new CloudPortalAPIError('protocol', undefined, { cause })
    }
    if (!response.ok) {
      const accountError = v.safeParse(accountSecurityErrorResponseSchema, body)
      const adminError = v.safeParse(adminErrorResponseSchema, body)
      let code: AdminErrorCode | AccountSecurityErrorCode | undefined
      if (accountError.success) code = accountError.output.error.code
      else if (adminError.success) code = adminError.output.error.code
      throw new CloudPortalAPIError('domain', code)
    }
    const parsed = v.safeParse(schema, body)
    if (!parsed.success) {
      throw new CloudPortalAPIError('protocol', undefined, { cause: parsed.issues })
    }
    return parsed.output
  }
}
