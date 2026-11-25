import { describe, expect, test } from 'bun:test'

import { createEditor } from '@open-pencil/core'
import { SceneGraph, type Variable } from '@open-pencil/scene-graph'
import { getSharedStyles } from '@open-pencil/scene-graph/shared-styles'
import { pixelLength } from '@open-pencil/scene-graph/text'
import { parseVariableFormula } from '@open-pencil/scene-graph/variables'

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
    lineHeight: pixelLength(40),
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
      lineHeight: pixelLength(40),
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

  test('a variable an import binds on a text style reaches the layers using the style', () => {
    function withHeadingSize(graph: SceneGraph) {
      const theme = [...graph.variableCollections.values()].find((item) => item.name === 'Theme')
      const dark = theme?.modes.find((mode) => mode.name === 'Dark')
      if (!theme || !dark) {
        throw new Error('missing Theme/Dark')
      }
      const size = graph.createVariable('Type/H1', 'FLOAT', theme.id, 32)
      size.valuesByMode[dark.modeId] = 40
      return { theme, dark, size }
    }
    const source = designSystem()
    const { size } = withHeadingSize(source)
    const [sourceStyle] = getSharedStyles(source, 'text')
    source.bindVariable(sourceStyle.nodeId, 'fontSize', size.id)
    const graph = designSystem()
    const { theme, dark } = withHeadingSize(graph)
    const [style] = getSharedStyles(graph, 'text')
    const frame = graph.createNode('FRAME', graph.getPages()[0].id, {
      variableModes: { [theme.id]: dark.modeId }
    })
    const layer = graph.createNode('TEXT', frame.id, {
      text: 'Title',
      fontFamily: 'Inter',
      fontSize: 32,
      textStyleId: style.id
    })

    importInto(graph, exported(source))

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
    expect(graph.getNode(style.nodeId)).toMatchObject({
      textCase: 'UPPER',
      lineHeight: pixelLength(40)
    })
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

  describe('a shadow bound to variables', () => {
    /** An effect style with a layer blur, then a shadow whose blur and colour are bound. */
    function boundShadow() {
      const source = designSystem()
      const card = source.createNode('RECTANGLE', source.getPages()[0].id, {
        name: 'Elevation/Card',
        sharedStyleType: 'EFFECT',
        internalOnly: true,
        effects: [
          {
            type: 'LAYER_BLUR',
            color: { r: 0, g: 0, b: 0, a: 0 },
            offset: { x: 0, y: 0 },
            radius: 6,
            spread: 0,
            visible: true
          },
          {
            type: 'DROP_SHADOW',
            color: blue,
            offset: { x: 0, y: 4 },
            radius: 24,
            spread: 0,
            visible: true
          }
        ]
      })
      card.source.id = 'style:card'
      source.bindVariable(card.id, 'effects/1/radius', variableNamed(source, 'Space/Gutter').id)
      source.bindVariable(card.id, 'effects/1/color', variableNamed(source, 'Accent').id)
      return source
    }

    /** The exported files with the styles file's text edited, as another tool would. */
    function editedStyles(source: SceneGraph, edit: (text: string) => string) {
      return exported(source).map((file) =>
        file.path === 'styles.tokens.json' ? { ...file, text: edit(file.text) } : file
      )
    }

    function importedStyle(files: DesignTokenSourceFile[]) {
      const graph = new SceneGraph()
      importInto(graph, files)
      const [style] = getSharedStyles(graph, 'effect')
      return { graph, node: graph.getNode(style.nodeId) }
    }

    test('writes the bound fields as references to their variables’ tokens', () => {
      const styles = exportDesignTokens(boundShadow()).files.find(
        (file) => file.path === 'styles.tokens.json'
      )
      expect(styles?.content).toMatchObject({
        Elevation: { Card: { $value: { blur: '{Space.Gutter}', color: '{Accent}' } } }
      })
    })

    test('reads the references back as bindings on the same effect', () => {
      const { graph, node } = importedStyle(exported(boundShadow()))

      expect(node?.boundVariables).toEqual({
        'effects/1/radius': variableNamed(graph, 'Space/Gutter').id,
        'effects/1/color': variableNamed(graph, 'Accent').id
      })
      expect(node?.effects).toMatchObject([
        { type: 'LAYER_BLUR', radius: 6 },
        { type: 'DROP_SHADOW', radius: 24 }
      ])
    })

    test('binds the references a shadow edited in another tool keeps, and the blur’s own', () => {
      const source = boundShadow()
      const soft = source.createVariable(
        'Blur/Soft',
        'FLOAT',
        variableNamed(source, 'Accent').collectionId,
        6
      )
      const [style] = getSharedStyles(source, 'effect')
      source.bindVariable(style.nodeId, 'effects/0/radius', soft.id)
      const files = editedStyles(source, (text) =>
        text.replace('"offsetY":{"value":4', '"offsetY":{"value":8')
      )
      const { graph, node } = importedStyle(files)

      expect(node?.effects[1]).toMatchObject({ offset: { x: 0, y: 8 }, radius: 24 })
      expect(node?.boundVariables).toEqual({
        'effects/0/radius': variableNamed(graph, 'Blur/Soft').id,
        'effects/1/radius': variableNamed(graph, 'Space/Gutter').id,
        'effects/1/color': variableNamed(graph, 'Accent').id
      })
    })

    test('lets a variable go when the token writes its field as a value again', () => {
      const source = boundShadow()
      const { graph } = importedStyle(exported(source))
      importInto(
        graph,
        editedStyles(source, (text) =>
          text.replace('"blur":"{Space.Gutter}"', '"blur":{"value":30,"unit":"px"}')
        )
      )

      const [style] = getSharedStyles(graph, 'effect')
      const node = graph.getNode(style.nodeId)
      expect(node?.effects[1].radius).toBe(30)
      expect(node?.boundVariables).toEqual({
        'effects/1/color': variableNamed(graph, 'Accent').id
      })
    })

    test('skips a shadow whose field names a token that does not exist', () => {
      const graph = new SceneGraph()
      const { plan } = importInto(
        graph,
        editedStyles(boundShadow(), (text) => text.replace('{Space.Gutter}', '{Space.Missing}'))
      )

      expect(plan.skipped).toContainEqual(
        expect.objectContaining({ name: 'Elevation/Card', reason: 'invalid-value' })
      )
      expect(getSharedStyles(graph, 'effect')).toEqual([])
    })
  })
})

