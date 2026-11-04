import type { NodeChange, PluginData } from '@open-pencil/kiwi/fig/codec'
import { computeImageHash } from '@open-pencil/scene-graph/images'
import {
  OPEN_PENCIL_PLUGIN_DATA,
  OPEN_PENCIL_PLUGIN_ID
} from '@open-pencil/scene-graph/plugin-data'

import { bytesToHex, hexToBytes } from './bytes'

/** The fields of a paint that reference an image. */
const IMAGE_FIELDS = ['image', 'imageThumbnail', 'animatedImage'] as const

const { shader } = OPEN_PENCIL_PLUGIN_DATA

/** An image reference as a written paint holds it. */
export interface ImageReference {
  hash?: Uint8Array | string
  dataBlob?: number
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !ArrayBuffer.isView(value)
}

function isImageReference(value: unknown): value is ImageReference {
  return isRecord(value) && 'hash' in value
}

function isPluginData(value: unknown): value is PluginData {
  return isRecord(value) && 'pluginID' in value && 'key' in value
}

/**
 * Calls `visit` with every image reference and every plugin-data entry in `value`, however deep:
 * paints sit in fills, strokes, backgrounds, text and vector style overrides, and instance
 * overrides, and plugin data on records and overrides alike.
 */
function walk(
  value: unknown,
  visit: { image: (image: ImageReference) => void; pluginData: (entry: PluginData) => void }
): void {
  if (Array.isArray(value)) {
    for (const item of value) walk(item, visit)
    return
  }
  if (!isRecord(value)) return
  if (isPluginData(value)) {
    visit.pluginData(value)
    return
  }
  for (const field of IMAGE_FIELDS) {
    const image = value[field]
    if (isImageReference(image)) visit.image(image)
  }
  for (const child of Object.values(value)) walk(child, visit)
}

/** Every image reference the records' paints hold. */
export function forEachImageReference(
  changes: readonly NodeChange[],
  visit: (image: ImageReference) => void
): void {
  walk(changes, { image: visit, pluginData: () => undefined })
}

function referenceName(image: ImageReference): string | null {
  if (image.hash === undefined) return null
  return typeof image.hash === 'string' ? image.hash : bytesToHex(image.hash)
}

/**
 * Figma reads an image only under the SHA-1 of its bytes. A document may hold images under other
 * names: a shader's still frame under a name of its own, which stays while the frame is redrawn,
 * and images saved before images were named by their SHA-1. Points every image reference in
 * `changes` at its SHA-1, along with the shader plugin data that names a paint's image, so the
 * shader still finds its paint when the file is read back. Returns the new name of every image
 * renamed; references to images `images` lacks are left as they are.
 */
export function nameImagesForFigma(
  changes: readonly NodeChange[],
  images: ReadonlyMap<string, Uint8Array>
): Map<string, string> {
  const names = new Map<string, string>()
  const figmaName = (name: string): string | null => {
    const known = names.get(name)
    if (known) return known
    const bytes = images.get(name)
    if (!bytes) return null
    const hash = computeImageHash(bytes)
    names.set(name, hash)
    return hash
  }
  walk(changes, {
    image(image) {
      const name = referenceName(image)
      const renamed = name ? figmaName(name) : null
      if (!renamed || renamed === name) return
      image.hash = typeof image.hash === 'string' ? renamed : hexToBytes(renamed)
    },
    pluginData(entry) {
      if (entry.pluginID !== OPEN_PENCIL_PLUGIN_ID || entry.key !== shader.key) return
      const paint = shader.decode(entry.value)
      const renamed = paint ? figmaName(paint.image) : null
      if (!paint || !renamed || renamed === paint.image) return
      entry.value = shader.encode({ ...paint, image: renamed })
    }
  })
  return names
}

/**
 * `images` as a `.fig` archive stores them: each under the name `names` gave it, or the SHA-1 of
 * its bytes when no record references it, and each name once, so images that were stored twice
 * under different names are written once.
 */
export function figImageEntries(
  images: ReadonlyMap<string, Uint8Array>,
  names: ReadonlyMap<string, string>
): Array<{ name: string; data: Uint8Array }> {
  const entries = new Map<string, Uint8Array>()
  for (const [name, data] of images) entries.set(names.get(name) ?? computeImageHash(data), data)
  return [...entries].map(([name, data]) => ({ name: `images/${name}`, data }))
}
