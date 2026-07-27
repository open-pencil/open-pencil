import { describe, expect, test } from 'bun:test'

import { expectDefined } from '#tests/helpers/assert'

import { createAPI } from './helpers'

describe('variables', () => {
  test('getLocalVariables returns empty by default', () => {
    const api = createAPI()
    expect(api.getLocalVariables()).toEqual([])
  })

  test('getLocalVariables returns added variables', () => {
    const api = createAPI()
    api.graph.addCollection({
      id: 'col1',
      name: 'Colors',
      modes: [{ modeId: 'mode1', name: 'Default' }],
      defaultModeId: 'mode1',
      variableIds: []
    })
    api.graph.addVariable({
      id: 'var1',
      name: 'primary',
      type: 'COLOR',
      collectionId: 'col1',
      valuesByMode: { mode1: { r: 1, g: 0, b: 0, a: 1 } },
      description: '',
      hiddenFromPublishing: false
    })
    expect(api.getLocalVariables().length).toBe(1)
    expect(api.getLocalVariables('COLOR').length).toBe(1)
    expect(api.getLocalVariables('FLOAT').length).toBe(0)
  })

  test('getVariableById', () => {
    const api = createAPI()
    api.graph.addCollection({
      id: 'col1',
      name: 'Spacing',
      modes: [{ modeId: 'mode1', name: 'Default' }],
      defaultModeId: 'mode1',
      variableIds: []
    })
    api.graph.addVariable({
      id: 'var1',
      name: 'spacing-sm',
      type: 'FLOAT',
      collectionId: 'col1',
      valuesByMode: { mode1: 8 },
      description: '',
      hiddenFromPublishing: false
    })
    const v = api.getVariableById('var1')
    expect(expectDefined(v, 'spacing variable').name).toBe('spacing-sm')
    expect(api.getVariableById('nonexistent')).toBeNull()
  })

  test('getLocalVariableCollections', () => {
    const api = createAPI()
    api.graph.addCollection({
      id: 'col1',
      name: 'Colors',
      modes: [{ modeId: 'mode1', name: 'Default' }],
      defaultModeId: 'mode1',
      variableIds: []
    })
    const cols = api.getLocalVariableCollections()
    expect(cols.length).toBe(1)
    expect(cols[0].name).toBe('Colors')
  })

  test('exposes explicit and inherited variable modes on nodes', () => {
    const api = createAPI()
    api.graph.addCollection({
      id: 'col1',
      name: 'Theme',
      modes: [
        { modeId: 'light', name: 'Light' },
        { modeId: 'dark', name: 'Dark' }
      ],
      defaultModeId: 'light',
      variableIds: []
    })
    api.graph.setActiveMode('col1', 'dark')

    const parent = api.createFrame()
    const child = api.createRectangle()
    parent.appendChild(child)
    api.graph.updateNode(parent.id, { variableModes: { col1: 'light' } })

    expect(parent.explicitVariableModes).toEqual({ col1: 'light' })
    expect(child.explicitVariableModes).toEqual({})
    expect(child.resolvedVariableModes).toEqual({ col1: 'light' })
    expect(Object.isFrozen(child.resolvedVariableModes)).toBe(true)
  })

  test('getVariableCollectionById', () => {
    const api = createAPI()
    api.graph.addCollection({
      id: 'col1',
      name: 'Colors',
      modes: [{ modeId: 'mode1', name: 'Default' }],
      defaultModeId: 'mode1',
      variableIds: []
    })
    expect(api.getVariableCollectionById('col1')?.name).toBe('Colors')
    expect(api.getVariableCollectionById('nonexistent')).toBeNull()
  })
})
