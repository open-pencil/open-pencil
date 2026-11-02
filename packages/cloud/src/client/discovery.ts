import {
  CLOUD_DISCOVERY_PATH,
  CLOUD_PROTOCOL_VERSION,
  cloudDiscoverySchema,
  type CloudDiscovery
} from '#cloud/contract'
import * as v from 'valibot'

const DISCOVERY_TIMEOUT_MS = 10_000

export type CloudFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>

export type DiscoverCloudOptions = {
  fetch?: CloudFetch
  signal?: AbortSignal
}

/**
 * Why a server could not be used: the address is not a web address, nothing answered, something
 * answered but not as OpenPencil Cloud, or it speaks another protocol version.
 */
export type CloudDiscoveryFailure = 'invalid-address' | 'unreachable' | 'not-cloud' | 'outdated'

export class CloudClientError extends Error {
  constructor(
    message: string,
    override readonly cause?: unknown,
    readonly reason: CloudDiscoveryFailure = 'unreachable'
  ) {
    super(message)
    this.name = 'CloudClientError'
  }
}

const discoveryBodySchema = v.pipe(v.string(), v.parseJson(), v.looseObject({}))
const protocolSchema = v.looseObject({ protocolVersion: v.string() })

function discoveryURL(serverURL: string): URL {
  let url: URL
  try {
    url = new URL(serverURL)
  } catch (error) {
    throw new CloudClientError('OpenPencil server URL is invalid', error, 'invalid-address')
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new CloudClientError(
      'OpenPencil server URL must use HTTP or HTTPS',
      undefined,
      'invalid-address'
    )
  }
  url.pathname = CLOUD_DISCOVERY_PATH
  url.search = ''
  url.hash = ''
  return url
}

function parseDiscoveryBody(text: string): CloudDiscovery {
  const body = v.safeParse(discoveryBodySchema, text)
  if (!body.success) {
    throw new CloudClientError('OpenPencil server discovery is not JSON', body.issues, 'not-cloud')
  }
  const discovery = v.safeParse(cloudDiscoverySchema, body.output)
  if (discovery.success) return discovery.output
  const protocol = v.safeParse(protocolSchema, body.output)
  const outdated = protocol.success && protocol.output.protocolVersion !== CLOUD_PROTOCOL_VERSION
  throw new CloudClientError(
    outdated
      ? `OpenPencil server speaks protocol ${protocol.output.protocolVersion}`
      : 'OpenPencil server discovery is invalid',
    discovery.issues,
    outdated ? 'outdated' : 'not-cloud'
  )
}

export async function discoverCloud(
  serverURL: string,
  options: DiscoverCloudOptions = {}
): Promise<CloudDiscovery> {
  const fetchImplementation = options.fetch ?? globalThis.fetch
  const timeoutSignal = AbortSignal.timeout(DISCOVERY_TIMEOUT_MS)
  const signal = options.signal ? AbortSignal.any([options.signal, timeoutSignal]) : timeoutSignal

  try {
    const response = await fetchImplementation(discoveryURL(serverURL), {
      headers: { Accept: 'application/json' },
      redirect: 'follow',
      signal
    })
    if (!response.ok) {
      throw new CloudClientError(
        `OpenPencil server discovery failed with HTTP ${response.status}`,
        undefined,
        response.status >= 500 ? 'unreachable' : 'not-cloud'
      )
    }
    return parseDiscoveryBody(await response.text())
  } catch (error) {
    if (error instanceof CloudClientError) throw error
    if (signal.aborted) {
      throw new CloudClientError('OpenPencil server discovery was cancelled or timed out', error)
    }
    throw new CloudClientError('OpenPencil server discovery failed', error)
  }
}
