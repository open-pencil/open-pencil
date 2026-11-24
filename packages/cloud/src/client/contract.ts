import type { CloudFetch } from '#cloud/client/discovery'
import { cloudAPIContract, cloudAPIErrorBodySchema, publicCloudAPIContract } from '#cloud/contract'
import { createORPCClient } from '@orpc/client'
import type { RouterContractClient } from '@orpc/contract'
import { ResponseValidationLinkPlugin } from '@orpc/contract/plugins'
import type { JsonifiedClient } from '@orpc/openapi'
import { OpenAPILink } from '@orpc/openapi/fetch'
import * as v from 'valibot'

import { anySignal } from '@open-pencil/std/timing'

import { CloudAPIError } from './response'

/** The whole contract the Cloud API answers: the signed-in routes, and those anyone may call. */
const contract = { ...cloudAPIContract, ...publicCloudAPIContract }

export type CloudContractClient = JsonifiedClient<RouterContractClient<typeof contract>>

/** The error an answer's status and `{ "error": { "code": … } }` body stand for. */
function cloudAPIError(status: number, body: unknown): CloudAPIError {
  const parsed = v.safeParse(cloudAPIErrorBodySchema, body)
  return new CloudAPIError(
    `OpenPencil Cloud request failed with HTTP ${status}`,
    status,
    parsed.success ? parsed.output.error.code : undefined
  )
}

/**
 * The routes the contract describes, at the API `apiURL` names. Requests go through `fetch` with
 * the person's cookies, `headers`, and `signal` as well as each call's own; answers are checked against the contract, and
 * refusals throw `CloudAPIError` as every other call does.
 */
export function createCloudContractClient(
  apiURL: string,
  options: { fetch: CloudFetch; headers: Record<string, string>; signal?: AbortSignal }
): CloudContractClient {
  const url = new URL(apiURL)
  const link = new OpenAPILink(contract, {
    origin: url.origin,
    url: `/${url.pathname.replace(/^\/+/, '')}`,
    headers: options.headers,
    fetch: (request, init) =>
      options.fetch(request, {
        ...init,
        credentials: 'include',
        signal: anySignal([init.signal, options.signal])
      }),
    errorResponseBodyDecoder: (body, response) => cloudAPIError(response.status, body),
    plugins: [new ResponseValidationLinkPlugin(contract)]
  })
  return createORPCClient(link)
}
