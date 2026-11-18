import { describe, expect, test } from 'bun:test'

import { SceneGraph } from '@open-pencil/scene-graph'
import { lookupCollection, lookupMode } from '@open-pencil/scene-graph/variables'

describe('variable lookup by ID or name', () => {
  test('a collection is found by its ID, then by its one exact name', () => {
    const graph = new SceneGraph()
    const theme = graph.createCollection('Theme')
    expect(lookupCollection(graph, theme.id)).toEqual({ kind: 'found', value: theme })
    expect(lookupCollection(graph, 'Theme')).toEqual({ kind: 'found', value: theme })
    expect(lookupCollection(graph, 'theme')).toEqual({ kind: 'missing' })
  })

  test('a name several collections share finds all of them, and each ID still finds one', () => {
    const graph = new SceneGraph()
    const first = graph.createCollection('Twin')
    const second = graph.createCollection('Twin')
    expect(lookupCollection(graph, 'Twin')).toEqual({ kind: 'ambiguous', matches: [first, second] })
    expect(lookupCollection(graph, second.id)).toEqual({ kind: 'found', value: second })
  })

  test('a mode is found by its ID, then by its one exact name', () => {
    const graph = new SceneGraph()
    const theme = graph.createCollection('Theme')
    const dark = graph.createMode(theme.id, 'Dark')
    const again = graph.createMode(theme.id, 'Dark')
    const collection = graph.variableCollections.get(theme.id)
    if (!collection || !dark || !again) throw new Error('Expected the Theme modes')
    expect(lookupMode(collection, dark)).toMatchObject({ kind: 'found', value: { modeId: dark } })
    expect(lookupMode(collection, 'Mode 1')).toMatchObject({
      kind: 'found',
      value: { modeId: theme.defaultModeId }
    })
    expect(lookupMode(collection, 'Dark')).toMatchObject({
      kind: 'ambiguous',
      matches: [{ modeId: dark }, { modeId: again }]
    })
    expect(lookupMode(collection, 'Dim')).toEqual({ kind: 'missing' })
  })
})
