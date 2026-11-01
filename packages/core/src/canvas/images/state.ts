import type { Image, Surface } from 'canvaskit-wasm'

import type { SceneGraph } from '@open-pencil/scene-graph'

import { createImageCache } from './cache'
import { ImagePreviewCache } from './previews'

/** The images a renderer holds decoded, live, or as previews, and what they were drawn for. */
export interface RendererImages {
  cache: ReturnType<typeof createImageCache<Image>>
  /**
   * Images drawn in place of stored ones while they play, such as a shader's live frames, each
   * with the surface whose GL context holds its texture.
   */
  readonly live: Map<string, { image: Image; surface: Surface }>
  /** The document and page whose images the cache and previews hold. */
  memoryGraph: SceneGraph | null
  memoryPage: string | null
  onPreviewReady: ((hash: string) => void) | null
  readonly previews: ImagePreviewCache
  /**
   * Device pixels per world unit the drawing in progress is for: the viewport's scale in a frame,
   * a tile's level while it records. Image previews are chosen at this detail, so a picture that
   * drew them is recorded again when a finer tile asks for more.
   */
  detailScale: number
  /** Whether the drawing in progress drew an image preview; chunk pictures note it to re-record. */
  previewsDrawn: boolean
  /** Nodes whose image fills drew each image while previews were on, for redrawing them sharper. */
  readonly fillUsers: Map<string, Set<string>>
  /** Images whose sharper preview has decoded since the last frame. */
  readonly decodedPreviewHashes: Set<string>
}

export function createRendererImages(): RendererImages {
  const images: RendererImages = {
    cache: createImageCache(),
    live: new Map(),
    memoryGraph: null,
    memoryPage: null,
    onPreviewReady: null,
    previews: new ImagePreviewCache((hash) => {
      images.decodedPreviewHashes.add(hash)
      images.onPreviewReady?.(hash)
    }),
    detailScale: 1,
    previewsDrawn: false,
    fillUsers: new Map(),
    decodedPreviewHashes: new Set()
  }
  return images
}
