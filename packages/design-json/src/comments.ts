import type { ResolvedOptions } from '#design-json/options'
import { toJSONObject } from '#design-json/values'
import { groupBy, mapValues } from 'es-toolkit'

import type { SceneGraph } from '@open-pencil/scene-graph'
import { readComments } from '@open-pencil/scene-graph/comments'
import type { JSONObject } from '@open-pencil/std/json'

/** Every comment thread in the document, with its replies, resolved and deleted ones included. */
export function documentComments(graph: SceneGraph, options: ResolvedOptions): JSONObject[] {
  if (!options.comments) return []
  return readComments(graph).map((thread) => toJSONObject(thread, options.bytes))
}

/** The IDs of the live threads pinned to each layer, by layer ID. */
export function commentThreadIdsByLayer(graph: SceneGraph): Record<string, string[]> {
  const pinned = readComments(graph).filter((thread) => !thread.deleted && thread.nodeId)
  const byLayer = groupBy(pinned, (thread) => thread.nodeId ?? '')
  return mapValues(byLayer, (threads) => threads.map((thread) => thread.id))
}
