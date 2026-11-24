import { createCloudContractClient, type CloudContractClient } from '#cloud/client/contract'
import { CloudAPIError } from '#cloud/client/response'

/** Something that answers requests, as a Cloud app does in a test. */
type RequestHandler = { request(request: Request): Response | Promise<Response> }

/** The contract's client, calling `app` directly, with `headers` on every request. */
export function contractClient(
  app: RequestHandler,
  headers: Record<string, string> = {}
): CloudContractClient {
  return createCloudContractClient('http://localhost/api', {
    fetch: async (input, init) => app.request(new Request(input, init)),
    headers
  })
}

/** How a call ended: `'ok'`, or the status and code the API refused it with. */
export async function outcome(
  call: Promise<unknown>
): Promise<'ok' | { status: number; code: string | undefined }> {
  try {
    await call
    return 'ok'
  } catch (error) {
    if (error instanceof CloudAPIError) return { status: error.status, code: error.code }
    throw error
  }
}
