import { describe, expect, test } from 'bun:test'

import { createEditor } from '@open-pencil/core/editor'
import {
  defaultTokenImportOptions,
  exportDesignTokens,
  planTokenImport,
  readDesignTokens,
  type DesignTokenSourceFile
} from '#core/io/formats/design-tokens'
import { getSharedStyles, SceneGraph, type Variable } from '@open-pencil/scene-graph'

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

    expect(plan.counts).toEqual({ added: 6, updated: 0, skipped: 0 })
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
    expect(variableNamed(graph, 'Flags/Rounded')).toMatchObject({
      type: 'BOOLEAN',
      valuesByMode: { [light]: true }
    })

    const [style] = getSharedStyles(graph, 'text')
    const node = graph.getNode(style.nodeId)
    expect(node).toMatchObject({ name: 'Heading/H1', fontSize: 32, lineHeight: 40, fontWeight: 700 })
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

    expect(plan.skipped).toContainEqual({ name: 'Accent', collection: 'Theme', reason: 'type-mismatch' })
    expect(graph.variables.get(accent.id)?.valuesByMode[theme.defaultModeId]).toBe(4)
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
    const files = exported(designSystem()).map((file) =>
      file.path === 'styles.tokens.json'
        ? { ...file, text: file.text.replace('"fontSize":32', '"fontSize":40') }
        : file
    )

    importInto(graph, files)

    expect(graph.getNode(layer.id)).toMatchObject({ fontSize: 40, textStyleId: style.id })
  })
})