test('a formula token holds its result and keeps the formula with token references', () => {
  const graph = new SceneGraph()
  const space = graph.createCollection('Space')
  const mode = space.defaultModeId
  graph.createVariable('Base', 'FLOAT', space.id, 4)
  const large = graph.createVariable('Large', 'FLOAT', space.id, 0)
  large.valuesByMode[mode] = parseVariableFormula(graph, large.id, mode, '{Base} * 4').value
  const { files, issues } = exportDesignTokens(graph)
  expect(issues).toEqual([])
  const token = JSON.stringify(files.map((file) => file.content))
  expect(token).toContain('"$value":{"value":16,"unit":"px"}')
  expect(token).toContain('"formula":"{Base} * 4"')
})

test('a style bound to one of two variables that share a path reads back bound to the same one', () => {
  const source = new SceneGraph()
  const page = source.getPages()[0].id
  const brand = source.createCollection('Brand')
  source.createVariable('Size', 'FLOAT', brand.id, 12)
  const product = source.createCollection('Product')
  const size = source.createVariable('Size', 'FLOAT', product.id, 20)
  const heading = source.createNode('TEXT', page, {
    name: 'Heading',
    fontFamily: 'Inter',
    fontSize: 20,
    sharedStyleType: 'TEXT',
    internalOnly: true,
    boundVariables: { fontSize: size.id }
  })
  heading.source.id = 'style:heading'
  const card = source.createNode('RECTANGLE', page, {
    name: 'Card',
    sharedStyleType: 'EFFECT',
    internalOnly: true,
    effects: [
      {
        type: 'DROP_SHADOW',
        color: { r: 0, g: 0, b: 0, a: 0.25 },
        offset: { x: 0, y: 4 },
        radius: 20,
        spread: 0,
        visible: true
      }
    ]
  })
  card.source.id = 'style:card'
  source.bindVariable(card.id, 'effects/0/radius', size.id)

  // Other tools read `{Size}` as whichever collection comes last, so the export says so.
  expect(exportDesignTokens(source).issues).toEqual(
    expect.arrayContaining([
      { kind: 'ambiguous-reference', style: 'Heading', field: 'fontSize', token: 'Size' },
      { kind: 'ambiguous-reference', style: 'Card', field: 'effects/0/radius', token: 'Size' }
    ])
  )
  const graph = new SceneGraph()
  importInto(graph, exported(source))

  const productSize = [...graph.variables.values()].find(
    (variable) =>
      variable.name === 'Size' &&
      graph.variableCollections.get(variable.collectionId)?.name === 'Product'
  )?.id
  const [text] = getSharedStyles(graph, 'text')
  const [effect] = getSharedStyles(graph, 'effect')
  expect(graph.getNode(text.nodeId)?.boundVariables.fontSize).toBe(productSize)
  expect(graph.getNode(effect.nodeId)?.boundVariables['effects/0/radius']).toBe(productSize)
})

