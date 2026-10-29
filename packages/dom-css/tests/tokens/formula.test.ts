import { expect, test } from 'bun:test'

import { tokenStylesheet } from '@open-pencil/dom-css/export'
import { SceneGraph } from '@open-pencil/scene-graph'
import { parseVariableFormula } from '@open-pencil/scene-graph/variables'

function spacing() {
  const graph = new SceneGraph()
  const collection = graph.createCollection('Spacing')
  const mode = collection.defaultModeId
  const base = graph.createVariable('base', 'FLOAT', collection.id, 4)
  const set = (name: string, source: string, unit?: 'none') => {
    const variable = graph.createVariable(name, 'FLOAT', collection.id, 0)
    if (unit) variable.unit = unit
    variable.valuesByMode[mode] = parseVariableFormula(graph, variable.id, mode, source).value
    return variable
  }
  return { graph, collection, base, set }
}

test('number formulas become calc() over var() with units on added literals', async () => {
  const { graph, set } = spacing()
  set('large', '{base} * 4')
  set('inset', '({base} + 2) * 2 - -{base}')
  set('half', '{base} / 2 + 1')
  set('folded', '2 * 3')
  const { css, issues } = await tokenStylesheet(graph, { format: 'css' })
  expect(issues).toEqual([])
  expect(css).toContain('--large: calc(var(--base) * 4);')
  expect(css).toContain('--inset: calc((var(--base) + 2px) * 2 - -1 * var(--base));')
  expect(css).toContain('--half: calc(var(--base) / 2 + 1px);')
  expect(css).toContain('--folded: 6px;')
})

test('formulas CSS cannot type are reported instead of written', async () => {
  const { graph, set } = spacing()
  set('area', '{base} * {base}')
  set('ratio', '{base} / {base}')
  set('scale', '{base} * 2', 'none')
  const { css, issues } = await tokenStylesheet(graph, { format: 'css' })
  expect(css).not.toContain('--area')
  expect(css).not.toContain('--ratio')
  expect(css).not.toContain('--scale')
  expect(issues.map((issue) => issue.message)).toEqual([
    'area multiplies two lengths',
    'ratio divides by a length',
    'scale has a formula with a unit'
  ])
})

test('a formula is declared again in each mode that changes a variable it uses', async () => {
  const { graph, collection, base, set } = spacing()
  graph.addMode(collection.id, 'compact', 'Compact')
  base.valuesByMode.compact = 2
  const large = set('large', '{base} * 4')
  large.valuesByMode.compact = large.valuesByMode[collection.defaultModeId]
  const { css } = await tokenStylesheet(graph, { format: 'css' })
  const scoped = css.slice(css.indexOf('Spacing: Compact'))
  expect(scoped).toContain('--base: 2px;')
  expect(scoped).toContain('--large: calc(var(--base) * 4);')
})
