import { describe, expect, test } from 'bun:test'

import {
  defaultTokenImportOptions,
  importTokensIntoGraph,
  planTokenImport,
  readDesignTokens
} from '@open-pencil/core/io/formats/design-tokens'
import { SceneGraph } from '@open-pencil/scene-graph'

import { tokenPresetFiles } from '@/app/editor/tokens/presets/files'

/** A new document with the Tailwind preset imported as the import dialog's defaults would. */
function importTailwind() {
  const graph = new SceneGraph()
  const bundle = readDesignTokens(tokenPresetFiles('tailwind'))
  const plan = planTokenImport(graph, bundle, defaultTokenImportOptions(graph, bundle))
  importTokensIntoGraph(graph, graph.getPages()[0].id, plan)
  const variables = [...graph.variables.values()]
  const byName = (name: string) => variables.find((variable) => variable.name === name)
  return { graph, bundle, variables, byName }
}

describe('Tailwind token preset', () => {
  test('reads as one Tailwind collection, with nothing left out', () => {
    const { bundle } = importTailwind()
    expect(bundle.issues).toEqual([])
    expect(bundle.collections.map((collection) => collection.name)).toEqual(['Tailwind'])
  })

  test('imports every default color and spacing step', () => {
    const { graph, variables } = importTailwind()
    const colors = variables.filter((variable) => variable.type === 'COLOR')
    // 26 palettes of 11 shades, black, and white.
    expect(colors).toHaveLength(288)
    expect(variables.filter((variable) => variable.name.startsWith('spacing/'))).toHaveLength(35)
    expect([...graph.variableCollections.values()].map((c) => c.name)).toEqual(['Tailwind'])
  })

  test('names colors by palette and shade, and in code as Tailwind does', () => {
    const { graph, byName } = importTailwind()
    const blue = byName('color/blue/500')
    expect(blue?.codeSyntax).toEqual({ WEB: 'var(--color-blue-500)' })
    const collection = graph.variableCollections.get(blue?.collectionId ?? '')
    const value = blue?.valuesByMode[collection?.defaultModeId ?? '']
    // oklch(62.3% 0.214 259.815) is about #2B7FFF.
    expect(value).toMatchObject({ r: expect.closeTo(0.17, 1), b: expect.closeTo(1, 1) })
    expect(byName('color/white')).toBeDefined()
  })

  test('spacing steps are multiples of 0.25rem, offered for gaps, padding, and sizes', () => {
    const { byName } = importTailwind()
    const four = byName('spacing/4')
    expect(four).toMatchObject({ unit: 'rem', scopes: ['GAP', 'WIDTH_HEIGHT'] })
    expect(four?.codeSyntax).toEqual({ WEB: 'calc(var(--spacing) * 4)' })
    expect(Object.values(four?.valuesByMode ?? {})).toEqual([16])
    expect(Object.values(byName('spacing/0.5')?.valuesByMode ?? {})).toEqual([2])
    expect(Object.values(byName('spacing/px')?.valuesByMode ?? {})).toEqual([1])
  })
})
