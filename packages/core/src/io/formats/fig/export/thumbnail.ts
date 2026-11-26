import { toUint8Array } from 'js-base64'

import type { CanvasKit } from '@open-pencil/canvaskit'
import type { SceneGraph } from '@open-pencil/scene-graph'
import type { Rect, Size } from '@open-pencil/scene-graph/primitives'

import type { SkiaRenderer } from '#core/canvas'
import { IS_BROWSER, IS_TAURI } from '#core/constants'
import { renderThumbnail, thumbnailFrame } from '#core/io/formats/raster'

const THUMBNAIL_1X1 = toUint8Array(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=='
)

const THUMBNAIL_WIDTH = 512
const THUMBNAIL_HEIGHT = 512

/** How a `.fig` preview is drawn: with the editor's renderer, or headless outside the app. */
export interface FigThumbnailOptions {
  ck?: CanvasKit
  renderer?: SkiaRenderer
  renderHeadlessThumbnail?: boolean
}

/** The preview a `.fig` file carries, and the page region it shows. */
export interface FigThumbnail {
  png: Uint8Array
  size: Size
  /** The page-space rectangle the thumbnail shows; empty for the 1×1 placeholder. */
  region: Rect
}

function placeholderThumbnail(): FigThumbnail {
  return {
    png: THUMBNAIL_1X1,
    size: { width: 1, height: 1 },
    region: { x: 0, y: 0, width: 0, height: 0 }
  }
}

async function renderFigThumbnailPNG(
  graph: SceneGraph,
  pageId: string,
  options: FigThumbnailOptions
): Promise<Uint8Array | null> {
  const { ck, renderer } = options
  if (ck && renderer) {
    return renderThumbnail(ck, renderer, graph, pageId, THUMBNAIL_WIDTH, THUMBNAIL_HEIGHT)
  }
  if (!options.renderHeadlessThumbnail || IS_BROWSER || IS_TAURI) return null
  const { headlessRenderThumbnail } = await import('#core/io/formats/raster')
  return headlessRenderThumbnail(graph, pageId, THUMBNAIL_WIDTH, THUMBNAIL_HEIGHT)
}

/** The preview of `pageId`, or a 1×1 placeholder when there is nothing to draw or drawing fails. */
export async function renderFigThumbnail(
  graph: SceneGraph,
  pageId: string | undefined,
  options: FigThumbnailOptions
): Promise<FigThumbnail> {
  const frame = pageId ? thumbnailFrame(graph, pageId, THUMBNAIL_WIDTH, THUMBNAIL_HEIGHT) : null
  if (!pageId || !frame) return placeholderThumbnail()
  const png = await renderFigThumbnailPNG(graph, pageId, options).catch((error: unknown) => {
    console.warn('[.fig] Could not draw the file preview:', error)
    return null
  })
  if (!png) return placeholderThumbnail()
  const { minX, minY, maxX, maxY } = frame.bounds
  return {
    png,
    size: { width: frame.width, height: frame.height },
    region: { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
  }
}
