import { anySignal, DEADLINE_MS } from '@open-pencil/std/timing'

import { createCloudAPIClient } from './api'
import { discoverCloud, type CloudFetch } from './discovery'
import { downloadCloudDocument } from './files'

/** A document of a server's community gallery, as one file, and the release it was named for. */
export type CommunityExample = { name: string; version: string | null; bytes: Uint8Array }

/** The tour a server's gallery names, as one file, and the release it was named for. */
export type CommunityTour = CommunityExample

type CommunityFetchOptions = { version?: string | null; fetch?: CloudFetch; signal?: AbortSignal }

/**
 * The tour a Cloud server's community gallery names (`[community] tour`), with its images, as
 * the named version for `version` when the gallery has one, such as the release an older editor
 * is, else as it is now. Null when the server names no tour or its gallery no longer holds it.
 * Requests carry no account, so any page may make them, as the documentation site's landing does.
 */
export function fetchCommunityTour(
  serverURL: string,
  options: CommunityFetchOptions = {}
): Promise<CommunityTour | null> {
  return fetchCommunityDocument(serverURL, options, (documents, tourId) =>
    tourId ? documents.find((document) => document.id === tourId) : undefined
  )
}

/**
 * The document of a Cloud server's community gallery called `name`, such as an example the
 * docs landing shows beside the tour, as `fetchCommunityTour` gives the tour: the named version
 * for `version` when it has one, else as it is now. Null when the gallery holds no such document.
 */
export function fetchCommunityExample(
  serverURL: string,
  name: string,
  options: CommunityFetchOptions = {}
): Promise<CommunityExample | null> {
  return fetchCommunityDocument(serverURL, options, (documents) =>
    documents.find((document) => document.name === name)
  )
}

type CommunityListing = Awaited<
  ReturnType<ReturnType<typeof createCloudAPIClient>['listCommunityDocuments']>
>['documents']

async function fetchCommunityDocument(
  serverURL: string,
  options: CommunityFetchOptions,
  pick: (documents: CommunityListing, tourId: string | null) => CommunityListing[number] | undefined
): Promise<CommunityExample | null> {
  const base = options.fetch ?? globalThis.fetch
  const fetch: CloudFetch = (input, init) => base(input, { ...init, credentials: 'omit' })
  const discovery = await discoverCloud(serverURL, { fetch, signal: options.signal })
  if (!discovery.community) return null
  const cloud = createCloudAPIClient(discovery.apiURL, { fetch, signal: options.signal })
  const picked = pick(
    (await cloud.listCommunityDocuments()).documents,
    discovery.community.tourDocumentId ?? null
  )
  if (!picked) return null
  const release = picked.versions.find((version) => version.name === options.version) ?? null
  const download = await cloud.getCommunityDocument(picked.id, release?.id ?? null)
  // Each object from the store is bounded too, its body included, as the API's requests are: a
  // caller such as the docs landing passes no signal and keeps the answer it waits for.
  const bytes = await downloadCloudDocument(
    download.document,
    (input, init) =>
      fetch(input, {
        ...init,
        signal: anySignal([init.signal, AbortSignal.timeout(DEADLINE_MS.transfer)])
      }),
    { signal: options.signal }
  )
  return { name: picked.name, version: download.version?.name ?? null, bytes }
}
