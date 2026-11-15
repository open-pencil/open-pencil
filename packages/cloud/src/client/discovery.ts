import {
  CLOUD_DISCOVERY_PATH,
  CLOUD_PROTOCOL_VERSION,
  cloudDiscoverySchema,
  isEditorVersionAtLeast,
  type CloudDiscovery
} from '#cloud/contract'
import * as v from 'valibot'

const DISCOVERY_TIMEOUT_MS = 10_000

export type CloudFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>

export type DiscoverCloudOptions = {
  fetch?: CloudFetch
  signal?: AbortSignal
  /** The editor's own version, checked against the server's minimum. */
  editorVersion?: string
}

/**
 * Why a server could not be used: the address is not a web address, nothing answered, something
 * answered but not as OpenPencil Cloud, the server is older than this editor supports, or this
 * editor is older than the server supports.
 */
export type CloudDiscoveryFailure =
  | 'invalid-address'
  | 'unreachable'
  | 'not-cloud'
  | 'server-outdated'
  | 'editor-outdated'

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

/** Which side is behind when the server speaks another protocol, or null when it doesn't. */
function protocolMismatch(version: string): CloudDiscoveryFailure | null {
  if (version === CLOUD_PROTOCOL_VERSION) return null
  return Number(version) > Number(CLOUD_PROTOCOL_VERSION) ? 'editor-outdated' : 'server-outdated'
}

function parseDiscoveryBody(text: string, editorVersion: string | undefined): CloudDiscovery {
  const body = v.safeParse(discoveryBodySchema, text)
  if (!body.success) {
    throw new CloudClientError('OpenPencil server discovery is not JSON', body.issues, 'not-cloud')
  }
  const discovery = v.safeParse(cloudDiscoverySchema, body.output)
  if (discovery.success) {
    const minimum = discovery.output.minimumEditorVersion
    if (minimum && editorVersion && !isEditorVersionAtLeast(editorVersion, minimum)) {
      throw new CloudClientError(
        `OpenPencil server needs editor ${minimum} or later`,
        undefined,
        'editor-outdated'
      )
    }
    return discovery.output
  }
  const protocol = v.safeParse(protocolSchema, body.output)
  const version = protocol.success ? protocol.output.protocolVersion : null
  const mismatch = version === null ? null : protocolMismatch(version)
  throw new CloudClientError(
    mismatch
      ? `OpenPencil server speaks protocol ${version}`
      : 'OpenPencil server discovery is invalid',
    discovery.issues,
    mismatch ?? 'not-cloud'
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
    return parseDiscoveryBody(await response.text(), options.editorVersion)
  } catch (error) {
    if (error instanceof CloudClientError) throw error
    if (signal.aborted) {
      throw new CloudClientError('OpenPencil server discovery was cancelled or timed out', error)
    }
    throw new CloudClientError('OpenPencil server discovery failed', error)
  }
}
