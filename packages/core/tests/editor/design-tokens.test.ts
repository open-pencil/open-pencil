import { describe, expect, test } from 'bun:test'

import { createEditor } from '@open-pencil/core/editor'
import { getSharedStyles, SceneGraph, type Variable } from '@open-pencil/scene-graph'

import {
  defaultTokenImportOptions,
  exportDesignTokens,
  planTokenImport,
  readDesignTokens,
  type DesignTokenSourceFile
} from '#core/io/formats/design-tokens'

const blue = { r: 0, g: 0.4, b: 0.8, a: 1 }
const white = { r: 1, g: 1, b: 1, a: 1 }

function designSystem() {
  const graph = new SceneGraph()
  const page = graph.getPages()[0].id
  const primitives = graph.createCollection('Primitives')
  const brand = graph.createVariable('Blue/500', 'COLOR', primitives.id, blue)
  const theme = graph.createCollection('Theme')
  graph.renameMode(theme.id, theme.defaultModeId, 'Light')
  const dark = graph.createMode(theme.id, 'Dark') ?? ''
  const accent = graph.createVariable('Accent', 'COLOR', theme.id, { aliasId: brand.id })
  accent.valuesByMode[dark] = white
  const gutter = graph.createVariable('Space/Gutter', 'FLOAT', theme.id, 24)
  gutter.unit = 'rem'
  gutter.expressions = { [theme.defaultModeId]: { css: 'clamp(1rem, 4vw, 1.5rem)', resolved: 24 } }
  graph.createVariable('Flags/Rounded', 'BOOLEAN', theme.id, true)
  const fast = graph.createVariable('Motion/Fast', 'FLOAT', theme.id, 150)
  fast.unit = 'ms'
  const family = graph.createVariable('Font/Body', 'STRING', theme.id, 'Inter')
  family.scopes = ['FONT_FAMILY']
  const heading = graph.createNode('TEXT', page, {
    name: 'Heading/H1',
    fontFamily: 'Inter',
    fontWeight: 700,
    fontSize: 32,
    lineHeight: 40,
    sharedStyleType: 'TEXT',
    internalOnly: true,
    boundVariables: { fontFamily: family.id }
  })
  heading.source.id = 'style:heading'
  return graph
}

function exported(graph: SceneGraph): DesignTokenSourceFile[] {
  return exportDesignTokens(graph).files.map((file) => ({
    path: file.path,
    text: JSON.stringify(file.content)
  }))
}

function importInto(graph: SceneGraph, files: DesignTokenSourceFile[]) {
  const editor = createEditor({ graph })
  const bundle = readDesignTokens(files)
  const plan = planTokenImport(graph, bundle, defaultTokenImportOptions(graph, bundle))
  return { editor, plan, result: editor.importDesignTokens(plan) }
}

function variableNamed(graph: SceneGraph, name: string): Variable {
  const found = [...graph.variables.values()].find((variable) => variable.name === name)
  if (!found) throw new Error(`missing ${name}`)
  return found
}

