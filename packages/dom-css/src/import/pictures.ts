import { imageHeader, parseDataURL } from '@open-pencil/scene-graph/images'

import type { DesignElement } from '../types'

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
