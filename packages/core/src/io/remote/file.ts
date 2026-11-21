import { fileTypeFromBuffer } from 'file-type'
import { basename, extname } from 'pathe'
import { decode } from 'ufo'
import MIMEType from 'whatwg-mimetype'

import { IMPORTABLE_RASTER_TYPES } from '@open-pencil/scene-graph/images'
import { DEADLINE_MS } from '@open-pencil/std/timing'

import type { IORegistry } from '#core/io/registry'

import { readBoundedBody } from './body'
import { immediateRefresh } from './refresh'

/**
 * What a file fetched from an address is, as importing it needs to know: an HTML page, an SVG or
 * a raster image, a document a reader opens, a PDF, which nothing reads yet, or something else.
 */
export type RemoteFileKind = 'html' | 'svg' | 'image' | 'document' | 'pdf' | 'unsupported'

export interface RemoteFile {
  /** The address the file came from, after redirects, which a page's relative URLs resolve against. */
  url: string
  /** The file name its address ends in, decoded; empty for an address that names no file. */
  name: string
  /**
   * What the document it opens is called: the file name without its extension, or the host for
   * an address that names no file, as `https://example.com/` is a page called `example.com`.
   */
  title: string
  /** The media type the server sent, without parameters, in lowercase. */
  contentType?: string
  bytes: Uint8Array<ArrayBuffer>
  kind: RemoteFileKind
}

/**
 * The most a file fetched from an address may hold, and the one cap every document transfer
 * shares: URL opens, browser links, and the MCP server's `/files`. The body is counted as it
 * streams and buffered whole, so this bounds what one response can take; published design kits
 * run past 64 MiB, as Apple's iOS UI kit is about 160 MB.
 */
export const MAX_REMOTE_FILE_BYTES = 256 * 1024 * 1024

/**
 * How long one remote file may take to arrive, headers and body: a server that sends a byte now
 * and then never reaches the size cap, and must not hold an import open forever.
 */
export const REMOTE_FILE_DEADLINE_MS = DEADLINE_MS.transfer

export interface FetchRemoteFileOptions {
  /** The fetch to use, such as one that reaches sites a browser's cross-origin rules block. */
  fetch?: typeof globalThis.fetch
  signal?: AbortSignal
  maxBytes?: number
  /** The readers a fetched document may be opened with. */
  io: IORegistry
}

/** The decoded file name an address ends in; empty for one that names no file. */
function remoteFileName(url: URL): string {
  return decode(basename(url.pathname))
}

/** What a document fetched from an address is called; see `RemoteFile.title`. */
export function remoteFileTitle(url: URL): string {
  const name = remoteFileName(url)
  return name ? basename(name, extname(name)) : url.hostname
}

/** The essence of a `Content-Type` header, such as `text/html`; none for a missing or bad one. */
export function mediaType(header: string | null): string | undefined {
  return (header && MIMEType.parse(header)?.essence) ?? undefined
}

/** What a file is by its media type. */
const KIND_BY_TYPE: Readonly<Partial<Record<string, RemoteFileKind>>> = {
  'text/html': 'html',
  'application/xhtml+xml': 'html',
  'image/svg+xml': 'svg',
  'application/pdf': 'pdf'
}

/** Media types by extension, for files read without a server to name them. */
const TYPE_BY_EXTENSION: Readonly<Partial<Record<string, string>>> = {
  '.css': 'text/css',
  '.html': 'text/html',
  '.htm': 'text/html',
  '.xhtml': 'application/xhtml+xml',
  '.svg': 'image/svg+xml'
}

/**
 * The media type a file of this name is served as by its extension, as a file read from disk, or
 * one whose server sends a type that says nothing about it, such as a raw file host's
 * `text/plain`. None for an extension the importer does not tell apart.
 */
export function mediaTypeOfName(name: string): string | undefined {
  return TYPE_BY_EXTENSION[extname(name).toLowerCase()]
}

