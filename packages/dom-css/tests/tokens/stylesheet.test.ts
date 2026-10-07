import { describe, expect, test } from 'bun:test'

import dedent from 'dedent'

import { compileTailwindCSS } from '@open-pencil/dom-css'
import { tokenStylesheet } from '@open-pencil/dom-css/export'
import { SceneGraph, type Variable, type VariableValue } from '@open-pencil/scene-graph'

const BLUE_500 = { r: 0.23, g: 0.51, b: 0.96, a: 1 }
const BLUE_300 = { r: 0.58, g: 0.77, b: 0.99, a: 1 }
const WHITE = { r: 1, g: 1, b: 1, a: 1 }
const INK = { r: 0.07, g: 0.09, b: 0.15, a: 1 }

function add(
  graph: SceneGraph,
  collectionId: string,
  id: string,
  name: string,
  type: Variable['type'],
  valuesByMode: Record<string, VariableValue>,
  extra: Partial<Variable> = {}
): void {
  graph.addVariable({
    id,
    name,
    type,
    collectionId,
    valuesByMode,
    description: '',
    hiddenFromPublishing: false,
    ...extra
  })
}

/** Primitives, a Theme with Light and Dark, and a Space collection with Compact. */
function designSystem(): SceneGraph {
  const graph = new SceneGraph()
  graph.addCollection({
    id: 'primitives',
    name: 'Primitives',
    modes: [{ modeId: 'base', name: 'Base' }],
    defaultModeId: 'base',
    variableIds: []
  })
  add(graph, 'primitives', 'blue-500', 'Blue/500', 'COLOR', { base: BLUE_500 })
  add(graph, 'primitives', 'blue-300', 'Blue/300', 'COLOR', { base: BLUE_300 })
  graph.addCollection({
    id: 'theme',
    name: 'Theme',
    modes: [
      { modeId: 'light', name: 'Light' },
      { modeId: 'dark', name: 'Dark' }
    ],
    defaultModeId: 'light',
    variableIds: []
  })
  add(graph, 'theme', 'primary', 'Primary', 'COLOR', {
    light: { aliasId: 'blue-500' },
    dark: { aliasId: 'blue-300' }
  })
  add(graph, 'theme', 'surface', 'Surface', 'COLOR', { light: WHITE, dark: INK })
  graph.addCollection({
    id: 'space',
    name: 'Space',
    modes: [
      { modeId: 'comfortable', name: 'Comfortable' },
      { modeId: 'compact', name: 'Compact', condition: '@media (max-width: 640px)' }
    ],
    defaultModeId: 'comfortable',
    variableIds: []
  })
  add(
    graph,
    'space',
    'gutter',
    'Gutter',
    'FLOAT',
    { comfortable: 24, compact: 16 },
    { unit: 'rem', scopes: ['GAP'] }
  )
  add(
    graph,
    'space',
    'page',
    'Page',
    'FLOAT',
    { comfortable: 32, compact: 32 },
    {
      scopes: ['WIDTH_HEIGHT'],
      expressions: { comfortable: { css: 'clamp(1rem, 4vw, 2rem)', resolved: 32 } }
    }
  )
  return graph
}

