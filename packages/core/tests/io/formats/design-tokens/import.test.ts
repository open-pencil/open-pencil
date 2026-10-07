import { describe, expect, test } from 'bun:test'

import { SceneGraph } from '@open-pencil/scene-graph'

import {
  defaultTokenImportOptions,
  planTokenImport,
  readDesignTokens,
  type DesignTokenSourceFile
} from '#core/io/formats/design-tokens'

function files(entries: Record<string, unknown>): DesignTokenSourceFile[] {
  return Object.entries(entries).map(([path, content]) => ({
    path,
    text: typeof content === 'string' ? content : JSON.stringify(content)
  }))
}

function plan(input: DesignTokenSourceFile[]) {
  const graph = new SceneGraph()
  const bundle = readDesignTokens(input)
  return { bundle, plan: planTokenImport(graph, bundle, defaultTokenImportOptions(graph, bundle)) }
}

describe('reading token files', () => {
  test('a file per mode makes a collection named after its folder', () => {
    const bundle = readDesignTokens(
      files({
        'Brand/Light.tokens.json': { color: { $type: 'color', bg: { $value: '#ffffff' } } },
        'Brand/Dark.tokens.json': { color: { $type: 'color', bg: { $value: '#000000' } } }
      })
    )

    expect(bundle.collections.map((collection) => collection.name)).toEqual(['Brand'])
    expect(bundle.collections[0].modes.map((mode) => [mode.name, mode.tokens[0].name])).toEqual([
      ['Light', 'color/bg'],
      ['Dark', 'color/bg']
    ])
  })

  test('a resolver makes a collection of each modifier and of each set', () => {
    const bundle = readDesignTokens(
      files({
        'tokens.resolver.json': {
          version: '2025-11-01',
          sets: { Core: { sources: [{ $ref: 'core.json' }] } },
          modifiers: {
            Theme: {
              contexts: { light: [{ $ref: 'light.json' }], dark: [{ $ref: 'dark.json' }] },
              default: 'dark'
            }
          },
          resolutionOrder: [{ $ref: '#/sets/Core' }, { $ref: '#/modifiers/Theme' }]
        },
        'core.json': { space: { $type: 'dimension', md: { $value: { value: 1, unit: 'rem' } } } },
        'light.json': { surface: { $type: 'color', $value: '{palette.white}' } },
        'dark.json': { surface: { $type: 'color', $value: '{palette.black}' } }
      })
    )

    expect(bundle.collections.map((collection) => collection.name)).toEqual(['Core', 'Theme'])
    expect(bundle.collections[1].modes.map((mode) => [mode.name, mode.isDefault])).toEqual([
      ['light', false],
      ['dark', true]
    ])
  })

  test('a resolver finds files picked without their folders by name', () => {
    const bundle = readDesignTokens(
      files({
        'tokens.resolver.json': {
          version: '2025-11-01',
          sets: { Core: { sources: [{ $ref: 'Core/Mode 1.tokens.json' }] } },
          resolutionOrder: [{ $ref: '#/sets/Core' }]
        },
        'Mode 1.tokens.json': { gap: { $type: 'number', $value: 4 } }
      })
    )

    expect(bundle.issues).toEqual([])
    expect(bundle.collections[0].modes[0].tokens.map((token) => token.name)).toEqual(['gap'])
  })

  test('Tokens Studio themes become modes of their group, and the sets they refer to collections', () => {
    const bundle = readDesignTokens(
      files({
        'tokens.json': {
          core: { blue: { $type: 'color', $value: '#0066cc' } },
          light: { accent: { $type: 'color', $value: '{blue}' } },
          dark: { accent: { $type: 'color', $value: '#ffffff' } },
          $themes: [
            {
              name: 'Light',
              group: 'Theme',
              selectedTokenSets: { core: 'source', light: 'enabled' }
            },
            { name: 'Dark', group: 'Theme', selectedTokenSets: { core: 'source', dark: 'enabled' } }
          ]
        }
      })
    )

    expect(bundle.collections.map((collection) => collection.name)).toEqual(['core', 'Theme'])
    expect(bundle.collections[1].modes.map((mode) => mode.name)).toEqual(['Light', 'Dark'])
  })

  test('a file that is not JSON is reported and the rest still read', () => {
    const bundle = readDesignTokens(
      files({ 'broken.json': '{', 'ok.tokens.json': { gap: { $type: 'number', $value: 4 } } })
    )

    expect(bundle.issues).toEqual([{ kind: 'invalid-file', file: 'broken.json' }])
    expect(bundle.collections).toHaveLength(1)
  })
})

