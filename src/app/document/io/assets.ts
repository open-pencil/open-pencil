import type { IORegistry } from '@open-pencil/core/io'
import { collectPenAssetUrls, isDocumentAssetName } from '@open-pencil/pen'

import { isTauri } from '@/app/tauri/env'

/** Answers a document's image lookups from bytes already read. */
export type PenAssetResolver = (url: string) => Uint8Array | undefined

/** Reports how many assets have been read, so the loading screen can show progress. */
export type PenAssetProgress = (completed: number, total: number) => void

/** Bounds one image, so a single huge or slow one cannot hold up the open. */
const MAX_IMAGE_BYTES = 32 * 1024 * 1024
const IMAGE_TIMEOUT_MS = 20_000
/** Assets come from unrelated hosts, so a few at a time is enough and kinder to them. */
const CONCURRENCY = 6

/** A reference the document's own folder cannot answer, such as a remote image. */
function isRemoteAsset(url: string): boolean {
  return /^https?:/i.test(url)
}

async function fetchRemote(url: string, signal?: AbortSignal): Promise<Uint8Array | undefined> {
  if (isTauri()) {
    const { tauriFetch } = await import('@/app/tauri/http')
    const response = await tauriFetch(url, { signal }, MAX_IMAGE_BYTES, IMAGE_TIMEOUT_MS)
    return response.ok ? new Uint8Array(await response.arrayBuffer()) : undefined
  }
  // A browser fetch bounds neither time nor size, so one host that never answers would hold the
  // whole open and one huge image would fill memory. Both bounds are applied here instead.
  const timeout = AbortSignal.timeout(IMAGE_TIMEOUT_MS)
  const response = await fetch(url, {
    signal: signal === undefined ? timeout : AbortSignal.any([signal, timeout])
  })
  return response.ok ? readBoundedBody(response, MAX_IMAGE_BYTES) : undefined
}

/**
 * Reads a response body, or answers nothing when it is longer than `maxBytes`. The limit is
 * enforced while reading rather than afterwards: a server may declare no length, and buffering it
 * first would already have spent the memory the limit exists to protect.
 */
export async function readBoundedBody(
  response: Response,
  maxBytes: number
): Promise<Uint8Array | undefined> {
  const declared = Number(response.headers.get('content-length') ?? '')
  if (declared > maxBytes) return undefined
  if (response.body === null) {
    const buffer = await response.arrayBuffer()
    return buffer.byteLength > maxBytes ? undefined : new Uint8Array(buffer)
  }

  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > maxBytes) {
      await reader.cancel()
      return undefined
    }
    chunks.push(value)
  }

  const bytes = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return bytes
}

async function readLocal(url: string, folder: string): Promise<Uint8Array | undefined> {
  if (!isDocumentAssetName(url)) {
    console.warn(`[pen] Skipping the image "${url}": it is not a file in the document's folder`)
    return undefined
  }
  const [{ join }, { readFile, stat }] = await Promise.all([
    import('@tauri-apps/api/path'),
    import('@tauri-apps/plugin-fs')
  ])
  const path = await join(folder, url)
  // A file on disk is bounded like a download, so one huge asset cannot fill memory either.
  const { size } = await stat(path)
  if (size > MAX_IMAGE_BYTES) {
    console.warn(`[pen] Skipping the image "${url}": it is larger than ${MAX_IMAGE_BYTES} bytes`)
    return undefined
  }
  return readFile(path)
}

/**
 * Reads one asset. A remote reference goes over the network; a relative one is read next to the
 * document, which only the desktop build can do. Anything unreadable answers nothing, so the fill
 * it belongs to opens without pixels instead of failing the document.
 */
async function readAsset(
  url: string,
  folder: string | undefined,
  signal?: AbortSignal
): Promise<Uint8Array | undefined> {
  try {
    if (isRemoteAsset(url)) return await fetchRemote(url, signal)
    return folder === undefined ? undefined : await readLocal(url, folder)
  } catch (error) {
    console.warn(`[pen] Could not read the image "${url}"`, error)
    return undefined
  }
}

/**
 * Reads every asset the document references, a few at a time, reporting progress as it goes.
 *
 * Reading them all before the document is parsed is what lets the importer name each image fill
 * with the bytes it already has, so nothing has to be fetched once the design is on screen.
 */
async function readAssets(
  urls: readonly string[],
  folder: string | undefined,
  onProgress?: PenAssetProgress,
  signal?: AbortSignal
): Promise<PenAssetResolver> {
  const assets = new Map<string, Uint8Array>()
  let completed = 0
  const laneCount = Math.min(CONCURRENCY, urls.length)
  const lanes = Array.from({ length: laneCount }, (_, lane) =>
    urls.filter((_, index) => index % laneCount === lane)
  )

  await Promise.all(
    lanes.map(async (lane) => {
      for (const url of lane) {
        // A cancelled open stops reading: the rest of its images are no longer wanted.
        if (signal?.aborted === true) return
        const bytes = await readAsset(url, folder, signal)
        if (bytes) assets.set(url, bytes)
        completed += 1
        onProgress?.(completed, urls.length)
      }
    })
  )

  return (url) => assets.get(url)
}

/** The folder a document's own relative assets resolve from. */
async function documentFolder(filePath: string): Promise<string | undefined> {
  if (!isTauri()) return undefined
  const { dirname } = await import('@tauri-apps/api/path')
  return dirname(filePath)
}

/**
 * Reads a document through the IO registry, with every asset it references already in hand.
 *
 * Opening waits for them, on purpose: a `.pen` document points at its images instead of carrying
 * them, so fetching afterwards would paint the design first and fill it in later. The loading
 * screen is where that wait belongs.
 */
export async function readDocumentWithAssets(
  io: IORegistry,
  file: File,
  filePath: string | undefined,
  onProgress?: PenAssetProgress,
  signal?: AbortSignal
) {
  const data = new Uint8Array(await file.arrayBuffer())
  const isPen = (filePath ?? file.name).toLowerCase().endsWith('.pen')
  const urls = isPen ? collectPenAssetUrls(new TextDecoder().decode(data)) : []
  const folder = filePath === undefined ? undefined : await documentFolder(filePath)
  const resolveAsset = await readAssets(urls, folder, onProgress, signal)
  // A cancelled open stops here instead of showing a document whose images were given up on.
  signal?.throwIfAborted()
  return io.readDocument(
    { name: file.name, mimeType: file.type || undefined, data },
    { resolveAsset }
  )
}
