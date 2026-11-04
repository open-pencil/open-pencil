import { expect, test } from 'bun:test'

import { expectDefined } from '#core-tests/helpers/assert'

import { exportFigFile, parseFigFile } from '@open-pencil/core/io/formats/fig'
import { initCodec } from '@open-pencil/kiwi/fig/codec'
import { SceneGraph } from '@open-pencil/scene-graph'
import { parseFigBuffer } from '@open-pencil/fig'
import { FigmaAPI } from '@open-pencil/core/figma-api'
import { parseVariableFormula } from '@open-pencil/scene-graph/variables'

test('numeric, Boolean and comparison formulas survive fresh and patched .fig saves', async () => {
  await initCodec()
  const graph = new SceneGraph()
  const collection = graph.createCollection('Tokens')
  const base = graph.createVariable('base', 'FLOAT', collection.id, 4)
  const derived = graph.createVariable('derived', 'FLOAT', collection.id, 0)
  const enabled = graph.createVariable('enabled', 'BOOLEAN', collection.id, true)
  const hidden = graph.createVariable('hidden', 'BOOLEAN', collection.id, false)
  const wide = graph.createVariable('wide', 'BOOLEAN', collection.id, false)
  const mode = collection.defaultModeId
  derived.valuesByMode[mode] = parseVariableFormula(
    graph,
    derived.id,
    mode,
    '-(-{base}) + (3 * 4) / 2'
  ).value
  hidden.valuesByMode[mode] = parseVariableFormula(
    graph,
    hidden.id,
    mode,
    'not ({enabled} or false)'
  ).value
  wide.valuesByMode[mode] = parseVariableFormula(graph, wide.id, mode, '{base} * 2 > 12').value
  graph.createNode('FRAME', graph.getPages()[0].id, {
    name: 'Formula consumer',
    width: 10,
    visible: false,
    boundVariables: { width: derived.id, visible: hidden.id }
  })
  let current = graph
  for (let i = 0; i < 2; i++) {
    current = await parseFigFile(Uint8Array.from(await exportFigFile(current)).buffer)
    const number = [...current.variables.values()].find((v) => v.name === 'derived')
    const boolean = [...current.variables.values()].find((v) => v.name === 'hidden')
    const comparison = [...current.variables.values()].find((v) => v.name === 'wide')
    expect(current.resolveVariable(comparison?.id ?? '')).toBe(i !== 0)
    expect(current.resolveVariable(number?.id ?? '')).toBe(i === 0 ? 10 : 16)
    expect(current.resolveVariable(boolean?.id ?? '')).toBe(i !== 0)
    const node = [...current.getAllNodes()].find((node) => node.name === 'Formula consumer')
    expect(node?.width).toBe(i === 0 ? 10 : 16)
    expect(node?.visible).toBe(i !== 0)
    const api = new FigmaAPI(current)
    for (const variable of current.variables.values()) {
      const active = current.getActiveModeId(variable.collectionId)
      if (variable.name === base.name) expectDefined(api.variables.getVariableById(variable.id)).setValueForMode(active, 10)
      if (variable.name === enabled.name) expectDefined(api.variables.getVariableById(variable.id)).setValueForMode(active, false)
    }
  }
})

test.each([
  { operator: 'add', operands: [true, 1] },
  { operator: 'and', operands: [1, false] },
  { operator: 'negate', operands: [1, 2] }
] as const)('FIG export rejects invalid formula operands instead of coercing them: %j', async (value) => {
  await initCodec()
  const graph = new SceneGraph()
  const collection = graph.createCollection('Tokens')
  graph.createVariable('invalid', 'FLOAT', collection.id, {
    expression: 'FORMULA', type: 'FLOAT', value: { ...value, operands: [...value.operands] }
  })
  await expect(exportFigFile(graph)).rejects.toThrow()
})

test('text, truthiness and if() formulas survive a .fig save, written with the functions Figma uses', async () => {
  await initCodec()
  const graph = new SceneGraph()
  const collection = graph.createCollection('Tokens')
  const mode = collection.defaultModeId
  graph.createVariable('count', 'FLOAT', collection.id, 3)
  graph.createVariable('name', 'STRING', collection.id, 'Ada')
  graph.createVariable('dark', 'BOOLEAN', collection.id, true)
  graph.createVariable('ink', 'COLOR', collection.id, { r: 0, g: 0, b: 0, a: 1 })
  const formulas = {
    label: ['STRING', 'if({dark}, "Hi, " + {name}, text({count}) + " items")'],
    named: ['BOOLEAN', 'truthy({name})'],
    gap: ['FLOAT', 'if({count} > 2, 16, 8)'],
    surface: ['COLOR', 'if(not {dark}, {ink}, #FFFFFF)']
  } as const
  for (const [name, [type, source]] of Object.entries(formulas)) {
    const variable = graph.createVariable(name, type, collection.id, type === 'FLOAT' ? 0 : '')
    variable.valuesByMode[mode] = parseVariableFormula(graph, variable.id, mode, source).value
  }
  const bytes = await exportFigFile(graph)
  const reopened = await parseFigFile(Uint8Array.from(bytes).buffer)
  const resolved = (name: string) =>
    reopened.resolveVariable(
      [...reopened.variables.values()].find((variable) => variable.name === name)?.id ?? ''
    )
  expect(['label', 'named', 'gap', 'surface'].map(resolved)).toEqual([
    'Hi, Ada',
    true,
    16,
    { r: 1, g: 1, b: 1, a: 1 }
  ])
  const functions = parseFigBuffer(Uint8Array.from(bytes).buffer)
    .nodeChanges.filter((node) => node.type === 'VARIABLE')
    .map((node) => node.variableDataValues?.entries?.[0].variableData.value?.expressionValue)
    .flatMap((expression) => (expression ? [expression.expressionFunction] : []))
  expect(functions).toEqual(['TERNARY', 'IS_TRUTHY', 'TERNARY', 'TERNARY'])
})