describe('planning an import', () => {
  test('values from other tools convert into canvas units and sRGB', () => {
    const { plan: result } = plan(
      files({
        'Tokens/Default.tokens.json': {
          space: { $type: 'dimension', md: { $value: { value: 1.5, unit: 'rem' } } },
          brand: { $type: 'color', $value: { colorSpace: 'oklch', components: [0.6, 0.15, 250] } },
          weight: { $type: 'fontWeight', $value: 'semi-bold' },
          quick: { $type: 'duration', $value: { value: 150, unit: 'ms' } }
        }
      })
    )

    const byName = Object.fromEntries(
      result.collections[0].variables.map((variable) => [variable.name, variable])
    )
    expect(byName['space/md']).toMatchObject({
      type: 'FLOAT',
      unit: 'rem',
      values: [{ value: 24 }]
    })
    expect(byName.weight).toMatchObject({ values: [{ value: 600 }], scopes: ['FONT_STYLE'] })
    expect(byName.quick).toMatchObject({ unit: 'ms', values: [{ value: 150 }] })
    expect(byName.brand.values[0]).toMatchObject({ kind: 'literal' })
  })

  test('an untyped alias takes the type of what it points at', () => {
    const { plan: result } = plan(
      files({
        'Tokens/Default.tokens.json': {
          base: { $type: 'color', $value: '#0066cc' },
          link: { $value: '{base}' }
        }
      })
    )

    expect(
      result.collections[0].variables.map((variable) => [variable.name, variable.type])
    ).toEqual([
      ['base', 'COLOR'],
      ['link', 'COLOR']
    ])
    expect(result.collections[0].variables[1].values).toEqual([
      { kind: 'alias', target: { kind: 'planned', collection: 0, variable: 0 } }
    ])
  })

  test('a token that is also a group keeps its name through `$root`', () => {
    const { plan: result } = plan(
      files({
        'Tokens/Default.tokens.json': {
          space: {
            $type: 'number',
            $root: { $value: 8 },
            small: { $value: 4 },
            half: { $value: '{space.$root}' }
          }
        }
      })
    )

    expect(result.collections[0].variables.map((variable) => variable.name)).toEqual([
      'space',
      'space/small',
      'space/half'
    ])
  })

  test('an alias to a collection whose name repeats points into the first one', () => {
    const token = (path: string, value: unknown, extensions: Record<string, unknown> = {}) => ({
      path: path.split('.'),
      name: path,
      type: 'color',
      value,
      description: undefined,
      extensions
    })
    const theme = (tokens: ReturnType<typeof token>[]) => ({
      name: 'Theme',
      modeAttribute: undefined,
      modes: [{ name: 'Light', isDefault: true, condition: undefined, tokens }]
    })
    const bundle = {
      collections: [
        theme([token('brand', '#0066cc')]),
        theme([token('other', '#ffffff'), token('extra', '#000000')]),
        {
          ...theme([
            token('link', '{brand}', {
              'com.figma.aliasData': { targetVariableName: 'brand', targetVariableSetName: 'Theme' }
            })
          ]),
          name: 'Links'
        }
      ],
      composites: [],
      issues: []
    }
    const graph = new SceneGraph()

    const result = planTokenImport(graph, bundle, defaultTokenImportOptions(graph, bundle))

    expect(result.collections[2].variables[0].values).toEqual([
      { kind: 'alias', target: { kind: 'planned', collection: 0, variable: 0 } }
    ])
  })

  test('an alias to a collection left out is missing, not bound to the same path elsewhere', () => {
    const graph = new SceneGraph()
    const other = graph.createCollection('Other')
    graph.createVariable('blue/500', 'COLOR', other.id, { r: 1, g: 0, b: 0, a: 1 })
    const bundle = readDesignTokens(
      files({
        'Primitives/Value.tokens.json': { blue: { 500: { $type: 'color', $value: '#3b82f6' } } },
        'Theme/Light.tokens.json': {
          accent: {
            $type: 'color',
            $value: '{blue.500}',
            $extensions: {
              'com.figma.aliasData': {
                targetVariableName: 'blue/500',
                targetVariableSetName: 'Primitives'
              }
            }
          }
        }
      })
    )
    const options = defaultTokenImportOptions(graph, bundle)
    options.collections[0].target = { kind: 'skip' }

    const result = planTokenImport(graph, bundle, options)

    expect(result.skipped).toContainEqual({
      name: 'accent',
      collection: 'Theme',
      reason: 'missing-alias'
    })
  })

  test('composite tokens other than typography and shadow are skipped with a reason', () => {
    const { plan: result } = plan(
      files({
        'styles.tokens.json': {
          card: {
            $type: 'border',
            $value: { color: '#000', width: { value: 1, unit: 'px' }, style: 'solid' }
          },
          lift: {
            $type: 'shadow',
            $value: {
              color: '#00000040',
              offsetX: { value: 0, unit: 'px' },
              offsetY: { value: 2, unit: 'px' },
              blur: { value: 4, unit: 'px' },
              spread: { value: 0, unit: 'px' }
            }
          }
        }
      })
    )

    expect(result.skipped).toEqual([
      { name: 'card', collection: undefined, reason: 'unsupported-type' }
    ])
    expect(result.styles).toMatchObject([
      {
        kind: 'EFFECT',
        name: 'lift',
        fields: { effects: [{ type: 'DROP_SHADOW', offset: { x: 0, y: 2 }, radius: 4 }] }
      }
    ])
  })
})
