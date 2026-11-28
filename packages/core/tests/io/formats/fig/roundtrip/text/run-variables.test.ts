import { describe, expect, setDefaultTimeout, test } from 'bun:test'

import { exportFigFile, parseFigFile } from '@open-pencil/core/io/formats/fig'
import { initCodec } from '@open-pencil/kiwi/fig/codec'
import { SceneGraph } from '@open-pencil/scene-graph'
import { expectDefined } from '@open-pencil/test-support/assert'

setDefaultTimeout(60_000)

describe('text run fill variable roundtrip', () => {
  test('text range fill color variable binding survives export → re-import', async () => {
    await initCodec()

    const graph = new SceneGraph()
    const col = graph.createCollection('Colors')
    const accent = graph.createVariable('Accent', 'COLOR', col.id, {
      r: 0.2,
      g: 0.6,
      b: 0.9,
      a: 1
    })
    const page = graph.getPages()[0]
    graph.createNode('TEXT', page.id, {
      name: 'RangeText',
      text: 'Hello world',
      styleRuns: [
        {
          start: 6,
          length: 5,
          style: {
            fills: [
              {
                type: 'SOLID',
                color: { r: 0.2, g: 0.6, b: 0.9, a: 1 },
                opacity: 1,
                visible: true
              }
            ],
            boundVariables: { 'fills/0/color': accent.id }
          }
        }
      ]
    })

    const exported = await exportFigFile(graph)
    const reimported = await parseFigFile(exported.buffer as ArrayBuffer)
    const node = expectDefined(
      [...reimported.getAllNodes()].find(
        (candidate) => candidate.type === 'TEXT' && candidate.name === 'RangeText'
      ),
      'RangeText node'
    )
    const reimportedAccent = expectDefined(
      [...reimported.variables.values()].find((v) => v.name === 'Accent'),
      'Accent variable'
    )
    expect(node.styleRuns).toHaveLength(1)
    expect(node.styleRuns[0]?.style.boundVariables).toEqual({
      'fills/0/color': reimportedAccent.id
    })
  })

  test('range fill binding persists on export → re-import even when run fills are inherited', async () => {
    await initCodec()

    const graph = new SceneGraph()
    const col = graph.createCollection('Colors')
    const colorA = { r: 0.2, g: 0.6, b: 0.9, a: 1 }
    const colorB = { r: 0.9, g: 0.2, b: 0.3, a: 1 }
    const varA = graph.createVariable('VarA', 'COLOR', col.id, colorA)
    graph.createVariable('VarB', 'COLOR', col.id, colorB)
    const page = graph.getPages()[0]
    const text = graph.createNode('TEXT', page.id, {
      name: 'InheritedRangeText',
      text: 'Hello world',
      styleRuns: [
        {
          start: 6,
          length: 5,
          style: {
            boundVariables: { 'fills/0/color': varA.id }
          }
        }
      ]
    })
    graph.bindVariable(text.id, 'fills/0/color', varA.id)

    const exported = await exportFigFile(graph)
    const reimported = await parseFigFile(exported.buffer as ArrayBuffer)
    const node = expectDefined(
      [...reimported.getAllNodes()].find(
        (candidate) => candidate.type === 'TEXT' && candidate.name === 'InheritedRangeText'
      ),
      'InheritedRangeText node'
    )
    const reimportedA = expectDefined(
      [...reimported.variables.values()].find((v) => v.name === 'VarA'),
      'VarA variable'
    )
    const reimportedB = expectDefined(
      [...reimported.variables.values()].find((v) => v.name === 'VarB'),
      'VarB variable'
    )

    reimported.bindVariable(node.id, 'fills/0/color', reimportedB.id)
    const updated = expectDefined(reimported.getNode(node.id), 'updated node')
    expect(updated.fills[0]?.color.r).toBeCloseTo(colorB.r, 2)
    expect(updated.styleRuns).toHaveLength(1)
    expect(updated.styleRuns[0]?.style.boundVariables).toEqual({
      'fills/0/color': reimportedA.id
    })
    expect(updated.styleRuns[0]?.style.fills?.[0]?.color.r).toBeCloseTo(colorA.r, 2)
  })
})
