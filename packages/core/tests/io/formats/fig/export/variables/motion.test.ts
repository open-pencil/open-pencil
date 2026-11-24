import { expect, test } from 'bun:test'

import { exportFigFile, parseFigFile } from '@open-pencil/core/io/formats/fig'
import { parseFigBuffer } from '@open-pencil/fig'
import { initCodec } from '@open-pencil/kiwi/fig/codec'
import { SceneGraph } from '@open-pencil/scene-graph'

const SPRING = { easing: 'CUSTOM_SPRING', spring: { stiffness: 100, damping: 12, mass: 1 } } as const

function motionGraph() {
  const graph = new SceneGraph()
  const collection = graph.createCollection('Motion')
  const timing = graph.createVariable('timing', 'TIMING', collection.id, 0.25)
  graph.createVariable('timing alias', 'TIMING', collection.id, { aliasId: timing.id })
  graph.createVariable('easing', 'EASING', collection.id, SPRING)
  graph.createVariable('hold', 'EASING', collection.id, { easing: 'HOLD' })
  return graph
}

function savedValues(bytes: Uint8Array) {
  return Object.fromEntries(
    parseFigBuffer(Uint8Array.from(bytes).buffer)
      .nodeChanges.filter((record) => record.type === 'VARIABLE')
      .map((record) => [
        record.name,
        {
          type: record.variableResolvedType,
          data: record.variableDataValues?.entries?.[0]?.variableData
        }
      ])
  )
}

test('timings and easings are saved as Figma saves them', async () => {
  await initCodec()
  const saved = savedValues(await exportFigFile(motionGraph()))
  expect(saved.timing).toEqual({
    type: 'TIMING',
    data: { value: { floatValue: 0.25 }, dataType: 'FLOAT', resolvedDataType: 'TIMING' }
  })
  expect(saved['timing alias']).toMatchObject({
    type: 'TIMING',
    data: { dataType: 'ALIAS', resolvedDataType: 'TIMING' }
  })
  expect(saved.easing).toEqual({
    type: 'EASING',
    data: {
      value: {
        easingValue: {
          easingType: 'CUSTOM_SPRING',
          easingValue: { springEasing: { stiffness: 100, damping: 12, mass: 1 } }
        }
      },
      dataType: 'EASING',
      resolvedDataType: 'EASING'
    }
  })
  expect(saved.hold.data?.value).toEqual({ easingValue: { easingType: 'HOLD' } })
})

test('timings and easings read back as they were', async () => {
  await initCodec()
  const graph = await parseFigFile(Uint8Array.from(await exportFigFile(motionGraph())).buffer)
  const values = Object.fromEntries(
    [...graph.variables.values()].map((variable) => [
      variable.name,
      Object.values(variable.valuesByMode)[0]
    ])
  )
  const timing = [...graph.variables.values()].find((variable) => variable.name === 'timing')
  expect(values).toEqual({
    timing: 0.25,
    'timing alias': { aliasId: timing?.id },
    easing: SPRING,
    hold: { easing: 'HOLD' }
  })
})
