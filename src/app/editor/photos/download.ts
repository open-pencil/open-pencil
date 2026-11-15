import { getStockPhotoProvider, type StockPhotoResult } from '@open-pencil/core/tools'
import { IMPORTABLE_RASTER_TYPES } from '@open-pencil/scene-graph/images'

import type { PhotoService } from './search'

/**
 * Downloads `photo` at the size it is placed at and tells its service it was used, as Unsplash's
 * terms ask; a failed report does not stop the photo.
 */
export async function downloadPhoto(service: PhotoService, photo: StockPhotoResult) {
  const response = await fetch(photo.url)
  if (!response.ok) throw new Error(`Download ${response.status}`)
  // "image/jpeg; charset=binary" is still a JPEG; anything that cannot be placed fails here,
  // before the service is told the photo was used.
  const type = (response.headers.get('content-type') ?? 'image/jpeg')
    .split(';')[0]
    .trim()
    .toLowerCase()
  if (!IMPORTABLE_RASTER_TYPES.has(type)) throw new Error(`Unsupported photo type ${type}`)
  const bytes = new Uint8Array(await response.arrayBuffer())
  void getStockPhotoProvider(service)
    ?.reportUse?.(photo)
    .catch(() => undefined)
  return { bytes, type }
}
