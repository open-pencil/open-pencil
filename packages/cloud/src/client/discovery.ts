import { CLOUD_DISCOVERY_PATH, parseCloudDiscovery, type CloudDiscovery } from '#cloud/contract'

const DISCOVERY_TIMEOUT_MS = 10_000

export type CloudFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>

export type DiscoverCloudOptions = {
  fetch?: CloudFetch
  signal?: AbortSignal
}

export class CloudClientError extends Error {
  constructor(
    message: string,
    readonly cause?: unknown
  ) {
    super(message)
    this.name = 'CloudClientError'
  }
}

function discoveryURL(serverURL: string): URL {
  let url: URL
  try {
    url = new URL(serverURL)
  } catch (error) {
    throw new CloudClientError('OpenPencil server URL is invalid', error)
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new CloudClientError('OpenPencil server URL must use HTTP or HTTPS')
  }
  url.pathname = CLOUD_DISCOVERY_PATH
  url.search = ''
  url.hash = ''
  return url
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
      throw new CloudClientError(`OpenPencil server discovery failed with HTTP ${response.status}`)
    }
    return parseCloudDiscovery(await response.json())
  } catch (error) {
    if (error instanceof CloudClientError) throw error
    if (signal.aborted) {
      throw new CloudClientError('OpenPencil server discovery was cancelled or timed out', error)
    }
    throw new CloudClientError('OpenPencil server discovery failed', error)
  }
}
