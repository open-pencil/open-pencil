import type { SceneGraph } from './graph'
import { readPluginData, withPluginData } from './plugin-data/field'
import { OPEN_PENCIL_PLUGIN_DATA } from './plugin-data/fields'
import type { SceneNode } from './types'

const { thumbnail } = OPEN_PENCIL_PLUGIN_DATA

/** Layers that frame a picture of their own, as Figma lets frames and sections be thumbnails. */
const THUMBNAIL_TYPES: ReadonlySet<SceneNode['type']> = new Set([
  'FRAME',
  'SECTION',
  'COMPONENT',
  'SLIDE'
])

/**
 * Whether `node` can be the document's thumbnail: a frame, section, or component placed straight
 * on a page people see, or a slide.
 */
export function canBeDocumentThumbnail(graph: SceneGraph, node: SceneNode): boolean {
  if (!THUMBNAIL_TYPES.has(node.type)) return false
  if (node.type === 'SLIDE') return true
  const parent = node.parentId ? graph.getNode(node.parentId) : undefined
  return parent?.type === 'CANVAS' && !parent.internalOnly
}

/**
 * The id stored as the document's thumbnail, whether or not that layer is loaded or can still be
 * one: what undo restores.
 */
export function documentThumbnailId(graph: SceneGraph): string | null {
  return readPluginData(graph.getNode(graph.rootId)?.pluginData, thumbnail) ?? null
}

/**
 * The layer chosen as the document's thumbnail, or null when there is none or it can no longer
 * be one, such as after it was deleted or moved into another frame.
 */
export function documentThumbnail(graph: SceneGraph): SceneNode | null {
  const id = documentThumbnailId(graph)
  const node = id ? graph.getNode(id) : undefined
  return node && canBeDocumentThumbnail(graph, node) ? node : null
}

/** Chooses `nodeId` as the document's thumbnail, or goes back to the default with null. */
export function setDocumentThumbnail(graph: SceneGraph, nodeId: string | null): void {
  const root = graph.getNode(graph.rootId)
  if (!root) return
  graph.updateNode(root.id, {
    pluginData: withPluginData(root.pluginData, thumbnail, nodeId ?? undefined)
  })
}
