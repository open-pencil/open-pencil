import * as v from 'valibot'

import type { SceneGraph, VariableCollection } from '@open-pencil/scene-graph'
import { lookupCollection, lookupMode } from '@open-pencil/scene-graph/variables'

import type { FigmaAPI } from '#core/figma-api'
import { graphOf } from '#core/figma-api/graph'
import { defineTool, nodeIdInputSchema } from '#core/tools/schema'

const collectionInputSchema = v.pipe(
  v.string(),
  v.description('Variable collection ID or name, such as "Theme"')
)

/** The collection named by ID or by its one exact name, or what to say when there is none. */
function findCollection(graph: SceneGraph, ref: string): VariableCollection | { error: string } {
  const found = lookupCollection(graph, ref)
  if (found.kind === 'found') return found.value
  if (found.kind === 'missing') return { error: `Collection "${ref}" not found` }
  const ids = found.matches.map((collection) => collection.id).join(', ')
  return { error: `Several collections are named "${ref}"; name one by ID: ${ids}` }
}

/** The mode of `collection` named by ID or by its one exact name, or what to say when there is none. */
function findModeId(collection: VariableCollection, ref: string): string | { error: string } {
  const found = lookupMode(collection, ref)
  if (found.kind === 'found') return found.value.modeId
  if (found.kind === 'ambiguous') {
    const modeIds = found.matches.map((mode) => mode.modeId).join(', ')
    return {
      error: `Collection "${collection.name}" has several modes named "${ref}"; name one by ID: ${modeIds}`
    }
  }
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
    const collection = findCollection(graphOf(figma), args.collection)
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
  const graph = graphOf(figma)
  const node = graph.getNode(id)
  if (!node) return null
  return [...graph.variableCollections.values()].map((collection) => {
    const own = node.variableModes[collection.id]
    const modeId = graph.getNodeVariableModeId(id, collection.id)
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
