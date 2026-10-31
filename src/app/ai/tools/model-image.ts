import { fromUint8Array, toUint8Array } from 'js-base64'

import { getCanvasKit } from '@open-pencil/core/canvaskit'
import { reencodeImage } from '@open-pencil/core/io/formats/raster'
import type { ModelImage } from '@open-pencil/core/tools'

/** The export default for WebP, measured on design renders against their PNGs in `ai-chat.md`. */
const WEBP_QUALITY = 90

/**
 * A tool's PNG as WebP, for a provider that documents WebP input. The PNG stays when it is the
 * smaller of the two, as flat renders can be, or when the image is not a PNG.
 */
export async function encodeWebPModelImage(image: ModelImage): Promise<ModelImage> {
  if (image.mediaType !== 'image/png') return image
  const png = toUint8Array(image.data)
  const webp = reencodeImage(await getCanvasKit(), png, 'WEBP', WEBP_QUALITY)
  return webp && webp.length < png.length
    ? { data: fromUint8Array(webp), mediaType: 'image/webp' }
    : image
}
