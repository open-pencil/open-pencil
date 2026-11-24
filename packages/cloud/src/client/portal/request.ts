import type { CloudAdminRoutes } from '#cloud/admin/api/routes'
import { createCloudContractClient } from '#cloud/client/contract'
import type { CloudFetch } from '#cloud/client/discovery'
import { CloudAPIError } from '#cloud/client/response'
import {
  accountSecurityErrorResponseSchema,
  adminErrorResponseSchema,
  type AccountSecurityErrorCode,
  type AdminErrorCode
} from '#cloud/contract'
import type { CloudAccountRoutes } from '#cloud/server/account/routes'
import type { CloudAccessTokenRoutes } from '#cloud/server/account/tokens'
import type { CloudAPI } from '#cloud/server/api'
import { ORPCError } from '@orpc/client'
import { ValidationError } from '@orpc/contract'
import { hc } from 'hono/client'
import * as v from 'valibot'

import { anySignal, DEADLINE_MS } from '@open-pencil/std/timing'

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

/** Runs a call of the contract's client with the call's signal, reading its refusal as any call's. */
export type CloudContractCall = <Output>(
  run: (options: { signal: AbortSignal }) => Promise<Output>,
  signal?: AbortSignal
) => Promise<Output>

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
  const timeoutMs = options.timeoutMs ?? DEADLINE_MS.request
  return async (send, schema, callerSignal) => {
    const timeout = AbortSignal.timeout(timeoutMs)
    const signal = anySignal([callerSignal, timeout])
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

/** The portal's error for a refusal with `status` and `code`, as `createCloudCall` reads one. */
function portalRefusal(status: number, code: string | undefined): CloudPortalAPIError {
  if (status === 401) return new CloudPortalAPIError('authentication-required')
  const body = { error: { code } }
  const accountError = v.safeParse(accountSecurityErrorResponseSchema, body)
  const adminError = v.safeParse(adminErrorResponseSchema, body)
  let known: AdminErrorCode | AccountSecurityErrorCode | undefined
  if (accountError.success) known = accountError.output.error.code
  else if (adminError.success) known = adminError.output.error.code
  if (status === 403 && (!known || known === 'forbidden')) {
    return new CloudPortalAPIError('authorization-required')
  }
  return new CloudPortalAPIError('domain', known)
}

/**
 * Runs a call of the contract's client the way `createCloudCall` sends any other: within the same
 * deadline, with refusals, transport failures, and answers off the contract read the same way.
 */
export function createCloudContractCall(options: CloudPortalClientOptions = {}): CloudContractCall {
  const timeoutMs = options.timeoutMs ?? DEADLINE_MS.request
  return async (run, callerSignal) => {
    const timeout = AbortSignal.timeout(timeoutMs)
    try {
      return await run({ signal: anySignal([callerSignal, timeout]) })
    } catch (cause) {
      if (cause instanceof CloudAPIError) throw portalRefusal(cause.status, cause.code)
      // An answer off the contract, as the client's response check reports one.
      if (cause instanceof ORPCError && cause.cause instanceof ValidationError) {
        throw new CloudPortalAPIError('protocol', undefined, { cause })
      }
      if (callerSignal?.aborted) throw new CloudPortalAPIError('cancelled', undefined, { cause })
      if (timeout.aborted) throw new CloudPortalAPIError('timeout', undefined, { cause })
      throw new CloudPortalAPIError('network', undefined, { cause })
    }
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
    tokens: hc<CloudAccessTokenRoutes>(origin, clientOptions).api.account.tokens,
    admin: hc<CloudAdminRoutes>(new URL('/api/admin', origin).href, clientOptions),
    api: hc<CloudAPI>(new URL('/api', origin).href, clientOptions),
    contract: createCloudContractClient(new URL('/api', origin).href, {
      fetch: options.fetch ?? globalThis.fetch,
      headers: { Accept: 'application/json' }
    })
  }
}

export type PortalRouteClients = ReturnType<typeof createPortalRouteClients>
