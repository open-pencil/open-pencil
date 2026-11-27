import { cloudAPIContract, cloudAPIErrorBodySchema } from '#cloud/contract'
import { createORPCClient } from '@orpc/client'
import type { RouterContractClient } from '@orpc/contract'
import { ResponseValidationLinkPlugin } from '@orpc/contract/plugins'
import type { JsonifiedClient } from '@orpc/openapi'
import { OpenAPILink } from '@orpc/openapi/fetch'
import * as v from 'valibot'

/** The Cloud API as a tool calls it, for one caller. */
export type MCPAPI = JsonifiedClient<RouterContractClient<typeof cloudAPIContract>>

/** The API refused a call, with its status and code. */
export class MCPAPIError extends Error {
  override readonly name = 'MCPAPIError'

  constructor(
    readonly status: number,
    readonly code: string | undefined
  ) {
    super(`The Cloud API answered ${status}`)
  }
}

/**
 * The contract's client, calling the server's own routes with the caller's `Authorization`, so a
 * tool is held to exactly what the token reaches there: its scopes, workspace, and limits alike.
 */
export function createMCPAPI(
  fetchAPI: (request: Request) => Response | Promise<Response>,
  publicURL: string,
  authorization: string
): MCPAPI {
  return createORPCClient(
    new OpenAPILink(cloudAPIContract, {
      origin: new URL(publicURL).origin,
      url: '/api',
      headers: { authorization },
      fetch: async (request, init) => fetchAPI(new Request(request, init)),
      errorResponseBodyDecoder: (body, response) => {
        const parsed = v.safeParse(cloudAPIErrorBodySchema, body)
        return new MCPAPIError(
          response.status,
          parsed.success ? parsed.output.error.code : undefined
        )
      },
      plugins: [new ResponseValidationLinkPlugin(cloudAPIContract)]
    })
  )
}
