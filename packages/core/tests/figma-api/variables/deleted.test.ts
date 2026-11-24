import { describe, expect, test } from 'bun:test'

import { createAPI } from '#core-tests/helpers/figma-api'

import { graphOf } from '#core/figma-api/graph'

// Expected values were recorded in Figma desktop on variables deleted there, which a file keeps.

/** A collection with a live and a deleted variable, and a deleted collection, as a file reads. */
function deleted() {
  const api = createAPI()
  const graph = graphOf(api)
  const collection = api.variables.createVariableCollection('Colors')
  const light = collection.defaultModeId
  const dark = collection.addMode('Dark')
  const live = api.variables.createVariable('live', collection, 'COLOR')
  const gone = api.variables.createVariable('gone', collection, 'COLOR')
  gone.setValueForMode(light, { r: 1, g: 0, b: 0, a: 1 })
  gone.setValueForMode(dark, { r: 0, g: 0, b: 1, a: 1 })
  const record = graph.variables.get(gone.id)
  if (!record) throw new Error('Missing variable')
  graph.removeVariable(gone.id)
  graph.addVariable({ ...record, deleted: true })
  const removed = api.variables.createVariableCollection('Removed')
  const removedRecord = graph.variableCollections.get(removed.id)
  if (!removedRecord) throw new Error('Missing collection')
  graph.addCollection({ ...removedRecord, deleted: true })
  return { api, collection, live, gone, removed, dark }
}

describe('deleted variables', () => {
  test('leave the local lists and their collection, but are still found by ID', () => {
    const { api, collection, live, gone } = deleted()
    expect(api.variables.getLocalVariables().map((variable) => variable.name)).toEqual(['live'])
    expect(collection.variableIds).toEqual([live.id])
    expect(api.variables.getVariableById(gone.id)?.name).toBe('gone')
  })

  test('still resolve for a bound layer and follow its mode', () => {
    const { api, collection, gone, dark } = deleted()
    const frame = api.createFrame()
    const rect = api.createRectangle()
    frame.appendChild(rect)
    rect.fills = [
      api.variables.setBoundVariableForPaint(
        { type: 'SOLID', color: { r: 0, g: 0, b: 0 } },
        'color',
        gone
      )
    ]
    expect(gone.resolveForConsumer(rect).value).toEqual({ r: 1, g: 0, b: 0, a: 1 })
    frame.setExplicitVariableModeForCollection(collection, dark)
    expect(rect.fills[0]).toMatchObject({ color: { r: 0, g: 0, b: 1 } })
  })

  test('free their name in the collection', () => {
    const { api, collection } = deleted()
    expect(api.variables.createVariable('gone', collection, 'COLOR').name).toBe('gone')
  })

  test('a deleted collection leaves the local list but is still found by ID', () => {
    const { api, removed } = deleted()
    expect(api.variables.getLocalVariableCollections().map((item) => item.name)).toEqual(['Colors'])
    expect(api.variables.getVariableCollectionById(removed.id)?.name).toBe('Removed')
  })
})
