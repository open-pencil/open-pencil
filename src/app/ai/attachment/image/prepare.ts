import type {
  ImageAttachmentMediaType,
  PreparedImageAttachment
} from '@/app/ai/attachment/image/types'
import { IMAGE_ATTACHMENT_MEDIA_TYPES } from '@/app/ai/attachment/image/types'
import { boundedImageScale } from '@/app/ai/tools/vision'

const MAX_IMAGE_FILE_BYTES = 20 * 1024 * 1024
const MAX_IMAGE_PIXELS = 40_000_000
export const IMAGE_ATTACHMENT_MAX_EDGE = 1280

export function isImageAttachmentMediaType(value: string): value is ImageAttachmentMediaType {
  return IMAGE_ATTACHMENT_MEDIA_TYPES.some((mediaType) => mediaType === value)
}

export function createImagePreviewURL(blob: Blob): string {
  if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {
    throw new TypeError('Image attachments are unavailable in this environment.')
  }
  return URL.createObjectURL(blob)
}

export function revokeImagePreviewURL(url: string): void {
  if (typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
    URL.revokeObjectURL(url)
  }
}

export function validateImageAttachmentFile(file: File): string | null {
  if (!isImageAttachmentMediaType(file.type)) return 'Choose a PNG, JPEG, or WebP image.'
  if (file.size > MAX_IMAGE_FILE_BYTES) return 'Images must be 20 MB or smaller.'
  return null
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Could not decode the image.'))
    image.src = url
  })
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  mediaType: ImageAttachmentMediaType,
  quality?: number
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob)
        else reject(new Error('Could not prepare the image.'))
      },
      mediaType,
      quality
    )
  })
}

/** Whether a file is an SVG image, which some systems report without a media type. */
export function isSVGFile(file: File): boolean {
  return (
    file.type === 'image/svg+xml' || (file.type === '' && file.name.toLowerCase().endsWith('.svg'))
  )
}

/** Whether a file can be attached as an image, as it is or after drawing an SVG as PNG. */
export function isAttachableImageFile(file: File): boolean {
  return file.type.startsWith('image/') || isSVGFile(file)
}

/** The square an SVG without its own size is drawn into, in pixels. */
const SVG_FALLBACK_EDGE = 512

/**
 * An SVG drawn as a PNG, since vision models take raster images. Its longer edge is drawn at the
 * attachment size, so small icons stay sharp; an `<img>` never runs the SVG's scripts.
 */
export async function rasterizeSVGAttachment(
  file: File,
  maxEdge = IMAGE_ATTACHMENT_MAX_EDGE
): Promise<File> {
  if (file.size > MAX_IMAGE_FILE_BYTES) throw new Error('Images must be 20 MB or smaller.')
  const sourceURL = createImagePreviewURL(new Blob([file], { type: 'image/svg+xml' }))
  try {
    const image = await loadImage(sourceURL)
    const naturalWidth = image.naturalWidth || SVG_FALLBACK_EDGE
    const naturalHeight = image.naturalHeight || SVG_FALLBACK_EDGE
    const scale = maxEdge / Math.max(naturalWidth, naturalHeight)
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(naturalWidth * scale))
    canvas.height = Math.max(1, Math.round(naturalHeight * scale))
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Could not prepare the image.')
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    const blob = await canvasToBlob(canvas, 'image/png')
    const name = file.name.replace(/\.svg$/i, '') + '.png'
    return new File([blob], name, { type: 'image/png' })
  } finally {
    revokeImagePreviewURL(sourceURL)
  }
}

export async function prepareImageAttachment(
  file: File,
  maxEdge = IMAGE_ATTACHMENT_MAX_EDGE
): Promise<PreparedImageAttachment> {
  const validationError = validateImageAttachmentFile(file)
  if (validationError) throw new Error(validationError)

  if (
    typeof URL === 'undefined' ||
    typeof URL.createObjectURL !== 'function' ||
    typeof Image === 'undefined' ||
    typeof document === 'undefined'
  ) {
    throw new TypeError('Image attachments are unavailable in this environment.')
  }

  const sourceURL = createImagePreviewURL(file)
  try {
    const image = await loadImage(sourceURL)
    if (image.naturalWidth * image.naturalHeight > MAX_IMAGE_PIXELS) {
      throw new Error('Image dimensions are too large.')
    }
    const scale = boundedImageScale(image.naturalWidth, image.naturalHeight, maxEdge)
    if (scale <= 0) throw new Error('Image has invalid dimensions.')

    const width = Math.max(1, Math.round(image.naturalWidth * scale))
    const height = Math.max(1, Math.round(image.naturalHeight * scale))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Could not prepare the image.')
    context.drawImage(image, 0, 0, width, height)
    if (!isImageAttachmentMediaType(file.type)) {
      throw new Error('Choose a PNG, JPEG, or WebP image.')
    }
    const mediaType = file.type
    const blob = await canvasToBlob(canvas, mediaType, mediaType === 'image/png' ? undefined : 0.88)

    return {
      data: new Uint8Array(await blob.arrayBuffer()),
      blob,
      mediaType,
      originalWidth: image.naturalWidth,
      originalHeight: image.naturalHeight,
      width,
      height
    }
  } finally {
    revokeImagePreviewURL(sourceURL)
  }
}
