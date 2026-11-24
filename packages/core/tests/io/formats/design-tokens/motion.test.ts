import { expect, test } from 'bun:test'

import { SceneGraph } from '@open-pencil/scene-graph'
import { easingPreset } from '@open-pencil/scene-graph/variables'

import {
  defaultTokenImportOptions,
  exportDesignTokens,
  importTokensIntoGraph,
  planTokenImport,
  readDesignTokens
} from '#core/io/formats/design-tokens'

const CURVE = { x1: 0.1, y1: 0.2, x2: 0.3, y2: 0.9 }

function motion() {
  const graph = new SceneGraph()
  const collection = graph.createCollection('Motion')
  graph.createVariable('Fast', 'TIMING', collection.id, 0.15)
  graph.createVariable('Out', 'EASING', collection.id, easingPreset('OUT_CUBIC'))
  graph.createVariable('Custom', 'EASING', collection.id, { easing: 'CUSTOM_CUBIC', bezier: CURVE })
  graph.createVariable('Gentle', 'EASING', collection.id, easingPreset('GENTLE_SPRING'))
  return graph
}

test('timings are durations in seconds and curves are cubicBezier; springs are left out', () => {
  const { files, issues } = exportDesignTokens(motion())
  expect(files.find((file) => file.path === 'Motion/Mode 1.tokens.json')?.content).toMatchObject({
    Fast: { $type: 'duration', $value: { value: 0.15, unit: 's' } },
    Out: { $type: 'cubicBezier', $value: [0, 0, 0.58, 1] },
    Custom: { $type: 'cubicBezier', $value: [0.1, 0.2, 0.3, 0.9] }
  })
  expect(issues).toEqual([
    { kind: 'unsupported-easing', collection: 'Motion', mode: 'Mode 1', token: 'Gentle' }
  ])
})

test('durations and curves read back as timings and easings, a preset’s curve as the preset', () => {
  const graph = new SceneGraph()
  const bundle = readDesignTokens(
    exportDesignTokens(motion()).files.map((file) => ({
      path: file.path,
      text: JSON.stringify(file.content)
    }))
  )
  importTokensIntoGraph(
    graph,
    graph.getPages()[0].id,
    planTokenImport(graph, bundle, defaultTokenImportOptions(graph, bundle))
  )
  const values = Object.fromEntries(
    [...graph.variables.values()].map((variable) => [
      variable.name,
      [variable.type, Object.values(variable.valuesByMode)[0]]
    ])
  )
  expect(values).toEqual({
    Fast: ['TIMING', 0.15],
    Out: ['EASING', easingPreset('OUT_CUBIC')],
    Custom: ['EASING', { easing: 'CUSTOM_CUBIC', bezier: CURVE }]
  })
})
