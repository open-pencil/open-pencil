import { defineTool } from '#core/tools/schema'

export const listCollections = defineTool({
  name: 'list_collections',
  description: 'List all variable collections.',
  params: {},
  execute: (figma) => {
    const collections = figma.getLocalVariableCollections()
    return { count: collections.length, collections }
  },
})

export const getCollection = defineTool({
  name: 'get_collection',
  description: 'Get a variable collection by ID.',
  params: {
    id: { type: 'string', description: 'Collection ID', required: true },
  },
  execute: (figma, { id }) => {
    const collection = figma.getVariableCollectionById(id)
    if (!collection) return { error: `Collection "${id}" not found` }
    return collection
  },
})

export const createCollection = defineTool({
  name: 'create_collection',
  mutates: true,
  description: 'Create a new variable collection.',
  params: {
    name: { type: 'string', description: 'Collection name', required: true },
  },
  execute: (figma, { name }) => {
    return figma.createVariableCollection(name)
  },
})

export const deleteCollection = defineTool({
  name: 'delete_collection',
  mutates: true,
  description: 'Delete a variable collection and all its variables.',
  params: {
    id: { type: 'string', description: 'Collection ID', required: true },
  },
  execute: (figma, { id }) => {
    figma.deleteVariableCollection(id)
    return { deleted: id }
  },
})
