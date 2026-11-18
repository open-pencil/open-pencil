import { basename, extname } from 'pathe'
import { decode } from 'ufo'

import { imageHeader } from '@open-pencil/scene-graph/images'

import type { IORegistry } from '#core/io/registry'

import { readBoundedBody } from './body'

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

/** The most a file fetched from an address may hold. Well past any real page or design file. */
export const MAX_REMOTE_FILE_BYTES = 64 * 1024 * 1024

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

function mediaType(contentType: string | null): string | undefined {
  const type = contentType?.split(';')[0]?.trim().toLowerCase()
  return type || undefined
}

const HTML_TYPES = new Set(['text/html', 'application/xhtml+xml'])

/** How far into a file its markup is looked for, past a byte order mark, comments, and space. */
const MARKUP_SNIFF_BYTES = 64 * 1024

/**
 * The start of text bytes, without a byte order mark, comments, or leading space, in lowercase.
 * Comments are dropped whole within the first `MARKUP_SNIFF_BYTES`, so a long licence header
 * before an SVG's root does not hide it.
 */
function leadingText(bytes: Uint8Array): string {
  return new TextDecoder()
    .decode(bytes.subarray(0, MARKUP_SNIFF_BYTES))
    .replace(/^\uFEFF/, '')
    .replace(/^(?:\s|<!--[\s\S]*?-->)+/, '')
    .slice(0, 1024)
    .toLowerCase()
}

/** An SVG's start: an optional XML declaration and SVG document type, then its root. */
const SVG_START =
  /^(?:<\?xml[^>]*>\s*)?(?:<!--[\s\S]*?-->\s*)*(?:<!doctype svg[^>]*>\s*)?(?:<!--[\s\S]*?-->\s*)*<svg[\s>]/

/**
 * What a fetched file is, from what it holds first: PDF and image bytes say so themselves, which a
 * server's media type may not, as a raw file host serves everything as `text/plain` or
 * `application/octet-stream`. Then a design document a reader opens by its name, then the media
 * type, and last the markup a page or an SVG starts with.
 */
export function remoteFileKind(
  file: { name: string; contentType?: string; bytes: Uint8Array },
  io: IORegistry
): RemoteFileKind {
  const { name, contentType, bytes } = file
  if (new TextDecoder().decode(bytes.subarray(0, 5)) === '%PDF-') return 'pdf'
  if (imageHeader(bytes)) return 'image'
  if (contentType === 'application/pdf') return 'pdf'
  if (io.findReader(name)) return 'document'
  if (contentType === 'image/svg+xml') return 'svg'
  if (contentType && HTML_TYPES.has(contentType)) return 'html'
  const text = leadingText(bytes)
  if (SVG_START.test(text)) return 'svg'
  if (/^<(?:!doctype html|html|head|body)[\s>]/.test(text)) return 'html'
  return 'unsupported'
}

/**
 * Fetches the file at an address, following redirects, and says what it is. A response that is
 * not OK, has no body, or runs past `maxBytes` fails with a message that says which.
 */
export async function fetchRemoteFile(
  url: URL,
  { fetch = globalThis.fetch, signal, maxBytes = MAX_REMOTE_FILE_BYTES, io }: FetchRemoteFileOptions
): Promise<RemoteFile> {
  // The cap needs a controller of its own, so a caller's signal is combined with it rather than
  // replaced: dropping it would leave the caller unable to cancel.
  const controller = new AbortController()
  const response = await fetch(url, {
    signal: signal ? AbortSignal.any([signal, controller.signal]) : controller.signal
  })
  if (!response.ok)
    throw new Error(`Failed to fetch ${url.href}: ${response.status} ${response.statusText}`)
  const bytes = await readBoundedBody(response, maxBytes, { onExceeded: () => controller.abort() })
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
    kind: remoteFileKind({ name, contentType, bytes }, io)
  }
}
