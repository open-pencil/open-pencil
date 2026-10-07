import * as v from 'valibot'

import { tauriFetch } from '@/app/tauri/http'

type ClipboardImageFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>

type FigmaImageURLs = Record<string, string>

const IMAGE_FETCH_CONCURRENCY = 6
const IMAGE_FETCH_TIMEOUT_MS = 15_000

/** Figma's image batch response: a URL per image hash, unless it reports a failure. */
const batchResponseSchema = v.pipe(
  v.object({
    error: v.optional(v.unknown()),
    status: v.optional(v.unknown()),
    meta: v.object({ s3_urls: v.record(v.string(), v.unknown()) })
  }),
  v.check(({ error, status }) => error !== true && (typeof status !== 'number' || status === 200))
)

function imageURLsFromBatchResponse(value: unknown): FigmaImageURLs {
  const parsed = v.safeParse(batchResponseSchema, value)
  if (!parsed.success) throw new Error('Figma returned an invalid image response')
  return Object.fromEntries(
    Object.entries(parsed.output.meta.s3_urls).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string'
    )
  )
}

async function sha1Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-1', Uint8Array.from(bytes))
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

export async function resolveFigmaClipboardImages(
  fileKey: string,
  hashes: string[],
  fetcher: ClipboardImageFetch = tauriFetch,
  timeoutMs = IMAGE_FETCH_TIMEOUT_MS
): Promise<ReadonlyMap<string, Uint8Array>> {
  const uniqueHashes = [...new Set(hashes)]
  if (uniqueHashes.length === 0) return new Map()

  const batchResponse = await fetcher(
    `https://www.figma.com/file/${encodeURIComponent(fileKey)}/image/batch`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sha1s: uniqueHashes, needs_compressed_textures: false }),
      signal: AbortSignal.timeout(timeoutMs)
    }
  )
  if (!batchResponse.ok) {
    throw new Error(`Figma image request failed with status ${batchResponse.status}`)
  }

  const payload: unknown = await batchResponse.json()
  const urls = imageURLsFromBatchResponse(payload)
  const images = new Map<string, Uint8Array>()

  for (let offset = 0; offset < uniqueHashes.length; offset += IMAGE_FETCH_CONCURRENCY) {
    const batch = uniqueHashes.slice(offset, offset + IMAGE_FETCH_CONCURRENCY)
    await Promise.all(
      batch.map(async (hash) => {
        const url = urls[hash]
        if (!url) return
        try {
          const response = await fetcher(url, { signal: AbortSignal.timeout(timeoutMs) })
          if (!response.ok) throw new Error(`status ${response.status}`)
          const bytes = new Uint8Array(await response.arrayBuffer())
          if ((await sha1Hex(bytes)) !== hash.toLowerCase()) {
            throw new Error('SHA-1 mismatch')
          }
          images.set(hash, bytes)
        } catch (error) {
          console.warn(`Failed to fetch pasted Figma image ${hash}`, error)
        }
      })
    )
  }

  return images
}