describe('design token import', () => {
  test('an export reads back into an empty document as it was', () => {
    const graph = new SceneGraph()
    const { plan } = importInto(graph, exported(designSystem()))

    expect(plan.counts).toEqual({ added: 7, updated: 0, skipped: 0 })
    const theme = [...graph.variableCollections.values()].find((entry) => entry.name === 'Theme')
    expect(theme?.modes.map((mode) => mode.name)).toEqual(['Light', 'Dark'])
    const [light, dark] = theme?.modes.map((mode) => mode.modeId) ?? []
    const accent = variableNamed(graph, 'Accent')
    expect(accent.valuesByMode[light]).toEqual({ aliasId: variableNamed(graph, 'Blue/500').id })
    expect(accent.valuesByMode[dark]).toEqual(white)
    expect(variableNamed(graph, 'Space/Gutter')).toMatchObject({
      unit: 'rem',
      valuesByMode: { [light]: 24 },
      expressions: { [light]: { css: 'clamp(1rem, 4vw, 1.5rem)', resolved: 24 } }
    })
    // Written in seconds for Figma, read back into milliseconds.
    expect(variableNamed(graph, 'Motion/Fast')).toMatchObject({
      unit: 'ms',
      valuesByMode: { [light]: 150 }
    })
    expect(variableNamed(graph, 'Flags/Rounded')).toMatchObject({
      type: 'BOOLEAN',
      valuesByMode: { [light]: true }
    })

    const [style] = getSharedStyles(graph, 'text')
    const node = graph.getNode(style.nodeId)
    expect(node).toMatchObject({
      name: 'Heading/H1',
      fontSize: 32,
      lineHeight: 40,
      fontWeight: 700
    })
    expect(node?.boundVariables.fontFamily).toBe(variableNamed(graph, 'Font/Body').id)
  })

  test('the whole import undoes in one step', () => {
    const graph = new SceneGraph()
    const { editor } = importInto(graph, exported(designSystem()))

    editor.undo.undo()

    expect(graph.variableCollections.size).toBe(0)
    expect(graph.variables.size).toBe(0)
    expect(getSharedStyles(graph, 'text')).toEqual([])
  })

  test('importing into a document updates variables by name and adds the rest', () => {
    const graph = new SceneGraph()
    const theme = graph.createCollection('Theme')
    graph.renameMode(theme.id, theme.defaultModeId, 'Light')
    const accent = graph.createVariable('Accent', 'COLOR', theme.id, { r: 1, g: 0, b: 0, a: 1 })
    const keep = graph.createVariable('Kept', 'FLOAT', theme.id, 3)

    const { plan } = importInto(graph, exported(designSystem()))

    expect(graph.variables.get(accent.id)?.valuesByMode[theme.defaultModeId]).toEqual({
      aliasId: variableNamed(graph, 'Blue/500').id
    })
    expect(graph.variables.get(keep.id)?.valuesByMode[theme.defaultModeId]).toBe(3)
    expect(theme.modes.map((mode) => mode.name)).toEqual(['Light', 'Dark'])
    expect(plan.counts.updated).toBe(1)
  })

  test('a token that names a variable of another type is skipped, not converted', () => {
    const graph = new SceneGraph()
    const theme = graph.createCollection('Theme')
    graph.renameMode(theme.id, theme.defaultModeId, 'Light')
    const accent = graph.createVariable('Accent', 'FLOAT', theme.id, 4)

    const { plan } = importInto(graph, exported(designSystem()))

    expect(plan.skipped).toContainEqual({
      name: 'Accent',
      collection: 'Theme',
      reason: 'type-mismatch'
    })
    expect(graph.variables.get(accent.id)?.valuesByMode[theme.defaultModeId]).toBe(4)
  })

  test('tokens from another tool leave an updated variable’s unit, scopes, and code syntax', () => {
    const graph = new SceneGraph()
    const theme = graph.createCollection('Theme')
    const space = graph.createVariable('Space', 'FLOAT', theme.id, 16)
    space.unit = 'rem'
    space.scopes = ['GAP']
    space.codeSyntax = { WEB: '--space' }

    importInto(graph, [
      {
        path: 'Theme/Mode 1.tokens.json',
        text: JSON.stringify({ Space: { $type: 'number', $value: 24 } })
      }
    ])

    expect(graph.variables.get(space.id)).toMatchObject({
      unit: 'rem',
      scopes: ['GAP'],
      codeSyntax: { WEB: '--space' },
      valuesByMode: { [theme.defaultModeId]: 24 }
    })
  })

  test('updating a text style updates the layers that use it', () => {
    const graph = designSystem()
    const [style] = getSharedStyles(graph, 'text')
    const layer = graph.createNode('TEXT', graph.getPages()[0].id, {
      text: 'Title',
      fontFamily: 'Inter',
      fontSize: 32,
      textStyleId: style.id
    })
    // Edited in another tool, which keeps OpenPencil's extension as it was.
    const files = exported(designSystem()).map((file) =>
      file.path === 'styles.tokens.json'
        ? {
            ...file,
            text: file.text.replace(
              '"fontSize":{"value":32,"unit":"px"}',
              '"fontSize":{"value":40,"unit":"px"}'
            )
          }
        : file
    )

    importInto(graph, files)

    expect(graph.getNode(layer.id)).toMatchObject({ fontSize: 40, textStyleId: style.id })
  })

  test('a style token as OpenPencil wrote it keeps the exact fields its value cannot hold', () => {
    const graph = new SceneGraph()
    const source = designSystem()
    const [heading] = getSharedStyles(source, 'text')
    const node = source.getNode(heading.nodeId)
    if (node) node.textCase = 'UPPER'

    importInto(graph, exported(source))

    const [style] = getSharedStyles(graph, 'text')
    expect(graph.getNode(style.nodeId)).toMatchObject({ textCase: 'UPPER', lineHeight: 40 })
  })

  test('an edited shadow takes the place of the exact one, and the blur keeps its own', () => {
    const source = new SceneGraph()
    const shadow = (radius: number) => ({
      type: 'DROP_SHADOW' as const,
      color: { r: 0, g: 0, b: 0, a: 0.25 },
      offset: { x: 0, y: 4 },
      radius,
      spread: 0,
      visible: true
    })
    const card = source.createNode('RECTANGLE', source.getPages()[0].id, {
      name: 'Card',
      sharedStyleType: 'EFFECT',
      internalOnly: true,
      effects: [
        shadow(12),
        {
          type: 'LAYER_BLUR',
          color: { r: 0, g: 0, b: 0, a: 0 },
          offset: { x: 0, y: 0 },
          radius: 6,
          spread: 0,
          visible: true
        },
        shadow(2)
      ]
    })
    card.source.id = 'style:card'
    const files = exported(source).map((file) =>
      file.path === 'styles.tokens.json'
        ? { ...file, text: file.text.replace('"blur":{"value":12', '"blur":{"value":20') }
        : file
    )

    const graph = new SceneGraph()
    importInto(graph, files)

    const [style] = getSharedStyles(graph, 'effect')
    expect(graph.getNode(style.nodeId)?.effects).toMatchObject([
      { type: 'DROP_SHADOW', radius: 20 },
      { type: 'LAYER_BLUR', radius: 6 },
      { type: 'DROP_SHADOW', radius: 2 }
    ])
  })
})
