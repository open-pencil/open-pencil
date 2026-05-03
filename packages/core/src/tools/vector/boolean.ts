import { defineTool, nodeSummary } from '#core/tools/schema'

export const booleanUnion = defineTool({
  name: 'boolean_union',
  mutates: true,
  description: 'Union (combine) multiple nodes.',
  params: {
    ids: { type: 'string[]', description: 'Node IDs to union', required: true }
  },
  execute: (figma, { ids }) => {
    const result = figma.booleanOperation('UNION', ids)
    return nodeSummary(result)
  }
})

export const booleanSubtract = defineTool({
  name: 'boolean_subtract',
  mutates: true,
  description: 'Subtract the second node from the first.',
  params: {
    ids: { type: 'string[]', description: 'Node IDs (first minus rest)', required: true }
  },
  execute: (figma, { ids }) => {
    const result = figma.booleanOperation('SUBTRACT', ids)
    return nodeSummary(result)
  }
})

export const booleanIntersect = defineTool({
  name: 'boolean_intersect',
  mutates: true,
  description: 'Intersect multiple nodes.',
  params: {
    ids: { type: 'string[]', description: 'Node IDs to intersect', required: true }
  },
  execute: (figma, { ids }) => {
    const result = figma.booleanOperation('INTERSECT', ids)
    return nodeSummary(result)
  }
})

export const booleanExclude = defineTool({
  name: 'boolean_exclude',
  mutates: true,
  description: 'Exclude (XOR) multiple nodes.',
  params: {
    ids: { type: 'string[]', description: 'Node IDs to exclude', required: true }
  },
  execute: (figma, { ids }) => {
    const result = figma.booleanOperation('EXCLUDE', ids)
    return nodeSummary(result)
  }
})
