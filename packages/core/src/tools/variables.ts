import { parseColor } from '../color'

import { defineTool } from './schema'

export const listVariables = defineTool({
  name: 'list_variables',
  description: 'List all design variables (colors, numbers, strings, booleans).',
  params: {
    type: {
      type: 'string',
      description: 'Filter by variable type',
      enum: ['COLOR', 'FLOAT', 'STRING', 'BOOLEAN']
    }
  },
  execute: (figma, args) => {
    const vars = figma.getLocalVariables(args.type)
    return { count: vars.length, variables: vars }
  }
})

export const listCollections = defineTool({
  name: 'list_collections',
  description: 'List all variable collections.',
  params: {},
  execute: (figma) => {
    const cols = figma.getLocalVariableCollections()
    return { count: cols.length, collections: cols }
  }
})

export const getVariable = defineTool({
  name: 'get_variable',
  description: 'Get a variable by ID.',
  params: {
    id: { type: 'string', description: 'Variable ID', required: true }
  },
  execute: (figma, { id }) => {
    const v = figma.getVariableById(id)
    if (!v) return { error: `Variable "${id}" not found` }
    return v
  }
})

export const findVariables = defineTool({
  name: 'find_variables',
  description: 'Find variables by name pattern.',
  params: {
    query: { type: 'string', description: 'Name substring (case-insensitive)', required: true },
    type: {
      type: 'string',
      description: 'Filter by type',
      enum: ['COLOR', 'FLOAT', 'STRING', 'BOOLEAN']
    }
  },
  execute: (figma, args) => {
    let vars = figma.getLocalVariables(args.type)
    vars = vars.filter((v) => v.name.toLowerCase().includes(args.query.toLowerCase()))
    return { count: vars.length, variables: vars }
  }
})

export const createVariable = defineTool({
  name: 'create_variable',
  mutates: true,
  description: 'Create a new variable in a collection.',
  params: {
    name: { type: 'string', description: 'Variable name', required: true },
    type: {
      type: 'string',
      description: 'Variable type',
      required: true,
      enum: ['COLOR', 'FLOAT', 'STRING', 'BOOLEAN']
    },
    collection_id: { type: 'string', description: 'Collection ID', required: true },
    value: { type: 'string', description: 'Initial value (hex for COLOR, number for FLOAT, etc.)' }
  },
  execute: (figma, args) => {
    let parsedValue: unknown
    if (args.value !== undefined) {
      if (args.type === 'COLOR') parsedValue = parseColor(args.value)
      else if (args.type === 'FLOAT') parsedValue = Number(args.value)
      else if (args.type === 'BOOLEAN') parsedValue = args.value === 'true'
      else parsedValue = args.value
    }
    const v = figma.createVariable(
      args.name,
      args.type as any,
      args.collection_id,
      parsedValue as any
    )
    return v
  }
})

export const setVariable = defineTool({
  name: 'set_variable',
  mutates: true,
  description: 'Set the value of a variable for a specific mode.',
  params: {
    id: { type: 'string', description: 'Variable ID', required: true },
    mode: { type: 'string', description: 'Mode ID', required: true },
    value: {
      type: 'string',
      description: 'Value (hex for COLOR, number for FLOAT, etc.)',
      required: true
    }
  },
  execute: (figma, args) => {
    const v = figma.getVariableById(args.id)
    if (!v) return { error: `Variable "${args.id}" not found` }
    let parsedValue: unknown
    if (v.type === 'COLOR') parsedValue = parseColor(args.value)
    else if (v.type === 'FLOAT') parsedValue = Number(args.value)
    else if (v.type === 'BOOLEAN') parsedValue = args.value === 'true'
    else parsedValue = args.value
    figma.setVariableValue(args.id, args.mode, parsedValue as any)
    return { id: args.id, mode: args.mode, value: parsedValue }
  }
})

export const deleteVariable = defineTool({
  name: 'delete_variable',
  mutates: true,
  description: 'Delete a variable.',
  params: {
    id: { type: 'string', description: 'Variable ID', required: true }
  },
  execute: (figma, { id }) => {
    figma.deleteVariable(id)
    return { deleted: id }
  }
})

export const bindVariable = defineTool({
  name: 'bind_variable',
  mutates: true,
  description: 'Bind a variable to a node property (fills, strokes, opacity, width, height, etc.).',
  params: {
    node_id: { type: 'string', description: 'Node ID', required: true },
    field: {
      type: 'string',
      description: 'Property field (fills, strokes, opacity, width, height, etc.)',
      required: true
    },
    variable_id: { type: 'string', description: 'Variable ID', required: true }
  },
  execute: (figma, args) => {
    const node = figma.getNodeById(args.node_id)
    if (!node) return { error: `Node "${args.node_id}" not found` }
    const v = figma.getVariableById(args.variable_id)
    if (!v) return { error: `Variable "${args.variable_id}" not found` }
    figma.bindVariable(args.node_id, args.field, args.variable_id)
    return { node_id: args.node_id, field: args.field, variable_id: args.variable_id }
  }
})

export const getCollection = defineTool({
  name: 'get_collection',
  description: 'Get a variable collection by ID.',
  params: {
    id: { type: 'string', description: 'Collection ID', required: true }
  },
  execute: (figma, { id }) => {
    const c = figma.getVariableCollectionById(id)
    if (!c) return { error: `Collection "${id}" not found` }
    return c
  }
})

export const createCollection = defineTool({
  name: 'create_collection',
  mutates: true,
  description: 'Create a new variable collection.',
  params: {
    name: { type: 'string', description: 'Collection name', required: true }
  },
  execute: (figma, { name }) => {
    return figma.createVariableCollection(name)
  }
})

export const deleteCollection = defineTool({
  name: 'delete_collection',
  mutates: true,
  description: 'Delete a variable collection and all its variables.',
  params: {
    id: { type: 'string', description: 'Collection ID', required: true }
  },
  execute: (figma, { id }) => {
    figma.deleteVariableCollection(id)
    return { deleted: id }
  }
})
