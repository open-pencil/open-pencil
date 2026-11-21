import { describe, expect, test } from 'bun:test'

import {
  defaultTokenImportOptions,
  importTokensIntoGraph,
  planTokenImport,
  readDesignTokens
} from '@open-pencil/core/io/formats/design-tokens'
import { SceneGraph, type Variable } from '@open-pencil/scene-graph'
import { colorToHex } from '@open-pencil/scene-graph/color'
import { resolveColorVariable } from '@open-pencil/scene-graph/variables'
import { expectDefined } from '@open-pencil/test-support/assert'

import { tokenPresetFiles } from '@/app/editor/tokens/presets/files'

function importBootstrap() {
  const graph = new SceneGraph()
  const bundle = readDesignTokens(tokenPresetFiles('bootstrap'))
  const plan = planTokenImport(graph, bundle, defaultTokenImportOptions(graph, bundle))
  importTokensIntoGraph(graph, graph.getPages()[0].id, plan)
  const variables = [...graph.variables.values()]
  const byName = (name: string): Variable | undefined =>
    variables.find((variable) => variable.name === name)
  const hex = (name: string) =>
    colorToHex(expectDefined(resolveColorVariable(graph, byName(name)?.id ?? ''), name))
  return { graph, bundle, variables, byName, hex }
}

describe('Bootstrap token preset', () => {
  test('imports its colors, shades, theme colors, and spacers as one Bootstrap collection', () => {
    const { graph, bundle, variables } = importBootstrap()
    expect(bundle.issues).toEqual([])
    expect([...graph.variableCollections.values()].map((c) => c.name)).toEqual(['Bootstrap'])
    // 10 colors and gray, 9 shades each, black, white, and 8 theme colors.
    expect(variables.filter((variable) => variable.type === 'COLOR')).toHaveLength(109)
    expect(variables.filter((variable) => variable.name.startsWith('spacing/'))).toHaveLength(6)
  })

  test('shades match the ones Bootstrap mixes from each color', () => {
    const { hex } = importBootstrap()
    expect(hex('color/blue/500')).toBe('#0D6EFD')
    expect(hex('color/blue/100')).toBe('#CFE2FF')
    expect(hex('color/blue/900')).toBe('#031633')
    expect(hex('color/gray/600')).toBe('#6C757D')
  })

  test('theme colors point at the shade they are, named in code as Bootstrap names them', () => {
    const { byName, hex } = importBootstrap()
    const primary = byName('color/primary')
    const blue = expectDefined(byName('color/blue/500'), 'color/blue/500')
    expect(Object.values(primary?.valuesByMode ?? {})).toEqual([{ aliasId: blue.id }])
    expect(primary?.codeSyntax).toEqual({ WEB: 'var(--bs-primary)' })
    expect(hex('color/secondary')).toBe('#6C757D')
    expect(byName('color/blue/100')?.codeSyntax).toBeUndefined()
  })

  test('spacers are multiples of 1rem, offered for gaps, padding, and sizes', () => {
    const { byName } = importBootstrap()
    expect(byName('spacing/3')).toMatchObject({ unit: 'rem', scopes: ['GAP', 'WIDTH_HEIGHT'] })
    expect(Object.values(byName('spacing/5')?.valuesByMode ?? {})).toEqual([48])
  })
})
