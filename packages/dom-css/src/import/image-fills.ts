import type { Fill, ImageScaleMode, SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import { TRANSPARENT } from '@open-pencil/scene-graph/constants'
import { parseCSSURLs, splitCSSLayers } from '@open-pencil/scene-graph/css'
import { computeImageHash, imageHeader } from '@open-pencil/scene-graph/images'

import type { DesignElement, DesignStyleDeclaration } from '../types'
import { pickStyle } from './css-values'
import { imagePicture } from './pictures'

const DOM_CSS_PLUGIN_ID = 'open-pencil-dom-css'
const IMAGE_SOURCE_URL_KEY = 'image-source-url'

function imageScaleModeFromObjectFit(value: string | undefined): ImageScaleMode | null {
  if (value === 'contain' || value === 'scale-down') return 'FIT'
  if (value === 'cover') return 'FILL'
  return null
}

/** Fills an `<img>` with the picture it shows, or keeps its address when nothing could draw it. */
export function applyImageFill(
  graph: SceneGraph,
  node: SceneNode,
  element: DesignElement,
  style: DesignStyleDeclaration
): void {
  if (element.tagName.toLowerCase() !== 'img') return
  const source = element.attrs.src
  const picture = imagePicture(element)
  // A picture nothing could draw keeps its address, which exporting the layer writes back.
  if (picture?.kind !== 'raster') {
    if (source) {
      node.pluginData.push({
        pluginId: DOM_CSS_PLUGIN_ID,
        key: IMAGE_SOURCE_URL_KEY,
        value: source
      })
    }
    return
  }

  const { bytes } = picture
  const imageHash = computeImageHash(bytes)
  graph.images.set(imageHash, bytes)
  node.fills = [
    {
      type: 'IMAGE',
      imageHash,
      imageScaleMode: imageScaleModeFromObjectFit(pickStyle(style, 'object-fit')) ?? 'FILL',
      color: TRANSPARENT,
      opacity: 1,
      visible: true
    }
  ]
}

/** Whether a background layer repeats its picture at the picture's own size, as a tile does. */
function tiles(size: string | undefined, repeat: string | undefined): boolean {
  const sizing = size?.trim().toLowerCase() ?? 'auto'
  const repeats = repeat !== undefined && !repeat.includes('no-repeat')
  return repeats && (sizing === 'auto' || sizing === 'auto auto')
}

/**
 * A background picture to place once its layer has its final size, where its `background-size`
 * and `background-position` put it: see `placeBackgroundPictures`.
 */
export interface BackgroundPicture {
  nodeId: string
  imageHash: string
  /** The picture's own size, in pixels. */
  width: number
  height: number
  size: string
  position: string
}

/**
 * The image fills an element's `background-image` layers paint, bottom to top as fills stack,
 * where CSS lists the top layer first: each a picture the runtime that styled the page loaded. A
 * picture repeated at its own size tiles the layer now; any other is added to `pictures`, to be
 * placed once the layer has its size. Gradients and pictures the runtime did not load add none.
 */
export function backgroundImageFills(
  graph: SceneGraph,
  node: SceneNode,
  element: DesignElement,
  style: DesignStyleDeclaration,
  pictures: BackgroundPicture[]
): Fill[] {
  const loaded = element.backgroundImages
  if (!loaded || loaded.length === 0) return []
  const layers = splitCSSLayers(pickStyle(style, 'background-image') ?? '')
  const sizes = splitCSSLayers(pickStyle(style, 'background-size') ?? '')
  const positions = splitCSSLayers(pickStyle(style, 'background-position') ?? '')
  const repeats = splitCSSLayers(pickStyle(style, 'background-repeat') ?? '')
  const fills: Fill[] = []
  // Bottom layer first, as fills stack and as the placed pictures are added.
  for (const [index, layer] of [...layers.entries()].toReversed()) {
    const [url] = parseCSSURLs(layer)
    const bytes = url ? loaded.find((picture) => picture.url === url)?.bytes : undefined
    const header = bytes && imageHeader(bytes)
    if (!bytes || !header) continue
    const imageHash = computeImageHash(bytes)
    graph.images.set(imageHash, bytes)
    // A layer list shorter than the images repeats, as CSS repeats it.
    const at = (list: string[]) => (list.length > 0 ? list[index % list.length] : undefined)
    if (tiles(at(sizes), at(repeats))) {
      fills.push({
        type: 'IMAGE',
        imageHash,
        imageScaleMode: 'TILE',
        color: TRANSPARENT,
        opacity: 1,
        visible: true
      })
      continue
    }
    pictures.push({
      nodeId: node.id,
      imageHash,
      width: header.width,
      height: header.height,
      size: at(sizes) ?? 'auto',
      position: at(positions) ?? '0% 0%'
    })
  }
  return fills
}
