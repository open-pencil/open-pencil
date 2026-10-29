import { beforeAll, describe, expect, test } from 'bun:test'

import { expectDefined } from '#core-tests/helpers/assert'
import { createAPI, registerTestFont } from '#core-tests/helpers/figma-api'


beforeAll(() => registerTestFont())

// Expected values and messages were recorded by running the same calls in Figma desktop.

function tokens() {
  const api = createAPI()
  const collection = api.variables.createVariableCollection('Tokens')
  const mode = collection.defaultModeId
  const size = api.variables.createVariable('size', collection, 'FLOAT')
  size.setValueForMode(mode, 4.5)
  const label = api.variables.createVariable('label', collection, 'STRING')
  const flag = api.variables.createVariable('flag', collection, 'BOOLEAN')
  const color = api.variables.createVariable('color', collection, 'COLOR')
  return { api, collection, mode, size, label, flag, color }
}

describe('figma.variables', () => {
  test('creates collections and variables with Figma’s shapes and defaults', () => {
    const { api, collection, mode, size, label, flag, color } = tokens()
    expect(collection.modes).toEqual([{ modeId: mode, name: 'Mode 1' }])
    expect(collection.variableIds).toEqual([size.id, label.id, flag.id, color.id])
    expect(collection).toMatchObject({ name: 'Tokens', remote: false, isExtension: false })
    expect(size).toMatchObject({
      name: 'size',
      resolvedType: 'FLOAT',
      variableCollectionId: collection.id,
      description: '',
      remote: false,
      hiddenFromPublishing: false,
      scopes: ['ALL_SCOPES'],
      codeSyntax: {}
    })
    expect([label, flag, color].map((variable) => variable.valuesByMode[mode])).toEqual([
      'String value',
      false,
      { r: 1, g: 1, b: 1, a: 1 }
    ])
    expect(api.variables.getLocalVariables('FLOAT').map((variable) => variable.name)).toEqual([
      'size'
    ])
    expect(api.variables.getVariableById(size.id)?.name).toBe('size')
    expect(api.variables.getVariableById('VariableID:9:9')).toBeNull()
    expect(api.variables.getVariableCollectionById('nope')).toBeNull()
    expect(api.variables.createVariable('by-id', collection.id, 'STRING').resolvedType).toBe(
      'STRING'
    )
  })

  test('async lookups return what the sync ones do', async () => {
    const { api, collection, size } = tokens()
    expect((await api.variables.getVariableByIdAsync(size.id))?.id).toBe(size.id)
    expect((await api.variables.getVariableCollectionByIdAsync(collection.id))?.id).toBe(
      collection.id
    )
    expect(await api.variables.getLocalVariablesAsync('BOOLEAN')).toHaveLength(1)
    expect(await api.variables.getLocalVariableCollectionsAsync()).toHaveLength(1)
    expect(await api.variables.createVariableAliasByIdAsync(size.id)).toEqual({
      type: 'VARIABLE_ALIAS',
      id: size.id
    })
  })

  test('refuses names and types as Figma does', () => {
    const { api, collection, size } = tokens()
    const types = '"BOOLEAN"|"COLOR"|"FLOAT"|"STRING"|"EASING"|"TIMING"'
    expect(() => api.variables.createVariable('x', collection, 'NUMBER' as 'FLOAT')).toThrow(
      `in createVariable: Property "resolvedType" failed validation: Invalid option: expected one of ${types}`
    )
    expect(() => api.variables.getLocalVariables('NUMBER' as 'FLOAT')).toThrow(
      `in getLocalVariables: Property "resolvedType" failed validation`
    )
    expect(() => api.variables.createVariable('size', collection, 'FLOAT')).toThrow(
      'in createVariable: duplicate variable name'
    )
    expect(() => api.variables.createVariable('', collection, 'FLOAT')).toThrow(
      'in createVariable: name cannot be empty'
    )
    expect(() => api.variables.createVariable('a.b', collection, 'FLOAT')).toThrow(
      'in createVariable: invalid variable name'
    )
    const other = api.variables.createVariable('other', collection, 'FLOAT')
    other.name = 'renamed'
    expect(other.name).toBe('renamed')
    expect(() => {
      other.name = size.name
    }).toThrow('in set_name: duplicate variable name')
  })

  test('setValueForMode checks the type and mode, and takes RGB and references', () => {
    const { api, mode, size, label, color } = tokens()
    expect(() => size.setValueForMode(mode, 'x')).toThrow(
      `in setValueForMode: Mismatched variable resolved type for mode ${mode}`
    )
    expect(() => size.setValueForMode('1:999', 3)).toThrow(
      'in setValueForMode: mode with id 1:999 not defined for variable'
    )
    expect(() => color.setValueForMode(mode, 3)).toThrow('Mismatched variable resolved type')
    color.setValueForMode(mode, { r: 1, g: 0, b: 0 })
    expect(color.valuesByMode[mode]).toEqual({ r: 1, g: 0, b: 0, a: 1 })

    const alias = api.variables.createVariableAlias(size)
    expect(alias).toEqual({ type: 'VARIABLE_ALIAS', id: size.id })
    expect(() => label.setValueForMode(mode, alias)).toThrow('Mismatched variable resolved type')
    const copy = api.variables.createVariable('copy', size.variableCollectionId, 'FLOAT')
    copy.setValueForMode(mode, alias)
    expect(copy.valuesByMode[mode]).toEqual(alias)
  })

  test('a reference that would make a variable read itself is ignored', () => {
    const { api, mode, size } = tokens()
    const copy = api.variables.createVariable('copy', size.variableCollectionId, 'FLOAT')
    copy.setValueForMode(mode, api.variables.createVariableAlias(size))
    size.setValueForMode(mode, api.variables.createVariableAlias(size))
    size.setValueForMode(mode, api.variables.createVariableAlias(copy))
    expect(size.valuesByMode[mode]).toBe(4.5)
  })

  test('resolveForConsumer reads the value a layer sees', () => {
    const { api, mode, size } = tokens()
    const copy = api.variables.createVariable('copy', size.variableCollectionId, 'FLOAT')
    copy.setValueForMode(mode, api.variables.createVariableAlias(size))
    expect(copy.resolveForConsumer(api.createRectangle())).toEqual({
      value: 4.5,
      resolvedType: 'FLOAT'
    })
  })

  test('modes copy the default values, rename, and the default mode can go', () => {
    const { collection, mode, size } = tokens()
    const dark = collection.addMode('Dark')
    expect(collection.modes.map((item) => item.name)).toEqual(['Mode 1', 'Dark'])
    expect(size.valuesByMode).toEqual({ [mode]: 4.5, [dark]: 4.5 })
    expect(() => collection.renameMode('1:999', 'x')).toThrow('in renameMode: Could not find mode')
    collection.removeMode(mode)
    expect(collection.modes).toEqual([{ name: 'Dark', modeId: dark }])
    expect(collection.defaultModeId).toBe(dark)
  })

  test('scopes the plugin API cannot name stay when a script sets scopes', () => {
    const { api, size } = tokens()
    expectDefined(api.graph.variables.get(size.id), 'size').scopes = ['GAP', 'TRANSFORM', 'STROKE']
    expect(size.scopes).toEqual(['GAP', 'STROKE_COLOR'])
    size.scopes = size.scopes.filter((scope) => scope !== 'GAP')
    expect(api.graph.variables.get(size.id)?.scopes).toEqual(['STROKE', 'TRANSFORM'])
    size.scopes = ['ALL_SCOPES']
    expect(api.graph.variables.get(size.id)?.scopes).toBeUndefined()
  })

  test('removing a variable or collection takes it out of the document', () => {
    const { api, collection, size } = tokens()
    size.remove()
    expect(api.variables.getLocalVariables().map((variable) => variable.name)).toEqual([
      'label',
      'flag',
      'color'
    ])
    expect(collection.variableIds).not.toContain(size.id)
    collection.remove()
    expect(api.variables.getLocalVariables()).toEqual([])
    expect(api.variables.getLocalVariableCollections()).toEqual([])
  })
})

