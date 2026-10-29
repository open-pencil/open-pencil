import type { Fill, ImageScaleMode, SceneGraph } from '@open-pencil/scene-graph'
import { BLACK } from '@open-pencil/scene-graph/constants'
import { coverImageTransform, computeImageHash, imageSize } from '@open-pencil/scene-graph/images'
import type { Matrix, Size } from '@open-pencil/scene-graph/primitives'

import type { PenImagePaint } from './schema'

/** An image a paint draws: its bytes' name in the graph and its size in pixels. */
export interface PenImage {
  hash: string
  size: Size | null
}

/** The images a document's paints name, by URL. */
export interface PenImages {
  get(url: string): PenImage | undefined
}

/** Stores the images a host loaded, by the URLs paints name them with; others stay unpainted. */
export function createImageStore(
  graph: SceneGraph,
  files: ReadonlyMap<string, Uint8Array> = new Map()
): PenImages {
  const byURL = new Map<string, PenImage | undefined>()
  const store = (bytes: Uint8Array): PenImage => {
    const hash = computeImageHash(bytes)
    graph.images.set(hash, bytes)
    // A header declaring no pixels gives no size to fit a crop to.
    const size = imageSize(bytes)
    return { hash, size: size && size.width > 0 && size.height > 0 ? size : null }
  }
  return {
    get(url) {
      if (byURL.has(url)) return byURL.get(url)
      const file = files.get(url)
      const image = file ? store(file) : undefined
      byURL.set(url, image)
      return image
    }
  }
}

/** pen.dev's affine `[a, b, c, d, tx, ty]`, inverted, as the scene graph's matrix. */
function invertAffine([a, b, c, d, tx, ty]: readonly number[]): Matrix | null {
  const det = a * d - b * c
  if (Math.abs(det) < 1e-12) return null
  return {
    m00: d / det,
    m01: -c / det,
    m02: (c * ty - d * tx) / det,
    m10: -b / det,
    m11: a / det,
    m12: (b * tx - a * ty) / det
  }
}

function compose(outer: Matrix, inner: Matrix): Matrix {
  return {
    m00: outer.m00 * inner.m00 + outer.m01 * inner.m10,
    m01: outer.m00 * inner.m01 + outer.m01 * inner.m11,
    m02: outer.m00 * inner.m02 + outer.m01 * inner.m12 + outer.m02,
    m10: outer.m10 * inner.m00 + outer.m11 * inner.m10,
    m11: outer.m10 * inner.m01 + outer.m11 * inner.m11,
    m12: outer.m10 * inner.m02 + outer.m11 * inner.m12 + outer.m12
  }
}

const IDENTITY: Matrix = { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 }

/**
 * Where an image paint draws. `cover` and `contain` are Fill and Fit, and `stretch` a crop of the
 * whole image. pen.dev's `transform` crops the image first and fits the crop as it would a whole
 * image; the scene graph has that as a crop of the image's window, which needs the image's size
 * when the crop is covered. A crop fitted with `contain` is drawn covered, since a crop cannot
 * leave the bars `contain` shows beside it.
 */
function placement(
  paint: PenImagePaint,
  image: PenImage,
  box: Size
): { imageScaleMode: ImageScaleMode; imageTransform?: Matrix } {
  const mode = paint.mode ?? 'cover'
  const crop = paint.transform ? invertAffine(paint.transform) : null
  if (!crop) {
    if (mode === 'stretch') return { imageScaleMode: 'CROP', imageTransform: IDENTITY }
    return { imageScaleMode: mode === 'contain' ? 'FIT' : 'FILL' }
  }
  if (mode === 'stretch' || !image.size) return { imageScaleMode: 'CROP', imageTransform: crop }
  const cropWidth = image.size.width * Math.hypot(crop.m00, crop.m10)
  const cropHeight = image.size.height * Math.hypot(crop.m01, crop.m11)
  const covered = coverImageTransform(box.width, box.height, cropWidth, cropHeight)
  return { imageScaleMode: 'CROP', imageTransform: compose(crop, covered) }
}

export function imagePaint(
  paint: PenImagePaint,
  image: PenImage,
  box: Size,
  opacity: number
): Fill {
  return {
    type: 'IMAGE',
    color: { ...BLACK },
    opacity,
    visible: true,
    imageHash: image.hash,
    ...placement(paint, image, box)
  }
}
