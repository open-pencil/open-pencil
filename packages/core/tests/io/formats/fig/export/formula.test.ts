import { expect, test } from 'bun:test'

import { exportFigFile, initCodec, parseFigFile, SceneGraph } from '@open-pencil/core'
import { FigmaAPI } from '@open-pencil/core/figma-api'
import { parseVariableFormula } from '@open-pencil/scene-graph'

test('numeric and Boolean formulas survive fresh and patched .fig saves', async () => {
  await initCodec()
  const graph = new SceneGraph()
  const collection = graph.createCollection('Tokens')
  const base = graph.createVariable('base', 'FLOAT', collection.id, 4)
  const derived = graph.createVariable('derived', 'FLOAT', collection.id, 0)
  const enabled = graph.createVariable('enabled', 'BOOLEAN', collection.id, true)
  const hidden = graph.createVariable('hidden', 'BOOLEAN', collection.id, false)
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
    '{enabled} NOR false'
  ).value
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
    expect(current.resolveVariable(number?.id ?? '')).toBe(i === 0 ? 10 : 16)
    expect(current.resolveVariable(boolean?.id ?? '')).toBe(i !== 0)
    const node = [...current.getAllNodes()].find((node) => node.name === 'Formula consumer')
    expect(node?.width).toBe(i === 0 ? 10 : 16)
    expect(node?.visible).toBe(i !== 0)
    const api = new FigmaAPI(current)
    for (const variable of current.variables.values()) {
      const active = current.getActiveModeId(variable.collectionId)
      if (variable.name === base.name) api.setVariableValue(variable.id, active, 10)
      if (variable.name === enabled.name) api.setVariableValue(variable.id, active, false)
    }
  }
})


test.each([
  { operator: 'ADDITION', operands: [true, 1] },
  { operator: 'AND', operands: [1, false] },
  { operator: 'NEGATE', operands: [1, 2] }
] as const)('FIG export rejects invalid formula operands instead of coercing them: %j', async (value) => {
  await initCodec()
  const graph = new SceneGraph()
  const collection = graph.createCollection('Tokens')
  graph.createVariable('invalid', 'FLOAT', collection.id, {
    expression: 'FORMULA', type: 'FLOAT', value: { ...value, operands: [...value.operands] }
  })
  await expect(exportFigFile(graph)).rejects.toThrow()
})
