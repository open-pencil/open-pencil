import { createCloudAPIClient } from './api'
import { discoverCloud, type CloudFetch } from './discovery'
import { downloadCloudDocument } from './files'

/** The tour a server's gallery names, as one file, and the release it was named for. */
export type CommunityTour = { name: string; version: string | null; bytes: Uint8Array }

/**
 * The tour a Cloud server's community gallery names (`[community] tour`), with its images, as
 * the named version for `version` when the gallery has one, such as the release an older editor
 * is, else as it is now. Null when the server names no tour or its gallery no longer holds it.
 * Requests carry no account, so any page may make them, as the documentation site's landing does.
 */
export async function fetchCommunityTour(
  serverURL: string,
  options: { version?: string | null; fetch?: CloudFetch; signal?: AbortSignal } = {}
): Promise<CommunityTour | null> {
  const base = options.fetch ?? globalThis.fetch
  const fetch: CloudFetch = (input, init) => base(input, { ...init, credentials: 'omit' })
  const discovery = await discoverCloud(serverURL, { fetch, signal: options.signal })
  const tourId = discovery.community?.tourDocumentId
  if (!tourId) return null
  const cloud = createCloudAPIClient(discovery.apiURL, { fetch, signal: options.signal })
  const tour = (await cloud.listCommunityDocuments()).find((document) => document.id === tourId)
  if (!tour) return null
  const release = tour.versions.find((version) => version.name === options.version) ?? null
  const download = await cloud.getCommunityDocument(tour.id, release?.id ?? null)
  const bytes = await downloadCloudDocument(
    download.document,
    (input, init) => fetch(input, init),
    {
      signal: options.signal
    }
  )
  return { name: tour.name, version: download.version?.name ?? null, bytes }
}
