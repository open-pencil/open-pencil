import { describe, expect, test } from 'bun:test'

import { resolvedValueBindings } from '@open-pencil/scene-graph/variables'
import { SceneGraph } from '@open-pencil/scene-graph'

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

  test('node variable modes inherit from the nearest ancestor', () => {
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

    const page = graph.addPage('Page')
    const frame = graph.createNode('FRAME', page.id, { variableModes: { col1: 'dark' } })
    const child = graph.createNode('RECTANGLE', frame.id)
    const nestedOverride = graph.createNode('RECTANGLE', frame.id, {
      variableModes: { col1: 'light' }
    })

    expect(graph.resolveColorVariableForNode(child.id, 'v1')).toEqual({
      r: 0,
      g: 0,
      b: 0,
      a: 1
    })
    expect(graph.resolveColorVariableForNode(nestedOverride.id, 'v1')).toEqual({
      r: 1,
      g: 1,
      b: 1,
      a: 1
    })
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
      valuesByMode: { m1: { r: 1, g: 0, b: 0, a: 1 } },
      description: '',
      hiddenFromPublishing: false
    })

    const node = graph.createNode('RECTANGLE', pageId(graph), {
      name: 'Rect',
      fills: [{ type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 }, visible: true, opacity: 1 }]
    })

    graph.bindVariable(node.id, 'fills/0/color', 'v1')
    expect(node.boundVariables['fills/0/color']).toBe('v1')

    graph.unbindVariable(node.id, 'fills/0/color')
    expect(node.boundVariables['fills/0/color']).toBeUndefined()
  })

  test('visibility binds a boolean or text variable and follows its truth', () => {
    const graph = new SceneGraph()
    const collection = graph.createCollection('Visibility')
    const mode = collection.defaultModeId
    const flag = graph.createVariable('flag', 'BOOLEAN', collection.id, true)
    const state = graph.createVariable('state', 'STRING', collection.id, 'off')
    const size = graph.createVariable('size', 'FLOAT', collection.id, 1)
    const node = graph.createNode('RECTANGLE', graph.getPages()[0].id)

    graph.bindVariable(node.id, 'visible', state.id)
    expect(resolvedValueBindings(graph, node)).toEqual({ visible: false })
    state.valuesByMode[mode] = 'yes'
    expect(resolvedValueBindings(graph, node)).toEqual({})
    graph.bindVariable(node.id, 'visible', flag.id)
    expect(node.boundVariables.visible).toBe(flag.id)
    expect(() => graph.bindVariable(node.id, 'visible', size.id)).toThrow(
      'Cannot bind FLOAT variable to boolean field "visible"'
    )
  })

  test('text content binds a text or number variable and shows a number as text', () => {
    const graph = new SceneGraph()
    const collection = graph.createCollection('Copy')
    const mode = collection.defaultModeId
    const label = graph.createVariable('label', 'STRING', collection.id, 'Buy')
    const count = graph.createVariable('count', 'FLOAT', collection.id, 42.5)
    const flag = graph.createVariable('flag', 'BOOLEAN', collection.id, true)
    const node = graph.createNode('TEXT', graph.getPages()[0].id, { text: 'Hello' })

    graph.bindVariable(node.id, 'text', count.id)
    expect(resolvedValueBindings(graph, node)).toMatchObject({ text: '42.50' })
    count.valuesByMode[mode] = 3
    expect(resolvedValueBindings(graph, node)).toMatchObject({ text: '3' })
    graph.bindVariable(node.id, 'text', label.id)
    expect(resolvedValueBindings(graph, node)).toMatchObject({ text: 'Buy' })
    expect(() => graph.bindVariable(node.id, 'text', flag.id)).toThrow(
      'Cannot bind BOOLEAN variable to string field "text"'
    )
    expect(() => graph.bindVariable(node.id, 'fontFamily', count.id)).toThrow(
      'Cannot bind FLOAT variable to string field "fontFamily"'
    )
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

    const node = graph.createNode('RECTANGLE', pageId(graph), {
      name: 'Rect',
      fills: [{ type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 }, visible: true, opacity: 1 }]
    })
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

  function collectionWithSortPositions(graph: SceneGraph, sortPositions: string[]): void {
    graph.addCollection({
      id: 'col1',
      name: 'Theme',
      modes: sortPositions.map((sortPosition, index) => ({
        modeId: `m${index}`,
        name: `Mode ${index}`,
        sortPosition
      })),
      defaultModeId: 'm0',
      variableIds: []
    })
  }

  function listedModes(graph: SceneGraph) {
    return graph.variableCollections.get('col1')?.modes ?? []
  }

  test('a new default mode sorts first and the others keep their positions', () => {
    const graph = new SceneGraph()
    collectionWithSortPositions(graph, ['a', 'b', 'c'])

    graph.setDefaultMode('col1', 'm2')

    const modes = listedModes(graph)
    expect(modes.map((mode) => mode.modeId)).toEqual(['m2', 'm0', 'm1'])
    expect(modes.slice(1).map((mode) => mode.sortPosition)).toEqual(['a', 'b'])
    expect((modes[0].sortPosition ?? '') < 'a').toBe(true)
  })

  test('a new default mode sorts first even when no position fits below the old first', () => {
    const graph = new SceneGraph()
    collectionWithSortPositions(graph, ['!', '"'])

    graph.setDefaultMode('col1', 'm1')

    const positions = listedModes(graph).map((mode) => mode.sortPosition ?? '')
    expect(listedModes(graph)[0].modeId).toBe('m1')
    expect(positions).toEqual(positions.toSorted())
    expect(new Set(positions).size).toBe(positions.length)
  })

  test('a collection without sort positions does not gain any when its default changes', () => {
    const graph = new SceneGraph()
    const collection = graph.createCollection('Theme')
    graph.addMode(collection.id, 'dark', 'Dark')

    graph.setDefaultMode(collection.id, 'dark')

    const modes = graph.variableCollections.get(collection.id)?.modes ?? []
    expect(modes.map((mode) => mode.sortPosition)).toEqual([undefined, undefined])
  })
})
