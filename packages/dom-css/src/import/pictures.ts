import { parseCSSURLs } from '@open-pencil/scene-graph/css'
import { imageHeader, parseDataURL } from '@open-pencil/scene-graph/images'

import type { DesignElement } from '../types'
import { mergedStyle, pickStyle } from './css-values'

/** What an `<img>` shows: a raster image's bytes, or an SVG's markup. */
export type ImagePicture = { kind: 'raster'; bytes: Uint8Array } | { kind: 'svg'; markup: string }

const SVG_TYPE = 'image/svg+xml'

/**
 * The picture an `<img>` shows: the one its runtime loaded, or the one its `src` holds as a data
 * URL. A PNG, JPEG, GIF, WebP, or AVIF is a raster image by its header; SVG is SVG by its media
 * type, as a browser shows SVG in an image only when it is served as `image/svg+xml`. Null for an
 * element that is no image or shows nothing it can draw.
 */
export function imagePicture(element: DesignElement): ImagePicture | null {
  if (element.tagName.toLowerCase() !== 'img') return null
  const loaded = element.image
  const inline = loaded ? null : parseDataURL(element.attrs.src)
  const bytes = loaded?.bytes ?? inline?.bytes
  if (!bytes) return null
  if (imageHeader(bytes)) return { kind: 'raster', bytes }
  const type = loaded ? loaded.contentType : inline?.mimeType
  return type === SVG_TYPE ? { kind: 'svg', markup: new TextDecoder().decode(bytes) } : null
}

/** SVG an element draws, and for a mask, the color its shapes take. */
export interface ElementSVG {
  markup: string
  /** The element's background, which shows through a mask's shapes and nowhere else. */
  paint?: string
}

/**
 * The SVG an element's `mask-image` holds as a data URL, as CSS icons such as Iconify's and
 * VitePress's draw: the background shows through its shapes. Null for any other mask.
 */
export function maskSVG(element: DesignElement): ElementSVG | null {
  const style = mergedStyle(element)
  const url = parseCSSURLs(pickStyle(style, 'mask-image')).at(0)
  const data = url ? parseDataURL(url) : null
  if (data?.mimeType !== SVG_TYPE) return null
  return {
    markup: new TextDecoder().decode(data.bytes),
    paint: pickStyle(style, 'background-color')
  }
}

/** The SVG an element draws: the picture an `<img>` shows, or the mask its background shows through. */
export function elementSVG(element: DesignElement): ElementSVG | null {
  const picture = imagePicture(element)
  if (picture?.kind === 'svg') return { markup: picture.markup }
  return maskSVG(element)
}
