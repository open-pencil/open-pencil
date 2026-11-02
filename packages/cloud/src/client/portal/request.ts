import type { CloudAdminRoutes } from '#cloud/admin/api/routes'
import type { CloudFetch } from '#cloud/client/discovery'
import {
  accountSecurityErrorResponseSchema,
  adminErrorResponseSchema,
  type AccountSecurityErrorCode,
  type AdminErrorCode
} from '#cloud/contract'
import type { CloudAccountRoutes } from '#cloud/server/account/routes'
import type { CloudAPI } from '#cloud/server/api'
import { hc } from 'hono/client'
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

/** The parts of a response the portal reads; the typed Hono clients' responses have them. */
type PortalResponse = Pick<Response, 'ok' | 'status' | 'json'>

/** Sends one request with the call's `init` (its signal); the typed Hono clients fit this shape. */
export type CloudSend = (options: { init: RequestInit }) => Promise<PortalResponse>

export type CloudCall = <Output>(
  send: CloudSend,
  schema: v.GenericSchema<unknown, Output>,
  signal?: AbortSignal
) => Promise<Output>

/**
 * Sends a request and reads its answer the same way for every portal route: transport failures,
 * missing sessions and permissions, and domain errors become `CloudPortalAPIError`, and a success
 * body is checked against the contract.
 */
export function createCloudCall(options: CloudPortalClientOptions = {}): CloudCall {
  const timeoutMs = options.timeoutMs ?? 10_000
  return async (send, schema, callerSignal) => {
    const timeout = AbortSignal.timeout(timeoutMs)
    const signal = callerSignal ? AbortSignal.any([callerSignal, timeout]) : timeout
    let response: PortalResponse
    try {
      response = await send({ init: { signal } })
    } catch (cause) {
      if (callerSignal?.aborted) throw new CloudPortalAPIError('cancelled', undefined, { cause })
      if (timeout.aborted) throw new CloudPortalAPIError('timeout', undefined, { cause })
      throw new CloudPortalAPIError('network', undefined, { cause })
    }
    if (response.status === 401) throw new CloudPortalAPIError('authentication-required')
    let body: unknown
    try {
      body = await response.json()
    } catch (cause) {
      if (response.status === 403) throw new CloudPortalAPIError('authorization-required')
      throw new CloudPortalAPIError('protocol', undefined, { cause })
    }
    if (!response.ok) {
      const accountError = v.safeParse(accountSecurityErrorResponseSchema, body)
      const adminError = v.safeParse(adminErrorResponseSchema, body)
      let code: AdminErrorCode | AccountSecurityErrorCode | undefined
      if (accountError.success) code = accountError.output.error.code
      else if (adminError.success) code = adminError.output.error.code
      // A refusal that says why, such as a session that must sign in again, is the domain's;
      // a bare or plain `forbidden` one is a missing permission.
      if (response.status === 403 && (!code || code === 'forbidden')) {
        throw new CloudPortalAPIError('authorization-required')
      }
      throw new CloudPortalAPIError('domain', code)
    }
    const parsed = v.safeParse(schema, body)
    if (!parsed.success) {
      throw new CloudPortalAPIError('protocol', undefined, { cause: parsed.issues })
    }
    return parsed.output
  }
}

/** Typed clients for the routes the portal calls, all on the server's own address. */
export function createPortalRouteClients(options: CloudPortalClientOptions = {}) {
  const origin = options.baseURL ?? globalThis.location.origin
  const clientOptions = {
    fetch: options.fetch,
    headers: { Accept: 'application/json' },
    init: { credentials: 'include' as const }
  }
  return {
    account: hc<CloudAccountRoutes>(origin, clientOptions).api.account,
    admin: hc<CloudAdminRoutes>(new URL('/api/admin', origin).href, clientOptions),
    api: hc<CloudAPI>(new URL('/api', origin).href, clientOptions)
  }
}

export type PortalRouteClients = ReturnType<typeof createPortalRouteClients>
