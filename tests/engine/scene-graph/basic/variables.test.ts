import { describe, expect, test } from 'bun:test'

import { SceneGraph } from '@open-pencil/core'

describe('Variables', () => {
  function pageId(graph: SceneGraph): string {
    return graph.getPages()[0]?.id ?? ''
  }

  test('add and resolve color variable', () => {
    const graph = new SceneGraph()
    graph.addCollection({
      id: 'col1',
      name: 'Colors',
      modes: [{ modeId: 'm1', name: 'Light' }],
      defaultModeId: 'm1',
      variableIds: []
    })
    graph.addVariable({
      id: 'v1',
      name: 'Primary',
      type: 'COLOR',
      collectionId: 'col1',
      valuesByMode: { m1: { r: 0, g: 0.5, b: 1, a: 1 } },
      description: '',
      hiddenFromPublishing: false
    })

    const color = graph.resolveColorVariable('v1')
    expect(color).toEqual({ r: 0, g: 0.5, b: 1, a: 1 })
  })

  test('resolve number variable', () => {
    const graph = new SceneGraph()
    graph.addCollection({
      id: 'col1',
      name: 'Spacing',
      modes: [{ modeId: 'm1', name: 'Default' }],
      defaultModeId: 'm1',
      variableIds: []
    })
    graph.addVariable({
      id: 'v1',
      name: 'spacing/md',
      type: 'FLOAT',
      collectionId: 'col1',
      valuesByMode: { m1: 16 },
      description: '',
      hiddenFromPublishing: false
    })

    expect(graph.resolveNumberVariable('v1')).toBe(16)
  })

  test('resolve alias variable', () => {
    const graph = new SceneGraph()
    graph.addCollection({
      id: 'col1',
      name: 'Tokens',
      modes: [{ modeId: 'm1', name: 'Light' }],
      defaultModeId: 'm1',
      variableIds: []
    })
    graph.addVariable({
      id: 'v1',
      name: 'Blue/500',
      type: 'COLOR',
      collectionId: 'col1',
      valuesByMode: { m1: { r: 0, g: 0, b: 1, a: 1 } },
      description: '',
      hiddenFromPublishing: false
    })
    graph.addVariable({
      id: 'v2',
      name: 'Primary',
      type: 'COLOR',
      collectionId: 'col1',
      valuesByMode: { m1: { aliasId: 'v1' } },
      description: '',
      hiddenFromPublishing: false
    })

    expect(graph.resolveColorVariable('v2')).toEqual({ r: 0, g: 0, b: 1, a: 1 })
  })

  test('mode switching changes resolved value', () => {
    const graph = new SceneGraph()
    graph.addCollection({
      id: 'col1',
      name: 'Theme',
      modes: [
        { modeId: 'light', name: 'Light' },
        { modeId: 'dark', name: 'Dark' }
      ],
      defaultModeId: 'light',
      variableIds: []
    })
    graph.addVariable({
      id: 'v1',
      name: 'bg',
      type: 'COLOR',
      collectionId: 'col1',
      valuesByMode: {
        light: { r: 1, g: 1, b: 1, a: 1 },
        dark: { r: 0, g: 0, b: 0, a: 1 }
      },
      description: '',
      hiddenFromPublishing: false
    })

    expect(graph.resolveColorVariable('v1')).toEqual({ r: 1, g: 1, b: 1, a: 1 })
    graph.setActiveMode('col1', 'dark')
    expect(graph.resolveColorVariable('v1')).toEqual({ r: 0, g: 0, b: 0, a: 1 })
  })

  test('missing active mode falls back to default value', () => {
    const graph = new SceneGraph()
    graph.addCollection({
      id: 'col1',
      name: 'Theme',
      modes: [
        { modeId: 'light', name: 'Light' },
        { modeId: 'dark', name: 'Dark' }
      ],
      defaultModeId: 'light',
      variableIds: []
    })
    graph.addVariable({
      id: 'v1',
      name: 'bg',
      type: 'COLOR',
      collectionId: 'col1',
      valuesByMode: { light: { r: 1, g: 1, b: 1, a: 1 } },
      description: '',
      hiddenFromPublishing: false
    })

    graph.setActiveMode('col1', 'dark')
    expect(graph.resolveColorVariable('v1')).toEqual({ r: 1, g: 1, b: 1, a: 1 })
  })

  test('explicit alias resolution preserves source mode', () => {
    const graph = new SceneGraph()
    graph.addCollection({
      id: 'col1',
      name: 'Theme',
      modes: [
        { modeId: 'light', name: 'Light' },
        { modeId: 'dark', name: 'Dark' }
      ],
      defaultModeId: 'light',
      variableIds: []
    })
    graph.addVariable({
      id: 'base',
      name: 'base',
      type: 'COLOR',
      collectionId: 'col1',
      valuesByMode: {
        light: { r: 1, g: 1, b: 1, a: 1 },
        dark: { r: 0, g: 0, b: 0, a: 1 }
      },
      description: '',
      hiddenFromPublishing: false
    })
    graph.addVariable({
      id: 'alias',
      name: 'alias',
      type: 'COLOR',
      collectionId: 'col1',
      valuesByMode: {
        light: { aliasId: 'base' },
        dark: { aliasId: 'base' }
      },
      description: '',
      hiddenFromPublishing: false
    })

    expect(graph.resolveVariable('alias', 'dark')).toEqual({ r: 0, g: 0, b: 0, a: 1 })
  })

  test('bind and unbind variable to node', () => {
    const graph = new SceneGraph()
    const node = graph.createNode('RECTANGLE', pageId(graph), { name: 'Rect' })

    graph.bindVariable(node.id, 'fills/0/color', 'v1')
    expect(node.boundVariables['fills/0/color']).toBe('v1')

    graph.unbindVariable(node.id, 'fills/0/color')
    expect(node.boundVariables['fills/0/color']).toBeUndefined()
  })

  test('removing variable cleans up bindings', () => {
    const graph = new SceneGraph()
    graph.addCollection({
      id: 'col1',
      name: 'Colors',
      modes: [{ modeId: 'm1', name: 'Default' }],
      defaultModeId: 'm1',
      variableIds: []
    })
    graph.addVariable({
      id: 'v1',
      name: 'Red',
      type: 'COLOR',
      collectionId: 'col1',
      valuesByMode: { m1: { r: 1, g: 0, b: 0, a: 1 } },
      description: '',
      hiddenFromPublishing: false
    })

    const node = graph.createNode('RECTANGLE', pageId(graph), { name: 'Rect' })
    graph.bindVariable(node.id, 'fills/0/color', 'v1')
    expect(node.boundVariables['fills/0/color']).toBe('v1')

    graph.removeVariable('v1')
    expect(node.boundVariables['fills/0/color']).toBeUndefined()
    expect(graph.variables.size).toBe(0)
  })

  test('circular alias does not infinite loop', () => {
    const graph = new SceneGraph()
    graph.addCollection({
      id: 'col1',
      name: 'Test',
      modes: [{ modeId: 'm1', name: 'Default' }],
      defaultModeId: 'm1',
      variableIds: []
    })
    graph.addVariable({
      id: 'v1',
      name: 'A',
      type: 'COLOR',
      collectionId: 'col1',
      valuesByMode: { m1: { aliasId: 'v2' } },
      description: '',
      hiddenFromPublishing: false
    })
    graph.addVariable({
      id: 'v2',
      name: 'B',
      type: 'COLOR',
      collectionId: 'col1',
      valuesByMode: { m1: { aliasId: 'v1' } },
      description: '',
      hiddenFromPublishing: false
    })

    expect(graph.resolveColorVariable('v1')).toBeUndefined()
  })
})
