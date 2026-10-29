import { clamp } from 'es-toolkit'

import { CLOUD_PICTURE_SIZE } from '@open-pencil/cloud/contract'
import type { Size } from '@open-pencil/scene-graph/primitives'

/** How far past filling the frame a picture can be zoomed. */
export const PICTURE_MAX_ZOOM = 4
/** JPEG quality for an uploaded picture, which keeps a 256-pixel photo near 30 KB. */
const PICTURE_QUALITY = 0.9

/**
 * Where a picture sits in a square frame: `zoom` 1 fills the frame with its shorter side, and
 * `x` and `y` place its top-left corner, in frame pixels, never leaving a gap in the frame.
 */
export type PictureCrop = { zoom: number; x: number; y: number }

/** How many frame pixels one picture pixel takes at `zoom`. */
export function pictureScale(picture: Size, frame: number, zoom: number): number {
  return (frame / Math.min(picture.width, picture.height)) * zoom
}

/** `crop` moved back inside the picture, so the frame shows picture everywhere. */
export function clampCrop(picture: Size, frame: number, crop: PictureCrop): PictureCrop {
  const zoom = clamp(crop.zoom, 1, PICTURE_MAX_ZOOM)
  const scale = pictureScale(picture, frame, zoom)
  return {
    zoom,
    x: clamp(crop.x, frame - picture.width * scale, 0),
    y: clamp(crop.y, frame - picture.height * scale, 0)
  }
}

/** The picture centred in the frame at `zoom`. */
export function centredCrop(picture: Size, frame: number, zoom = 1): PictureCrop {
  const scale = pictureScale(picture, frame, zoom)
  return clampCrop(picture, frame, {
    zoom,
    x: (frame - picture.width * scale) / 2,
    y: (frame - picture.height * scale) / 2
  })
}

/** `crop` at a new zoom, keeping the point under the frame's centre where it is. */
export function zoomCrop(
  picture: Size,
  frame: number,
  crop: PictureCrop,
  zoom: number
): PictureCrop {
  const ratio = clamp(zoom, 1, PICTURE_MAX_ZOOM) / crop.zoom
  const centre = frame / 2
  return clampCrop(picture, frame, {
    zoom,
    x: centre - (centre - crop.x) * ratio,
    y: centre - (centre - crop.y) * ratio
  })
}

/** The square of the picture, in its own pixels, that the frame shows. */
export function cropRegion(picture: Size, frame: number, crop: PictureCrop) {
  const scale = pictureScale(picture, frame, crop.zoom)
  return { x: (0 - crop.x) / scale, y: (0 - crop.y) / scale, size: frame / scale }
}

/**
 * The square `region` of `source` as the JPEG the server keeps: 256 pixels a side, on white so
 * a transparent picture keeps its look.
 */
export function encodePicture(
  source: CanvasImageSource,
  region: { x: number; y: number; size: number }
): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = CLOUD_PICTURE_SIZE
  canvas.height = CLOUD_PICTURE_SIZE
  const context = canvas.getContext('2d')
  if (!context) return Promise.reject(new Error('The browser can’t draw the picture'))
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, CLOUD_PICTURE_SIZE, CLOUD_PICTURE_SIZE)
  context.imageSmoothingQuality = 'high'
  context.drawImage(
    source,
    region.x,
    region.y,
    region.size,
    region.size,
    0,
    0,
    CLOUD_PICTURE_SIZE,
    CLOUD_PICTURE_SIZE
  )
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob)
        else reject(new Error('The browser can’t encode the picture'))
      },
      'image/jpeg',
      PICTURE_QUALITY
    )
  })
}
