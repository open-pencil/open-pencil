import type { Element as XMLElement } from '@xmldom/xmldom'
import { limitAsync } from 'es-toolkit'

import type { DesignDocument, DesignElement, DesignNode } from '@open-pencil/dom-css'
import { imageDataURL, imageHeader, parseDataURL } from '@open-pencil/scene-graph/images'

import { isElement } from '#core/icons/svg/presentation'
import { parseSVGDocument } from '#core/io/formats/svg/document'

import { designElements } from './elements'

/** Reads the bytes at a URL, or null when it cannot. */
export type PageImageFetch = (url: string, signal?: AbortSignal) => Promise<Uint8Array | null>

export interface EmbedPageImagesOptions {
  /** Where the page came from, which the sources of its images resolve against. */
  baseURL?: string
  fetch: PageImageFetch
  signal?: AbortSignal
  /** The most the page's pictures may hold together; past it, the rest keep their addresses. */
  maxBytes?: number
}

/** The most pictures read at once, so a page of many large ones is not all in flight together. */
const CONCURRENT_IMAGE_READS = 6

/** The most a page's pictures may hold together by default, as the HTML engine caps a page. */
export const MAX_PAGE_IMAGE_BYTES = 256 * 1024 * 1024

/** What a picture became: a raster image as a data URL, or an SVG's root element. */
type Picture = { kind: 'raster'; dataURL: string } | { kind: 'svg'; root: DesignElement }

/** An image source resolved against the page's address, or null for one with no address. */
function imageURL(source: string, baseURL: string | undefined): string | null {
  try {
    const url = new URL(source, baseURL)
    return url.protocol === 'data:' ? null : url.href
  } catch {
    return null
  }
}

/** An SVG element and what it holds, as the elements of a page's inline `<svg>` are. */
function svgElement(element: XMLElement): DesignElement {
  const attrs = Object.fromEntries(
    Array.from(element.attributes, (attribute) => [attribute.name, attribute.value])
  )
  const children: DesignNode[] = []
  for (const child of Array.from(element.childNodes)) {
    if (isElement(child)) children.push(svgElement(child))
    else if (child.nodeType === child.TEXT_NODE && child.nodeValue?.trim())
      children.push({ type: 'text', text: child.nodeValue })
  }
  return { type: 'element', tagName: element.tagName, attrs, children }
}

/** The root element of SVG markup, or null for bytes that hold no SVG. */
function svgRoot(bytes: Uint8Array): DesignElement | null {
  const root = parseSVGDocument(new TextDecoder().decode(bytes))?.documentElement
  return root ? svgElement(root) : null
}

/** What picture bytes hold, or null for neither a raster image nor SVG. */
function pictureOf(bytes: Uint8Array): Picture | null {
  if (imageHeader(bytes)) return { kind: 'raster', dataURL: imageDataURL(bytes) }
  const root = svgRoot(bytes)
  return root ? { kind: 'svg', root } : null
}

/**
 * Shows the picture in its `<img>`: a raster image as a data URL, as an image the page carried
 * inline is, and an SVG as the `<svg>` it holds, so it becomes vector layers as inline SVG does.
 * The element keeps its computed style and the box the page laid it out in.
 */
function show(image: DesignElement, picture: Picture): void {
  if (picture.kind === 'raster') {
    image.attrs.src = picture.dataURL
    return
  }
  const { root } = picture
  image.tagName = 'svg'
  image.attrs = { ...root.attrs, ...(image.attrs.class ? { class: image.attrs.class } : {}) }
  image.children = structuredClone(root.children)
}

/**
 * Fetches the pictures a page's `<img>` elements show and puts each in its element, so the layers
 * it becomes show the picture as an inline image or SVG would: a PNG, JPEG, GIF, WebP, or AVIF as
 * an image fill, an SVG as vector layers. An SVG written into `src` as a data URL is drawn too.
 * Each address is fetched once however many elements show it, a few at a time, and the pictures
 * together stay within `maxBytes`. One that fails, holds something else, or would pass the
 * budget stays its address, as the import keeps it.
 */
export async function embedPageImages(
  styled: DesignDocument,
  { baseURL, fetch, signal, maxBytes = MAX_PAGE_IMAGE_BYTES }: EmbedPageImagesOptions
): Promise<void> {
  const images = designElements(styled.children).filter(
    (element) => element.tagName.toLowerCase() === 'img' && element.attrs.src
  )
  let total = 0
  const read = limitAsync(async (url: string): Promise<Picture | null> => {
    if (signal?.aborted || total >= maxBytes) return null
    const bytes = await fetch(url, signal).catch(() => null)
    if (!bytes || total + bytes.byteLength > maxBytes) return null
    const picture = pictureOf(bytes)
    if (picture) total += bytes.byteLength
    return picture
  }, CONCURRENT_IMAGE_READS)
  const urls = new Map<string, Promise<Picture | null>>()
  const fetched = (url: string) => {
    let pending = urls.get(url)
    if (!pending) {
      pending = read(url)
      urls.set(url, pending)
    }
    return pending
  }
  await Promise.all(
    images.map(async (image) => {
      const { src } = image.attrs
      const inline = parseDataURL(src)
      if (inline) {
        // A raster data URL is drawn as it is; only SVG needs turning into its elements.
        const root = inline.mimeType === 'image/svg+xml' ? svgRoot(inline.bytes) : null
        if (root) show(image, { kind: 'svg', root })
        return
      }
      const url = imageURL(src, baseURL)
      const picture = url ? await fetched(url) : null
      if (picture) show(image, picture)
    })
  )
  signal?.throwIfAborted()
}
