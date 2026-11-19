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

/**
 * How a background layer's picture fills the box, as its `background-size` and `background-repeat`
 * say: `cover` fills it, `contain` fits in it, and a picture repeated at its own size tiles it.
 */
function scaleMode(size: string | undefined, repeat: string | undefined): ImageScaleMode {
  const sizing = size?.trim().toLowerCase() ?? 'auto'
  if (sizing === 'cover') return 'FILL'
  if (sizing === 'contain') return 'FIT'
  const repeats = repeat !== undefined && !repeat.includes('no-repeat')
  return repeats && (sizing === 'auto' || sizing === 'auto auto') ? 'TILE' : 'FILL'
}

/**
 * The image fills an element's `background-image` layers paint, bottom to top as fills stack,
 * where CSS lists the top layer first: each a picture the runtime that styled the page loaded.
 * Gradients and pictures it did not load add none.
 */
export function backgroundImageFills(
  graph: SceneGraph,
  element: DesignElement,
  style: DesignStyleDeclaration
): Fill[] {
  const loaded = element.backgroundImages
  if (!loaded || loaded.length === 0) return []
  const layers = splitCSSLayers(pickStyle(style, 'background-image') ?? '')
  const sizes = splitCSSLayers(pickStyle(style, 'background-size') ?? '')
  const repeats = splitCSSLayers(pickStyle(style, 'background-repeat') ?? '')
  const fills: Fill[] = []
  for (const [index, layer] of layers.entries()) {
    const [url] = parseCSSURLs(layer)
    const bytes = url ? loaded.find((picture) => picture.url === url)?.bytes : undefined
    if (!bytes || !imageHeader(bytes)) continue
    const imageHash = computeImageHash(bytes)
    graph.images.set(imageHash, bytes)
    // A layer list shorter than the images repeats, as CSS repeats it.
    const at = (list: string[]) => (list.length > 0 ? list[index % list.length] : undefined)
    fills.unshift({
      type: 'IMAGE',
      imageHash,
      imageScaleMode: scaleMode(at(sizes), at(repeats)),
      color: TRANSPARENT,
      opacity: 1,
      visible: true
    })
  }
  return fills
}