describe('node variable bindings', () => {
  test('setBoundVariable binds by Figma field names and shows the value', () => {
    const { api, size } = tokens()
    const rect = api.createRectangle()
    expect(rect.boundVariables).toEqual({})
    rect.setBoundVariable('width', size)
    expect(rect.width).toBe(4.5)
    expect(rect.boundVariables).toEqual({ width: { type: 'VARIABLE_ALIAS', id: size.id } })
    rect.setBoundVariable('cornerRadius', size)
    expect(Object.keys(rect.boundVariables)).toEqual([
      'width',
      'topLeftRadius',
      'topRightRadius',
      'bottomLeftRadius',
      'bottomRightRadius'
    ])
    rect.setBoundVariable('height', size.id)
    expect(rect.height).toBe(4.5)
    rect.setBoundVariable('width', null)
    expect(rect.width).toBe(4.5)
    expect(rect.boundVariables.width).toBeUndefined()
    rect.setBoundVariable('minWidth', null)
  })

  test('shows and unbinds by corner a uniform radius a file binds as one field', () => {
    const { api, mode, size } = tokens()
    const rect = api.createRectangle()
    const corners = [
      'topLeftRadius',
      'topRightRadius',
      'bottomLeftRadius',
      'bottomRightRadius'
    ] as const
    // `api.mixed` widens to `symbol`, so the radii are typed to hold either.
    const radii = (): (number | symbol)[] => [
      rect.cornerRadius,
      ...corners.map((corner) => rect[corner])
    ]
    // A .pen or .fig file binds a uniform radius as one field.
    api.graph.bindVariable(rect.id, 'cornerRadius', size.id)
    size.setValueForMode(mode, 6)
    expect(Object.keys(rect.boundVariables)).toEqual([...corners])

    // An unbound corner keeps the radius it shows, and the others follow the variable.
    rect.setBoundVariable('topLeftRadius', null)
    expect(Object.keys(rect.boundVariables)).toEqual(corners.slice(1))
    expect(radii()).toEqual([6, 6, 6, 6, 6])
    size.setValueForMode(mode, 10)
    expect(radii()).toEqual([api.mixed, 6, 10, 10, 10])

    for (const corner of corners.slice(1)) rect.setBoundVariable(corner, null)
    rect.cornerRadius = 20
    expect(api.graph.getNode(rect.id)?.boundVariables).toEqual({})
    expect(radii()).toEqual([20, 20, 20, 20, 20])
  })

  test('setting one corner of a radius a file binds as one field keeps the others bound', () => {
    const { api, size } = tokens()
    const rect = api.createRectangle()
    api.graph.bindVariable(rect.id, 'cornerRadius', size.id)
    rect.topLeftRadius = 20
    const bound = api.graph.getNode(rect.id)?.boundVariables ?? {}
    expect(bound).not.toHaveProperty('cornerRadius')
    expect(bound).toMatchObject({
      topRightRadius: size.id,
      bottomLeftRadius: size.id,
      bottomRightRadius: size.id
    })
  })

  // Figma desktop, 2026-10-26: unbinding `cornerRadius` leaves every corner's binding in place.
  test('unbinding the radius as a whole keeps the corners bound', () => {
    const { api, size } = tokens()
    const rect = api.createRectangle()
    rect.setBoundVariable('cornerRadius', size)
    rect.setBoundVariable('cornerRadius', null)
    expect(Object.keys(rect.boundVariables)).toEqual([
      'topLeftRadius',
      'topRightRadius',
      'bottomLeftRadius',
      'bottomRightRadius'
    ])
  })

  test('a radius bound as a whole is drawn at the variable’s value', () => {
    const { api, mode, size } = tokens()
    const rect = api.createRectangle()
    rect.setBoundVariable('cornerRadius', size)
    size.setValueForMode(mode, 10)
    expect(rect.cornerRadius).toBe(10)
    // The layer draws its corners, which hold the bound value, not a radius left at 0.
    expect(api.graph.getNode(rect.id)).toMatchObject({
      independentCorners: true,
      topLeftRadius: 10,
      topRightRadius: 10,
      bottomLeftRadius: 10,
      bottomRightRadius: 10
    })
  })

  test('setBoundVariable takes only the type Figma’s API allows for each field', () => {
    const { api, size, label, flag, color } = tokens()
    const rect = api.createRectangle()
    expect(() => rect.setBoundVariable('height', label)).toThrow(
      "in setBoundVariable: variable of resolved type 'STRING' cannot be bound to 'height'"
    )
    expect(() => rect.setBoundVariable('height', color)).toThrow(
      "variable of resolved type 'COLOR' cannot be bound to 'height'"
    )
    expect(() => rect.setBoundVariable('visible', label)).toThrow(
      "variable of resolved type 'STRING' cannot be bound to 'visible'"
    )
    expect(() => rect.setBoundVariable('visible', size)).toThrow(
      "variable of resolved type 'FLOAT' cannot be bound to 'visible'"
    )
    rect.setBoundVariable('visible', flag)
    expect(rect.visible).toBe(false)

    const text = api.createText()
    text.characters = 'Hi'
    expect(() => text.setBoundVariable('characters', size)).toThrow(
      "variable of resolved type 'FLOAT' cannot be bound to 'characters'"
    )
    text.setBoundVariable('characters', label)
    expect(text.characters).toBe('String value')
    expect(text.boundVariables).toEqual({ characters: { type: 'VARIABLE_ALIAS', id: label.id } })
  })

  test('text with no characters yet keeps a style binding for the characters typed later', () => {
    const { api, size } = tokens()
    const text = api.createText()
    text.setBoundVariable('fontSize', size)
    expect(text.boundVariables).toEqual({ fontSize: [{ type: 'VARIABLE_ALIAS', id: size.id }] })
    expect(text.fontSize).toBe(4.5)
    text.characters = 'Hello'
    expect(text.boundVariables).toEqual({ fontSize: [{ type: 'VARIABLE_ALIAS', id: size.id }] })
    expect(text.fontSize).toBe(4.5)
    expect(() => api.createText().setBoundVariable('fontWeight', size)).toThrow(
      'in setBoundVariable: OpenPencil binds fontWeight only on text that has characters'
    )
  })

  test('setBoundVariable refuses a layer of a library definition, as other setters do', () => {
    const { api, size } = tokens()
    const component = api.graph.createNode('COMPONENT', api.currentPage.id, {
      name: 'Remote button',
      librarySource: {
        identity: { libraryId: 'design-system', assetKey: 'button', revisionId: 'r1' },
        sourceNodeId: 'source',
        readOnly: true
      }
    })
    const proxy = expectDefined(api.getNodeById(component.id), 'component')
    expect(() => proxy.setBoundVariable('width', size)).toThrow('belongs to library design-system')
    expect(component.boundVariables).toEqual({})
  })

  test('setBoundVariable refuses unknown fields and paints, and ignores fields a layer lacks', () => {
    const { api, size, color } = tokens()
    const rect = api.createRectangle()
    expect(() => rect.setBoundVariable('foo' as 'width', size)).toThrow(
      'in setBoundVariable: Property "field" failed validation: Invalid option: expected one of "height"|"width"|"characters"|'
    )
    expect(() => rect.setBoundVariable('text' as 'width', size)).toThrow(
      'Property "field" failed validation'
    )
    expect(() => rect.setBoundVariable('fills' as 'width', color)).toThrow(
      'in setBoundVariable: fills and strokes variable bindings must be set on paints directly'
    )
    rect.setBoundVariable('paddingLeft', size)
    expect(rect.boundVariables).toEqual({})

    const frame = api.createFrame()
    frame.layoutMode = 'HORIZONTAL'
    frame.setBoundVariable('paddingLeft', size)
    frame.setBoundVariable('itemSpacing', size)
    expect(frame.itemSpacing).toBe(4.5)
    expect(Object.keys(frame.boundVariables)).toEqual(['paddingLeft', 'itemSpacing'])
  })

  test('paints bind their colour through setBoundVariableForPaint', () => {
    const { api, mode, size, color } = tokens()
    color.setValueForMode(mode, { r: 0, g: 0, b: 1 })
    const solid = {
      type: 'SOLID' as const,
      color: { r: 0, g: 0, b: 0, a: 1 },
      opacity: 1,
      visible: true
    }
    const paint = api.variables.setBoundVariableForPaint(solid, 'color', color)
    expect(paint.boundVariables).toEqual({ color: { type: 'VARIABLE_ALIAS', id: color.id } })
    expect(solid).not.toHaveProperty('boundVariables')
    expect(() => api.variables.setBoundVariableForPaint(solid, 'color', size)).toThrow(
      'in setBoundVariableForPaint: can only bind color variables to color'
    )
    expect(api.variables.setBoundVariableForPaint(paint, 'color', null).boundVariables).toEqual({})

    const rect = api.createRectangle()
    rect.fills = [paint]
    expect(rect.boundVariables).toEqual({ fills: [{ type: 'VARIABLE_ALIAS', id: color.id }] })
    const [fill] = rect.fills as readonly { color: unknown; boundVariables?: unknown }[]
    expect(fill.color).toEqual({ r: 0, g: 0, b: 1 })
    expect(fill.boundVariables).toEqual({ color: { type: 'VARIABLE_ALIAS', id: color.id } })
    rect.fills = [solid]
    expect(rect.boundVariables).toEqual({})
  })

  test('explicit modes are set and cleared per collection', () => {
    const { api, collection, mode, size } = tokens()
    const dark = collection.addMode('Dark')
    size.setValueForMode(dark, 10)
    const frame = api.createFrame()
    const child = api.createRectangle()
    frame.appendChild(child)
    child.setBoundVariable('width', size)
    frame.setExplicitVariableModeForCollection(collection, dark)
    expect(frame.explicitVariableModes).toEqual({ [collection.id]: dark })
    expect(child.resolvedVariableModes).toEqual({ [collection.id]: dark })
    expect(child.width).toBe(10)
    expect(() => frame.setExplicitVariableModeForCollection(collection, '1:999')).toThrow(
      `in setExplicitVariableModeForCollection: Could not find modeId ${collection.id} in variable set with variableCollectionId: '1:999'`
    )
    frame.clearExplicitVariableModeForCollection(collection)
    expect(frame.explicitVariableModes).toEqual({})
    expect(child.width).toBe(4.5)
    frame.setExplicitVariableModeForCollection(collection.id, mode)
    expect(frame.explicitVariableModes).toEqual({ [collection.id]: mode })
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

  test('figma has no variable members of its own besides figma.variables', () => {
    const api = createAPI()
    for (const name of ['getVariableById', 'createVariable', 'setVariableValue', 'bindVariable'])
      expect(name in api).toBe(false)
    expectDefined(api.variables, 'figma.variables')
  })
})
