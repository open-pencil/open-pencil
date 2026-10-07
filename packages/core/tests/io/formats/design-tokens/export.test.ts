import { describe, expect, test } from 'bun:test'

import { SceneGraph } from '@open-pencil/scene-graph'

import { exportDesignTokens, RESOLVER_FILE, STYLES_FILE } from '#core/io/formats/design-tokens'

const blue = { r: 0, g: 0.4, b: 0.8, a: 1 }
const white = { r: 1, g: 1, b: 1, a: 1 }

function designSystem() {
  const graph = new SceneGraph()
  const page = graph.getPages()[0].id
  const primitives = graph.createCollection('Primitives')
  const brand = graph.createVariable('Blue/500', 'COLOR', primitives.id, blue)
  const theme = graph.createCollection('Theme')
  const light = theme.defaultModeId
  graph.renameMode(theme.id, light, 'Light')
  const dark = graph.createMode(theme.id, 'Dark') ?? ''
  const accent = graph.createVariable('Accent', 'COLOR', theme.id, { aliasId: brand.id })
  accent.valuesByMode[dark] = white
  accent.description = 'Buttons and links'
  const gutter = graph.createVariable('Space', 'FLOAT', theme.id, 24)
  gutter.unit = 'rem'
  graph.createVariable('Space/Small', 'FLOAT', theme.id, 8)
  const fast = graph.createVariable('Motion/Fast', 'FLOAT', theme.id, 150)
  fast.unit = 'ms'
  graph.createVariable('Flags/Rounded', 'BOOLEAN', theme.id, true)
  const family = graph.createVariable('Font/Body', 'STRING', theme.id, 'Inter')
  family.scopes = ['FONT_FAMILY']
  graph.createVariable('Ratio 1.5', 'FLOAT', theme.id, 1.5)

  const heading = graph.createNode('TEXT', page, {
    name: 'Heading/H1',
    fontFamily: 'Inter',
    fontWeight: 700,
    fontSize: 32,
    lineHeight: 40,
    letterSpacing: -0.5,
    sharedStyleType: 'TEXT',
    internalOnly: true,
    boundVariables: { fontFamily: family.id }
  })
  heading.source.id = 'style:heading'
  const card = graph.createNode('RECTANGLE', page, {
    name: 'Elevation/Card',
    sharedStyleType: 'EFFECT',
    internalOnly: true,
    effects: [
      {
        type: 'DROP_SHADOW',
        color: { r: 0, g: 0, b: 0, a: 0.25 },
        offset: { x: 0, y: 4 },
        radius: 12,
        spread: 0,
        visible: true
      }
    ]
  })
  card.source.id = 'style:card'
  return graph
}

function file(graph: SceneGraph, path: string) {
  const found = exportDesignTokens(graph).files.find((entry) => entry.path === path)
  if (!found) throw new Error(`missing ${path}`)
  return found.content
}

