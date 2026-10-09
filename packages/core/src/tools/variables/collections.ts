import * as v from 'valibot'

import { defineTool } from '#core/tools/schema'

export const listCollections = defineTool({
  name: 'list_collections',
  description: 'List all variable collections.',
  execution: { kind: 'sync', mutation: 'none' },
  input: v.strictObject({}),
  execute: (figma) => {
    const collections = figma.getLocalVariableCollections()
    return { count: collections.length, collections }
  }
})

export const getCollection = defineTool({
  name: 'get_collection',
  description: 'Get a variable collection by ID.',
  execution: { kind: 'sync', mutation: 'none' },
  exposure: { webmcp: false },
  input: v.strictObject({
    id: v.pipe(v.string(), v.description('Collection ID'))
  }),
  execute: (figma, { id }) => {
    const collection = figma.getVariableCollectionById(id)
    if (!collection) return { error: `Collection "${id}" not found` }
    return {
      ...collection,
      activeModeId: figma.graph.getActiveModeId(id)
    }
  }
})

export const createCollection = defineTool({
  name: 'create_collection',

  description: 'Create a new variable collection.',
  execution: { kind: 'sync', mutation: 'document' },
  input: v.strictObject({
    name: v.pipe(v.string(), v.description('Collection name'))
  }),
  execute: (figma, { name }) => {
    return figma.createVariableCollection(name)
  }
})

export const deleteCollection = defineTool({
  name: 'delete_collection',

  description: 'Delete a variable collection and all its variables.',
  execution: { kind: 'sync', mutation: 'document' },
  input: v.strictObject({
    id: v.pipe(v.string(), v.description('Collection ID'))
  }),
  execute: (figma, { id }) => {
    figma.deleteVariableCollection(id)
    return { deleted: id }
  }
})
