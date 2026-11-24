import type { CloudFetch } from '#cloud/client/discovery'
import {
  accountEntitlementsResponseSchema,
  servicesTokenSchema,
  billingTokenSchema,
  cloudSessionSchema,
  sendsTokenSafely,
  type AccountEntitlements,
  type ServicesToken,
  type BillingToken,
  type CloudSession
} from '#cloud/contract'
import type { CloudAPI, PublicCloudAPI } from '#cloud/server/api'
import { hc } from 'hono/client'
import * as v from 'valibot'

import { anySignal, DEADLINE_MS } from '@open-pencil/std/timing'

import { createCommentRequests, createSharedCommentRequests } from './comments'
import { createCommunityRequests } from './community'
import { createCloudContractClient } from './contract'
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

/**
 * How long one Cloud API request may take. Some do real work on the server, such as saving a
 * revision or deleting an account, and bytes go to storage directly, so a JSON call past this has
 * hung rather than run slowly.
 */
const API_DEADLINE_MS = DEADLINE_MS.slowRequest

/** `fetch`, with each request bounded by its own deadline as well as the caller's signal. */
function boundedFetch(fetch: CloudFetch = globalThis.fetch): CloudFetch {
  return (input, init) =>
    fetch(input, {
      ...init,
      signal: anySignal([init?.signal, AbortSignal.timeout(API_DEADLINE_MS)])
    })
}

export function createCloudAPIClient(baseURL: string, options: CloudRequestOptions = {}) {
  // An access token goes only where nobody between can read it, as services tokens do.
  if (options.accessToken && !sendsTokenSafely(apiURL(baseURL))) {
    throw new CloudAPIError('OpenPencil Cloud takes an access token only over HTTPS', 0)
  }
  const headers = {
    'Content-Type': 'application/json',
    ...(options.accessToken ? { Authorization: `Bearer ${options.accessToken}` } : {})
  }
  const fetch = boundedFetch(options.fetch)
  const client = hc<CloudAPI>(apiURL(baseURL), {
    fetch,
    init: { credentials: 'include', signal: options.signal, headers }
  })
  const publicClient = hc<PublicCloudAPI>(apiURL(baseURL), {
    fetch,
    init: { credentials: 'include', signal: options.signal, headers }
  })
  // The contract client sets the content type of what it sends itself.
  const contract = createCloudContractClient(apiURL(baseURL), {
    fetch,
    headers: options.accessToken ? { Authorization: `Bearer ${options.accessToken}` } : {},
    signal: options.signal
  })

  return {
    async getSession(): Promise<CloudSession | null> {
      try {
        return await contract.session.session()
      } catch (error) {
        if (error instanceof CloudAPIError && error.status === 401) return null
        throw error
      }
    },
    /** A short-lived token for the deployment's services, on the workspace's behalf. */
    requestServicesToken(workspaceId: string): Promise<ServicesToken> {
      return contract.session.servicesToken({ body: { workspaceId } })
    },
    /** A short-lived token for the deployment's billing, for the signed-in person's own account. */
    requestBillingToken(): Promise<BillingToken> {
      return contract.session.billingToken()
    },
    /** The signed-in account's plan, and the storage its workspaces hold together. */
    async getAccountEntitlements(): Promise<AccountEntitlements> {
      return (await contract.session.accountEntitlements()).entitlements
    },
    ...createWorkspaceRequests(contract.workspaces, contract.documents),
    ...createImageRequests(contract.documents, contract.publicSharing),
    ...createDocumentRequests(contract.documents, contract.sharing),
    ...createVersionRequests(contract.versions),
    ...createCommentRequests(contract.comments),
    ...createSharedCommentRequests(contract.sharedComments),
    ...createSharingRequests(contract.sharing, contract.publicSharing),
    ...createCommunityRequests(contract.community)
  }
}

export type CloudAPIClient = ReturnType<typeof createCloudAPIClient>
