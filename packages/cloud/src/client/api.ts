import type { CloudFetch } from '#cloud/client/discovery'
import {
  accountEntitlementsResponseSchema,
  servicesTokenSchema,
  billingTokenSchema,
  cloudSessionSchema,
  type AccountEntitlements,
  type ServicesToken,
  type BillingToken,
  type CloudSession
} from '#cloud/contract'
import type { CloudAPI, PublicCloudAPI } from '#cloud/server/api'
import { hc } from 'hono/client'
import * as v from 'valibot'

import { createCommunityRequests } from './community'
import { createDocumentRequests } from './documents'
import { createImageRequests } from './images'
import { CloudAPIError, parseResponse, responseBody, type CloudClientDiagnostic } from './response'
import { createSharingRequests } from './sharing'
import { createVersionRequests } from './versions'
import { createWorkspaceRequests } from './workspaces'

export { CloudAPIError, type CloudClientDiagnostic } from './response'
export type { CloudUpload } from './documents'

export type CloudRequestOptions = {
  fetch?: CloudFetch
  signal?: AbortSignal
  accessToken?: string
  onDiagnostic?: CloudClientDiagnostic
}

function apiURL(baseURL: string): string {
  const url = new URL(baseURL)
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new CloudAPIError('OpenPencil Cloud API URL must use HTTP or HTTPS', 0)
  }
  url.pathname = url.pathname.replace(/\/$/, '')
  url.search = ''
  url.hash = ''
  return url.href
}

export function createCloudAPIClient(baseURL: string, options: CloudRequestOptions = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.accessToken ? { Authorization: `Bearer ${options.accessToken}` } : {})
  }
  const client = hc<CloudAPI>(apiURL(baseURL), {
    fetch: options.fetch,
    init: { credentials: 'include', signal: options.signal, headers }
  })
  const publicClient = hc<PublicCloudAPI>(apiURL(baseURL), {
    fetch: options.fetch,
    init: { credentials: 'include', signal: options.signal, headers }
  })

  return {
    async getSession(): Promise<CloudSession | null> {
      const response = await client.session.$get()
      if (response.status === 401) return null
      return v.parse(cloudSessionSchema, await responseBody(response, options.onDiagnostic))
    },
    /** A short-lived token for the deployment's services, on the workspace's behalf. */
    async requestServicesToken(workspaceId: string): Promise<ServicesToken> {
      return parseResponse(
        client.services.token.$post({ json: { workspaceId } }),
        servicesTokenSchema,
        options.onDiagnostic
      )
    },
    /** A short-lived token for the deployment's billing, for the signed-in person's own account. */
    async requestBillingToken(): Promise<BillingToken> {
      return parseResponse(client.billing.token.$post(), billingTokenSchema, options.onDiagnostic)
    },
    /** The signed-in account's plan, and the storage its workspaces hold together. */
    async getAccountEntitlements(): Promise<AccountEntitlements> {
      const response = await parseResponse(
        client.account.entitlements.$get(),
        accountEntitlementsResponseSchema,
        options.onDiagnostic
      )
      return response.entitlements
    },
    ...createWorkspaceRequests(client, options.onDiagnostic),
    ...createImageRequests(client, publicClient, options.onDiagnostic),
    ...createDocumentRequests(client, options.onDiagnostic),
    ...createVersionRequests(client, options.onDiagnostic),
    ...createSharingRequests(client, publicClient, options.onDiagnostic),
    ...createCommunityRequests(publicClient, options.onDiagnostic)
  }
}

export type CloudAPIClient = ReturnType<typeof createCloudAPIClient>