describe('style bindings to a path two collections share', () => {
  function sharedSize() {
    const source = new SceneGraph()
    const brand = source.createCollection('Brand')
    source.createVariable('Size', 'FLOAT', brand.id, 12)
    const product = source.createCollection('Product')
    const size = source.createVariable('Size', 'FLOAT', product.id, 20)
    return { source, size }
  }

  function heading(source: SceneGraph, size: string) {
    const node = source.createNode('TEXT', source.getPages()[0].id, {
      name: 'Heading',
      fontFamily: 'Inter',
      fontSize: 20,
      lineHeight: pixelLength(20),
      textCase: 'UPPER',
      sharedStyleType: 'TEXT',
      internalOnly: true,
      boundVariables: { fontSize: size, lineHeight: size }
    })
    node.source.id = 'style:heading'
  }

  function importedHeading(files: ReturnType<typeof exported>) {
    const graph = new SceneGraph()
    importInto(graph, files)
    const [style] = getSharedStyles(graph, 'text')
    const productSize = [...graph.variables.values()].find(
      (variable) =>
        variable.name === 'Size' &&
        graph.variableCollections.get(variable.collectionId)?.name === 'Product'
    )?.id
    return { node: graph.getNode(style.nodeId), productSize }
  }

  test('a malformed recorded target leaves the rest of the style’s fields and targets', () => {
    const { source, size } = sharedSize()
    heading(source, size.id)
    const files = exported(source).map((file) =>
      file.path === 'styles.tokens.json'
        ? {
            ...file,
            text: file.text.replace('"targetVariableName":"Size"', '"targetVariableName":7')
          }
        : file
    )

    const { node, productSize } = importedHeading(files)
    expect(node?.textCase).toBe('UPPER')
    expect(productSize).toBeDefined()
    expect(node?.boundVariables.lineHeight).toBe(productSize)
  })

  test('recorded targets that are not a record leave the style’s fields', () => {
    const { source, size } = sharedSize()
    heading(source, size.id)
    const files = exported(source).map((file) =>
      file.path === 'styles.tokens.json'
        ? {
            ...file,
            text: file.text.replace(/"aliasData":\{(?:[^{}]|\{[^{}]*\})*\}/, '"aliasData":null')
          }
        : file
    )
    expect(files.find((file) => file.path === 'styles.tokens.json')?.text).toContain(
      '"aliasData":null'
    )

    expect(importedHeading(files).node?.textCase).toBe('UPPER')
  })

  test('a style dropped as a duplicate warns about none of its references', () => {
    const { source, size } = sharedSize()
    heading(source, size.id)
    heading(source, size.id)

    expect(exportDesignTokens(source).issues).toEqual([
      { kind: 'duplicate-path', collection: 'Styles', token: 'Heading' },
      { kind: 'ambiguous-reference', style: 'Heading', field: 'fontSize', token: 'Size' },
      { kind: 'ambiguous-reference', style: 'Heading', field: 'lineHeight', token: 'Size' }
    ])
  })

  test('a style with no token warns about none of its references', () => {
    const { source, size } = sharedSize()
    const glass = source.createNode('RECTANGLE', source.getPages()[0].id, {
      name: 'Glass',
      sharedStyleType: 'EFFECT',
      internalOnly: true,
      effects: [
        {
          type: 'BACKGROUND_BLUR',
          color: { r: 0, g: 0, b: 0, a: 0 },
          offset: { x: 0, y: 0 },
          radius: 20,
          spread: 0,
          visible: true
        }
      ]
    })
    glass.source.id = 'style:glass'
    source.bindVariable(glass.id, 'effects/0/radius', size.id)

    expect(exportDesignTokens(source).issues).toEqual([
      { kind: 'unsupported-effect', style: 'Glass' }
    ])
  })
})