/** Media types that say nothing about what a file is. */
const GENERIC_TYPES = new Set(['text/plain', 'application/octet-stream'])

/**
 * What a fetched file is. A binary file says so in its first bytes, whatever the server called
 * it, so PDF and raster images are read from those; a design document by the name a reader opens;
 * and a page or an SVG by its media type, or by its extension when the type is generic or missing.
 */
export async function remoteFileKind(
  file: { name: string; contentType?: string; bytes: Uint8Array },
  io: IORegistry
): Promise<RemoteFileKind> {
  const { name, contentType, bytes } = file
  const detected = (await fileTypeFromBuffer(bytes))?.mime
  if (detected === 'application/pdf') return 'pdf'
  // Before the picture check: a reader may open a picture that carries a document, as a draw.io
  // PNG export such as `flow.drawio.png` carries its diagram.
  if (io.findReader(name)) return 'document'
  if (detected && IMPORTABLE_RASTER_TYPES.has(detected)) return 'image'
  const type = contentType && !GENERIC_TYPES.has(contentType) ? contentType : mediaTypeOfName(name)
  return (type === undefined ? undefined : KIND_BY_TYPE[type]) ?? 'unsupported'
}

/** The most `<meta http-equiv="refresh">` redirects followed for one address, as a loop guard. */
const MAX_REFRESHES = 5

/**
 * Fetches the file at an address, following redirects, and says what it is. A page that sends a
 * browser elsewhere at once with `<meta http-equiv="refresh" content="0; url=…">` is followed
 * too, as a browser follows it, so the page opened is the one a visitor sees. A response that is
 * not OK, has no body, or runs past `maxBytes` fails with a message that says which.
 */
export async function fetchRemoteFile(
  url: URL,
  options: FetchRemoteFileOptions
): Promise<RemoteFile> {
  let file = await fetchOnce(url, options)
  for (let hops = 0; file.kind === 'html' && hops < MAX_REFRESHES; hops++) {
    const target = immediateRefresh(new TextDecoder().decode(file.bytes), file.url)
    if (!target || target.href === file.url) break
    file = await fetchOnce(target, options)
  }
  return file
}

async function fetchOnce(
  url: URL,
  { fetch = globalThis.fetch, signal, maxBytes = MAX_REMOTE_FILE_BYTES, io }: FetchRemoteFileOptions
): Promise<RemoteFile> {
  // The cap needs a controller of its own; a caller's signal aborts it too, so the caller can
  // still cancel.
  const controller = new AbortController()
  signal?.throwIfAborted()
  signal?.addEventListener('abort', () => controller.abort(signal.reason), { once: true })
  const deadline = setTimeout(
    () => controller.abort(new DOMException('The file took too long to arrive', 'TimeoutError')),
    REMOTE_FILE_DEADLINE_MS
  )
  const { response, bytes } = await (async () => {
    try {
      const response = await fetch(url, { signal: controller.signal })
      if (!response.ok) {
        // Ends the body the server may still be sending; on desktop that ends the native request.
        controller.abort()
        throw new Error(`Failed to fetch ${url.href}: ${response.status} ${response.statusText}`)
      }
      const bytes = await readBoundedBody(response, maxBytes, {
        onExceeded: () => controller.abort()
      })
      return { response, bytes }
    } finally {
      clearTimeout(deadline)
    }
  })()
  if (bytes.byteLength === 0)
    throw new Error(`Failed to fetch ${url.href}: the response carried no body`)
  const finalURL = new URL(response.url || url.href)
  const name = remoteFileName(finalURL)
  const title = remoteFileTitle(finalURL)
  const contentType = mediaType(response.headers.get('content-type'))
  return {
    url: finalURL.href,
    name,
    title,
    contentType,
    bytes,
    kind: await remoteFileKind({ name, contentType, bytes }, io)
  }
}
