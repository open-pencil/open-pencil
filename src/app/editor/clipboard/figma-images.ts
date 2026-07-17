import { tauriFetch } from '@/app/tauri/http'

type ClipboardImageFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>

type FigmaImageURLs = Record<string, string>

const IMAGE_FETCH_CONCURRENCY = 6

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function imageURLsFromBatchResponse(value: unknown): FigmaImageURLs {
  if (
    !isRecord(value) ||
    value.error === true ||
    (typeof value.status === 'number' && value.status !== 200) ||
    !isRecord(value.meta)
  ) {
    throw new Error('Figma returned an invalid image response')
  }
  const urls = value.meta.s3_urls
  if (!isRecord(urls)) throw new Error('Figma returned an invalid image URL map')

  const result: FigmaImageURLs = {}
  for (const [hash, url] of Object.entries(urls)) {
    if (typeof url === 'string') result[hash] = url
  }
  return result
}

async function sha1Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-1', Uint8Array.from(bytes))
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

export async function resolveFigmaClipboardImages(
  fileKey: string,
  hashes: string[],
  fetcher: ClipboardImageFetch = tauriFetch
): Promise<ReadonlyMap<string, Uint8Array>> {
  const uniqueHashes = [...new Set(hashes)]
  if (uniqueHashes.length === 0) return new Map()

  const batchResponse = await fetcher(
    `https://www.figma.com/file/${encodeURIComponent(fileKey)}/image/batch`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sha1s: uniqueHashes, needs_compressed_textures: false })
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
          const response = await fetcher(url)
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
