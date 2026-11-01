import * as v from 'valibot'

import type { SceneGraph, VariableCollection } from '@open-pencil/scene-graph'

import type { FigmaAPI } from '#core/figma-api'
import { defineTool, nodeIdInputSchema } from '#core/tools/schema'

const collectionInputSchema = v.pipe(
  v.string(),
  v.description('Variable collection ID or name, such as "Theme"')
)

/** The collection named by ID or, failing that, by its one exact name. */
function findCollection(graph: SceneGraph, ref: string): VariableCollection | { error: string } {
  const byId = graph.variableCollections.get(ref)
  if (byId) return byId
  const named = [...graph.variableCollections.values()].filter((c) => c.name === ref)
  if (named.length === 1) return named[0]
  if (named.length > 1)
    return { error: `Several collections are named "${ref}"; name one by ID: ${ids(named)}` }
  return { error: `Collection "${ref}" not found` }
}

function ids(collections: VariableCollection[]): string {
  return collections.map((collection) => collection.id).join(', ')
}

/** The mode of `collection` named by ID or by name. */
function findModeId(collection: VariableCollection, ref: string): string | { error: string } {
  const mode =
    collection.modes.find((candidate) => candidate.modeId === ref) ??
    collection.modes.find((candidate) => candidate.name === ref)
  if (mode) return mode.modeId
  const names = collection.modes.map((candidate) => `"${candidate.name}"`).join(', ')
  return { error: `Collection "${collection.name}" has no mode "${ref}"; its modes: ${names}` }
}

function modeName(collection: VariableCollection, modeId: string): string | null {
  return collection.modes.find((mode) => mode.modeId === modeId)?.name ?? null
}

export const setVariableMode = defineTool({
  name: 'set_variable_mode',
  description:
    'Show layers in a mode of a variable collection, such as a frame in the Dark mode of a "Theme" ' +
    'collection, as the Appearance panel does. Children inherit the mode unless they set their own. ' +
    'Pass mode null to clear it, so the layers inherit their parent’s mode again.',
  execution: { kind: 'sync', mutation: 'properties' },
  input: v.strictObject({
    ids: v.pipe(v.array(nodeIdInputSchema), v.minLength(1), v.description('Layer or page IDs')),
    collection: collectionInputSchema,
    mode: v.pipe(
      v.nullable(v.string()),
      v.description('Mode ID or name, such as "Dark"; null inherits the parent’s mode')
    )
  }),
  execute: (figma, args) => {
    const collection = findCollection(figma.graph, args.collection)
    if ('error' in collection) return collection
    const modeId = args.mode === null ? null : findModeId(collection, args.mode)
    if (modeId !== null && typeof modeId !== 'string') return modeId
    const nodes = args.ids.map((id) => figma.getNodeById(id))
    const missing = args.ids.filter((_, index) => !nodes[index])
    if (missing.length > 0) return { error: `Nodes not found: ${missing.join(', ')}` }
    for (const node of nodes) {
      if (!node) continue
      if (modeId === null) node.clearExplicitVariableModeForCollection(collection.id)
      else node.setExplicitVariableModeForCollection(collection.id, modeId)
    }
    return {
      ids: args.ids,
      collection_id: collection.id,
      mode_id: modeId,
      mode: modeId === null ? null : modeName(collection, modeId)
    }
  }
})

function layerModes(figma: FigmaAPI, id: string) {
  const node = figma.graph.getNode(id)
  if (!node) return null
  return [...figma.graph.variableCollections.values()].map((collection) => {
    const own = node.variableModes[collection.id]
    const modeId = figma.graph.getNodeVariableModeId(id, collection.id)
    return {
      collection_id: collection.id,
      collection: collection.name,
      mode_id: modeId,
      mode: modeName(collection, modeId),
      inherited: !own,
      modes: collection.modes.map((mode) => ({ id: mode.modeId, name: mode.name }))
    }
  })
}

export const getVariableModes = defineTool({
  name: 'get_variable_modes',
  description:
    'Get the mode a layer shows for each variable collection, such as its theme: its own, or ' +
    'inherited from its parent or the page when inherited is true.',
  execution: { kind: 'sync', mutation: 'none' },
  input: v.strictObject({ id: nodeIdInputSchema }),
  execute: (figma, { id }) => {
    const modes = layerModes(figma, id)
    if (!modes) return { error: `Node "${id}" not found` }
    return { id, modes }
  }
})
