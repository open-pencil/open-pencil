import { pngSize } from '@open-pencil/fig'

/**
 * The bytes when they are a PNG preview with a drawing in it; null when missing, not a PNG, or
 * the 1×1 placeholder a .fig saved without a rendered cover embeds.
 */
export function usablePreview(bytes: Uint8Array | null | undefined): Uint8Array | null {
  if (!bytes) return null
  const size = pngSize(bytes)
  return size && size.width > 1 && size.height > 1 ? bytes : null
}
