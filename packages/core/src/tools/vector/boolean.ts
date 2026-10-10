import * as v from 'valibot'

import { defineTool, nodeSummary } from '#core/tools/schema'

export const booleanUnion = defineTool({
  name: 'boolean_union',

  description: 'Union (combine) multiple nodes.',
  execution: { kind: 'sync', mutation: 'document' },
  input: v.strictObject({
    ids: v.pipe(v.array(v.string()), v.minLength(2), v.description('Node IDs to union'))
  }),
  execute: (figma, { ids }) => {
    const result = figma.booleanOperation('UNION', ids)
    return nodeSummary(result)
  }
})

export const booleanSubtract = defineTool({
  name: 'boolean_subtract',

  description: 'Subtract the second node from the first.',
  execution: { kind: 'sync', mutation: 'document' },
  input: v.strictObject({
    ids: v.pipe(v.array(v.string()), v.minLength(2), v.description('Node IDs (first minus rest)'))
  }),
  execute: (figma, { ids }) => {
    const result = figma.booleanOperation('SUBTRACT', ids)
    return nodeSummary(result)
  }
})

export const booleanIntersect = defineTool({
  name: 'boolean_intersect',

  description: 'Intersect multiple nodes.',
  execution: { kind: 'sync', mutation: 'document' },
  input: v.strictObject({
    ids: v.pipe(v.array(v.string()), v.minLength(2), v.description('Node IDs to intersect'))
  }),
  execute: (figma, { ids }) => {
    const result = figma.booleanOperation('INTERSECT', ids)
    return nodeSummary(result)
  }
})

export const booleanExclude = defineTool({
  name: 'boolean_exclude',

  description: 'Exclude (XOR) multiple nodes.',
  execution: { kind: 'sync', mutation: 'document' },
  input: v.strictObject({
    ids: v.pipe(v.array(v.string()), v.minLength(2), v.description('Node IDs to exclude'))
  }),
  execute: (figma, { ids }) => {
    const result = figma.booleanOperation('EXCLUDE', ids)
    return nodeSummary(result)
  }
})
