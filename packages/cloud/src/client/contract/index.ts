import type { CloudFetch } from '#cloud/client/discovery'
import {
  adminContract,
  cloudAPIContract,
  cloudAPIErrorBodySchema,
  publicCloudAPIContract
} from '#cloud/contract'
import { createORPCClient, DynamicLink, type ClientContext, type ClientLink } from '@orpc/client'
import type { RouterContract, RouterContractClient } from '@orpc/contract'
import type { JsonifiedClient } from '@orpc/openapi'
import * as v from 'valibot'

import { CloudAPIError } from '../response'

/** The whole contract the Cloud API answers: the signed-in routes, and those anyone may call. */
const contract = { ...cloudAPIContract, ...publicCloudAPIContract }

export type CloudContractClient = JsonifiedClient<RouterContractClient<typeof contract>>

/** The error an answer's status and `{ "error": { "code": … } }` body stand for. */
function cloudAPIError(status: number, body: unknown): CloudAPIError {
  const parsed = v.safeParse(cloudAPIErrorBodySchema, body)
  return new CloudAPIError(
    `OpenPencil Cloud request failed with HTTP ${status}`,
    status,
    parsed.success ? parsed.output.error.code : undefined,
    typeof body !== 'object' || body === null
  )
}

type ContractClientOptions = {
  fetch: CloudFetch
  headers: Record<string, string>
  signal?: AbortSignal
}

/** How a client of a service other than Cloud's API sends requests and reads refusals. */
export type ServiceContractClientOptions = ContractClientOptions & {
  /** Whether requests carry the person's cookies, as only Cloud's own API wants. */
  credentials: RequestCredentials
  /** The error a refusal's status and body stand for. */
  refusal: (status: number, body: unknown) => Error
}

/**
 * A client of `routes` at `baseURL`. Requests go through `fetch` with `headers`, and `signal` as
 * well as each call's own; answers are checked against the contract, and refusals throw what
 * `refusal` makes of them.
 */
export function createContractClient<T extends RouterContract>(
  routes: T,
  baseURL: string,
  options: ServiceContractClientOptions
): JsonifiedClient<RouterContractClient<T>> {
  // The link and its serializer load with the first request, off the editor's startup.
  let link: Promise<ClientLink<ClientContext>> | undefined
  return createORPCClient(
    new DynamicLink(() => {
      link ??= import('./link').then(({ createContractLink }) =>
        createContractLink(routes, baseURL, options)
      )
      return link
    })
  )
}

/** The Cloud API's routes at the API `apiURL` names. */
export function createCloudContractClient(
  apiURL: string,
  options: ContractClientOptions
): CloudContractClient {
  return createContractClient(contract, apiURL, {
    ...options,
    credentials: 'include',
    refusal: cloudAPIError
  })
}

export type CloudAdminContractClient = JsonifiedClient<RouterContractClient<typeof adminContract>>

/** The server's administration, at `adminURL`, such as `https://cloud.example/api/admin`. */
export function createCloudAdminContractClient(
  adminURL: string,
  options: ContractClientOptions
): CloudAdminContractClient {
  return createContractClient(adminContract, adminURL, {
    ...options,
    credentials: 'include',
    refusal: cloudAPIError
  })
}