describe('token stylesheet', () => {
  test('writes defaults to :root and every other mode under its condition', async () => {
    const { css, issues } = await tokenStylesheet(designSystem(), { format: 'css' })
    expect(issues).toEqual([])
    expect(css).toBe(
      dedent`
      :root {
        --color-blue-500: #3B82F5;
        --color-blue-300: #94C4FC;
        --color-primary: var(--color-blue-500);
        --color-surface: #FFFFFF;
        --spacing-gutter: 1.5rem;
        --spacing-page: clamp(1rem, 4vw, 2rem);
      }

      /* Theme: Dark */
      [data-theme="dark"] {
        --color-primary: var(--color-blue-300);
        --color-surface: #121726;
      }

      /* Space: Compact */
      @media (max-width: 640px) {
        :root {
          --spacing-gutter: 1rem;
          --spacing-page: 32px;
        }
      }
    ` + '\n'
    )
  })

  test('switches manual modes by the attribute the collection names', async () => {
    const graph = designSystem()
    const theme = graph.variableCollections.get('theme')
    if (theme) theme.modeAttribute = 'data-scheme'

    const { css } = await tokenStylesheet(graph, { format: 'css' })

    expect(css).toContain('[data-scheme="dark"] {')
    expect(css).not.toContain('data-theme')
  })

  test('declares an alias again where a mode changes what it points to', async () => {
    const graph = new SceneGraph()
    graph.addCollection({
      id: 'brand',
      name: 'Brand',
      modes: [
        { modeId: 'acme', name: 'Acme' },
        { modeId: 'globex', name: 'Globex' }
      ],
      defaultModeId: 'acme',
      variableIds: []
    })
    add(graph, 'brand', 'accent', 'Accent', 'COLOR', { acme: BLUE_500, globex: INK })
    graph.addCollection({
      id: 'semantic',
      name: 'Semantic',
      modes: [{ modeId: 'one', name: 'One' }],
      defaultModeId: 'one',
      variableIds: []
    })
    add(graph, 'semantic', 'link', 'Link', 'COLOR', { one: { aliasId: 'accent' } })
    add(graph, 'semantic', 'focus', 'Focus', 'COLOR', { one: { aliasId: 'link' } })

    const { css } = await tokenStylesheet(graph, { format: 'css' })

    expect(css).toContain(dedent`
      [data-brand="globex"] {
        --color-accent: #121726;
        --color-link: var(--color-accent);
        --color-focus: var(--color-link);
      }
    `)
  })

  test('name a mode with no letters or digits after its id, made safe for selectors', async () => {
    const graph = new SceneGraph()
    graph.addCollection({
      id: 'theme',
      name: 'Theme',
      modes: [
        { modeId: '1:1', name: 'Day' },
        { modeId: '1:2', name: '🌙' }
      ],
      defaultModeId: '1:1',
      variableIds: []
    })
    add(graph, 'theme', 'surface', 'Surface', 'COLOR', { '1:1': WHITE, '1:2': INK })

    const { css, issues } = await tokenStylesheet(graph, { format: 'tailwind' })

    expect(issues).toEqual([])
    expect(css).toContain('[data-theme="mode-1-2"] {')
    expect(css).toContain(
      '@custom-variant mode-1-2 (&:where([data-theme="mode-1-2"], [data-theme="mode-1-2"] *));'
    )
  })

  test('numbers modes whose names slug alike, so neither overrides the other', async () => {
    const graph = new SceneGraph()
    graph.addCollection({
      id: 'theme',
      name: 'Theme',
      modes: [
        { modeId: 'light', name: 'Light' },
        { modeId: 'dark', name: 'Dark' },
        { modeId: 'dark-alt', name: 'dark!' }
      ],
      defaultModeId: 'light',
      variableIds: []
    })
    add(graph, 'theme', 'surface', 'Surface', 'COLOR', {
      light: WHITE,
      dark: INK,
      'dark-alt': BLUE_500
    })

    const { css, issues } = await tokenStylesheet(graph, { format: 'tailwind' })

    expect(issues).toEqual([])
    expect(css).toContain('[data-theme="dark"] {\n  --color-surface: #121726;')
    expect(css).toContain('[data-theme="dark-2"] {\n  --color-surface: #3B82F5;')
    expect(css).toContain('@custom-variant dark (')
    expect(css).toContain('@custom-variant dark-2 (')
  })

  test('reports and skips what cannot be written as CSS', async () => {
    const graph = new SceneGraph()
    graph.addCollection({
      id: 'misc',
      name: 'Misc',
      modes: [
        { modeId: 'a', name: 'A' },
        { modeId: 'b', name: 'B', condition: '.x } body { display: none' }
      ],
      defaultModeId: 'a',
      variableIds: []
    })
    add(graph, 'misc', 'flag', 'Flag', 'BOOLEAN', { a: true, b: false })
    add(
      graph,
      'misc',
      'gap',
      'Gap',
      'FLOAT',
      { a: 8, b: 4 },
      {
        expressions: { a: { css: '1px; } body { display: none', resolved: 8 } }
      }
    )
    add(graph, 'misc', 'label', 'Label', 'STRING', { a: 'Say "hi"', b: 'Bye' })

    const { css, issues } = await tokenStylesheet(graph, { format: 'css' })

    expect(css).toBe(':root {\n  --label: "Say \\"hi\\"";\n}\n')
    expect(issues.map((issue) => issue.message)).toEqual([
      'Flag is a boolean, which CSS has no value for',
      'Gap is not a valid CSS declaration: --gap: 1px; } body { display: none',
      'Misc: B has a condition that is not a selector or a @media, @supports or @container query: .x } body { display: none'
    ])
  })

  test('puts namespaced tokens in @theme, so Tailwind generates utilities and mode variants', async () => {
    const { css, issues } = await tokenStylesheet(designSystem(), { format: 'tailwind' })
    expect(issues).toEqual([])
    expect(css).toStartWith('@theme {\n  --color-blue-500: #3B82F5;')
    expect(css).toContain(
      '@custom-variant dark (&:where([data-theme="dark"], [data-theme="dark"] *));'
    )
    expect(css).toContain('@custom-variant compact (@media (max-width: 640px));')

    const compiled = await compileTailwindCSS(['bg-primary', 'gap-gutter', 'dark:bg-surface'], {
      css
    })
    expect(compiled).toContain('background-color: var(--color-primary)')
    expect(compiled).toContain('gap: var(--spacing-gutter)')
    expect(compiled).toMatch(/:where\(\[data-theme="dark"\], \[data-theme="dark"\] \*\)/)
  })
})
