/// <reference types="@figma/plugin-typings" />

import type { SceneGraph } from '@open-pencil/scene-graph'
import { computeImageHash, imageSize } from '@open-pencil/scene-graph/images'

/** The document's image under `hash`, as Figma's `Image` gives it to a script. */
function figmaImage(graph: SceneGraph, hash: string): Image {
  const bytes = (method: string) => {
    const data = graph.images.get(hash)
    if (!data) throw new Error(`in ${method}: The document has no image ${hash}`)
    return data
  }
  return {
    hash,
    getBytesAsync: async () => bytes('getBytesAsync').slice(),
    getSizeAsync: async () => {
      const size = imageSize(bytes('getSizeAsync'))
      if (!size) throw new Error('in getSizeAsync: Image type is unsupported')
      return size
    }
  }
}

/**
 * Stores a copy of encoded image bytes under their hash, as `figma.createImage` does, so a script
 * that reuses its array afterwards cannot change the stored image.
 */
export function storeImage(graph: SceneGraph, data: Uint8Array): Image {
  const stored = data.slice()
  const hash = computeImageHash(stored)
  graph.images.set(hash, stored)
  return figmaImage(graph, hash)
}

/** The image at `src`, fetched and stored as `figma.createImageAsync` does. */
export async function fetchImage(graph: SceneGraph, src: string): Promise<Image> {
  const response = await fetch(src).catch((error: unknown) => {
    const reason = error instanceof Error ? error.message : String(error)
    throw new Error(`in createImageAsync: Could not load ${src}: ${reason}`)
  })
  if (!response.ok) {
    throw new Error(`in createImageAsync: Could not load ${src}: HTTP ${response.status}`)
  }
  return storeImage(graph, new Uint8Array(await response.arrayBuffer()))
}
