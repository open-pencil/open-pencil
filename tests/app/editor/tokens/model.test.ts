import { describe, expect, test } from 'bun:test'

import { SceneGraph, type Variable, type VariableValue } from '@open-pencil/scene-graph'

import {
  aliasCandidates,
  groupTree,
  inGroup,
  modeAttributeText,
  nameInGroup,
  parseTokenValueText,
  reorderedVariableIds,
  searchTokenIds,
  tokenGroups,
  tokenValueText,
  type TokenGroup
} from '@/app/editor/tokens/model'

function graphWith(variables: Array<[string, Variable['type'], VariableValue]>) {
  const graph = new SceneGraph()
  graph.addCollection({
    id: 'c',
    name: 'Theme',
    modes: [{ modeId: 'm', name: 'Mode' }],
    defaultModeId: 'm',
    variableIds: []
  })
  for (const [id, type, value] of variables)
    graph.addVariable({
      id,
      name: id,
      type,
      collectionId: 'c',
      valuesByMode: { m: value },
      description: '',
      hiddenFromPublishing: false
    })
  return graph
}

function variable(graph: SceneGraph, id: string): Variable {
  const found = graph.variables.get(id)
  if (!found) throw new Error(`missing ${id}`)
  return found
}

describe('groups', () => {
  const row = { label: '', cssName: '', values: [] } as const
  const groups = (paths: Array<[string, number]>): TokenGroup[] =>
    paths.map(([path, count]) => ({
      path,
      rows: Array.from({ length: count }, (_, index) => ({
        ...row,
        variable: {
          id: `${path}-${index}`,
          name: '',
          type: 'COLOR',
          collectionId: 'c',
          valuesByMode: {},
          description: '',
          hiddenFromPublishing: false
        },
        values: []
      }))
    }))

  test('nest under their parents, which count everything inside them', () => {
    expect(
      groupTree(
        groups([
          ['', 1],
          ['Text', 2],
          ['Space/Inline', 3]
        ])
      )
    ).toEqual([
      { path: 'Text', label: 'Text', depth: 0, count: 2 },
      { path: 'Space', label: 'Space', depth: 0, count: 3 },
      { path: 'Space/Inline', label: 'Inline', depth: 1, count: 3 }
    ])
  })

  test('a group holds its own tokens and those of groups inside it', () => {
    expect(inGroup('Space/Inline', 'Space')).toBe(true)
    expect(inGroup('Space', 'Space')).toBe(true)
    expect(inGroup('Spacer', 'Space')).toBe(false)
  })

  test('moving a token keeps its own name', () => {
    expect(nameInGroup('Brand/Primary', 'Theme/Brand')).toBe('Theme/Brand/Primary')
    expect(nameInGroup('Brand/Primary', '')).toBe('Primary')
  })
})

describe('typed values', () => {
  const gutter: Variable = {
    id: 'g',
    name: 'Gutter',
    type: 'FLOAT',
    collectionId: 'c',
    valuesByMode: { m: 24 },
    description: '',
    hiddenFromPublishing: false,
    unit: 'rem'
  }

  test('numbers read and write in the token unit', () => {
    expect(tokenValueText(gutter, 24)).toBe('1.5')
    expect(parseTokenValueText(gutter, '2')).toBe(32)
    expect(parseTokenValueText(gutter, 'wide')).toBeUndefined()
  })
})

describe('token search', () => {
  function rows() {
    const graph = graphWith([
      ['primary', 'COLOR', { r: 0.23, g: 0.51, b: 0.96, a: 1 }],
      ['link', 'COLOR', { aliasId: 'primary' }],
      ['gutter', 'FLOAT', 24]
    ])
    const brand = graph.variables.get('primary')
    if (brand) {
      brand.name = 'Brand/Primary'
      brand.description = 'Buttons and focus rings'
    }
    const collection = graph.variableCollections.get('c')
    if (!collection) throw new Error('missing collection')
    return tokenGroups(graph, collection, [...graph.variables.values()]).flatMap(
      (group) => group.rows
    )
  }

  test.each<[string, string[]]>([
    ['brand primary', ['primary', 'link']],
    ['--color-brand', ['primary']],
    ['#3B82F5', ['primary']],
    ['focus rings', ['primary']],
    ['Brand/Primary', ['primary', 'link']],
    ['gutter', ['gutter']]
  ])('%s finds %o', (query, ids) => {
    expect([...(searchTokenIds(rows(), query) ?? [])].sort()).toEqual([...ids].sort())
  })

  test('an empty search filters nothing', () => {
    expect(searchTokenIds(rows(), '  ')).toBeNull()
  })
})

describe('alias previews', () => {
  test('show what the alias gives in their own mode', () => {
    const graph = new SceneGraph()
    const theme = graph.createCollection('Theme')
    const dark = graph.createMode(theme.id, 'Dark') ?? ''
    const white = { r: 1, g: 1, b: 1, a: 1 }
    const black = { r: 0, g: 0, b: 0, a: 1 }
    const surface = graph.createVariable('Surface', 'COLOR', theme.id, white)
    surface.valuesByMode[dark] = black
    const card = graph.createVariable('Card', 'COLOR', theme.id, { aliasId: surface.id })
    card.valuesByMode[dark] = { aliasId: surface.id }

    const [row] = tokenGroups(graph, theme, [card]).flatMap((group) => group.rows)

    expect(row.values.map((value) => value.color)).toEqual([white, black])
  })
})

describe('mode attributes', () => {
  test('a manual mode is turned on by the attribute its collection and name give', () => {
    const graph = new SceneGraph()
    const theme = graph.createCollection('Theme')
    const dark = graph.createMode(theme.id, 'Dark') ?? ''

    expect(modeAttributeText(theme, dark)).toBe('data-theme="dark"')
  })
})

describe('reordering', () => {
  test('moves a row among the visible ones', () => {
    expect(reorderedVariableIds(['a', 'b', 'c'], ['a', 'b', 'c'], 'c', 0)).toEqual(['c', 'a', 'b'])
  })

  test('leaves rows a filter hides where they were', () => {
    expect(reorderedVariableIds(['a', 'x', 'b', 'y', 'c'], ['a', 'b', 'c'], 'a', 2)).toEqual([
      'b',
      'x',
      'c',
      'y',
      'a'
    ])
  })
})

describe('alias candidates', () => {
  test('offer variables of the same type, never the token itself', () => {
    const graph = graphWith([
      ['primary', 'COLOR', { r: 0, g: 0, b: 1, a: 1 }],
      ['accent', 'COLOR', { r: 1, g: 0, b: 0, a: 1 }],
      ['gap', 'FLOAT', 8]
    ])

    const candidates = aliasCandidates(graph, variable(graph, 'primary'))

    expect(candidates.map((candidate) => candidate.id)).toEqual(['accent'])
    expect(candidates[0]).toMatchObject({
      name: 'accent',
      collection: 'Theme',
      color: { r: 1, g: 0, b: 0, a: 1 }
    })
  })

  test('leave out variables that already point back at the token', () => {
    const graph = graphWith([
      ['base', 'FLOAT', 8],
      ['middle', 'FLOAT', { aliasId: 'base' }],
      ['top', 'FLOAT', { aliasId: 'middle' }],
      ['other', 'FLOAT', 4]
    ])

    const candidates = aliasCandidates(graph, variable(graph, 'base'))

    expect(candidates.map((candidate) => candidate.id)).toEqual(['other'])
  })
})