describe('design token export', () => {
  test('writes one file per mode, the styles, and a resolver', () => {
    expect(exportDesignTokens(designSystem()).files.map((entry) => entry.path)).toEqual([
      'Primitives/Mode 1.tokens.json',
      'Theme/Light.tokens.json',
      'Theme/Dark.tokens.json',
      STYLES_FILE,
      RESOLVER_FILE
    ])
  })

  test('writes values the way Figma imports them', () => {
    const light = file(designSystem(), 'Theme/Light.tokens.json')

    expect(light.Accent).toEqual({
      $type: 'color',
      $value: '{Blue.500}',
      $description: 'Buttons and links',
      $extensions: {
        'com.figma.aliasData': {
          targetVariableName: 'Blue/500',
          targetVariableSetName: 'Primitives'
        }
      }
    })
    expect(light.Space).toEqual({
      $root: {
        $type: 'dimension',
        $value: { value: 24, unit: 'px' },
        $extensions: { 'dev.openpencil': { unit: 'rem' } }
      },
      Small: { $type: 'dimension', $value: { value: 8, unit: 'px' } }
    })
    expect(light.Motion).toEqual({
      Fast: {
        $type: 'duration',
        $value: { value: 0.15, unit: 's' },
        $extensions: { 'dev.openpencil': { unit: 'ms' } }
      }
    })
    expect(light.Flags).toEqual({
      Rounded: { $type: 'number', $value: 1, $extensions: { 'com.figma.type': 'boolean' } }
    })
    expect(light.Font).toEqual({
      Body: {
        $type: 'fontFamily',
        $value: 'Inter',
        $extensions: { 'dev.openpencil': { scopes: ['FONT_FAMILY'] } }
      }
    })
  })

  test('keeps a name a token path cannot hold, and the mode it belongs to', () => {
    const dark = file(designSystem(), 'Theme/Dark.tokens.json')

    expect(dark['Ratio 1-5']).toEqual({
      $type: 'dimension',
      $value: { value: 1.5, unit: 'px' },
      $extensions: { 'dev.openpencil': { name: 'Ratio 1.5' } }
    })
    expect(dark.Accent).toMatchObject({
      $value: { colorSpace: 'srgb', components: [1, 1, 1], alpha: 1, hex: '#ffffff' }
    })
    expect(dark.$extensions).toEqual({
      'dev.openpencil': { collection: 'Theme', mode: 'Dark', default: false }
    })
  })

  test('writes text and effect styles as typography and shadow tokens', () => {
    const styles = file(designSystem(), STYLES_FILE)

    expect(styles.Heading).toMatchObject({
      H1: {
        $type: 'typography',
        $value: {
          fontFamily: '{Font.Body}',
          fontSize: { value: 32, unit: 'px' },
          fontWeight: 700,
          lineHeight: 1.25,
          letterSpacing: { value: -0.5, unit: 'px' }
        }
      }
    })
    expect(styles.Elevation).toEqual({
      Card: {
        $type: 'shadow',
        $value: {
          color: { colorSpace: 'srgb', components: [0, 0, 0], alpha: 0.25, hex: '#000000' },
          offsetX: { value: 0, unit: 'px' },
          offsetY: { value: 4, unit: 'px' },
          blur: { value: 12, unit: 'px' },
          spread: { value: 0, unit: 'px' }
        }
      }
    })
  })

  test('a collection named like the styles set gets a name of its own in the resolver', () => {
    const graph = designSystem()
    const styles = graph.createCollection('Styles')
    graph.createVariable('Gap', 'FLOAT', styles.id, 4)

    const resolver = exportDesignTokens(graph).files.find((file) => file.path === RESOLVER_FILE)
    const content = resolver?.content as { sets?: object } | undefined

    expect(Object.keys(content?.sets ?? {})).toEqual(['Primitives', 'Styles 2', 'Styles'])
  })

  test('without styles, a collection named Styles keeps its name in the resolver', () => {
    const graph = new SceneGraph()
    const styles = graph.createCollection('Styles')
    graph.createVariable('Gap', 'FLOAT', styles.id, 4)

    const resolver = exportDesignTokens(graph).files.find((file) => file.path === RESOLVER_FILE)
    const content = resolver?.content as { sets?: object } | undefined

    expect(Object.keys(content?.sets ?? {})).toEqual(['Styles'])
  })

  test('the resolver switches collections with several modes and layers the rest', () => {
    expect(file(designSystem(), RESOLVER_FILE)).toEqual({
      version: '2025-11-01',
      sets: {
        Primitives: { sources: [{ $ref: 'Primitives/Mode 1.tokens.json' }] },
        Styles: { sources: [{ $ref: STYLES_FILE }] }
      },
      modifiers: {
        Theme: {
          contexts: {
            Light: [{ $ref: 'Theme/Light.tokens.json' }],
            Dark: [{ $ref: 'Theme/Dark.tokens.json' }]
          },
          default: 'Light'
        }
      },
      resolutionOrder: [
        { $ref: '#/sets/Primitives' },
        { $ref: '#/modifiers/Theme' },
        { $ref: '#/sets/Styles' }
      ]
    })
  })
})
